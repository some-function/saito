const saito = require('./../../lib/saito/saito');
const MixinModule = require('./lib/mixinmodule');
const ModTemplate = require('../../lib/templates/modtemplate');
const fetch = require('node-fetch');
const axios = require('axios');
const JSON = require('json-bigint');
const PeerService = require('saito-js/lib/peer_service').default;
const {
  MixinApi,
  getED25519KeyPair,
  signEd25519PIN,
  base64RawURLEncode,
  base64RawURLDecode,
  getTipPinUpdateMsg,
  MixinCashier,
  buildSafeTransactionRecipient,
  getUnspentOutputsForRecipients,
  buildSafeTransaction,
  encodeSafeTransaction,
  signSafeTransaction,
  blake3Hash
} = require('@mixin.dev/mixin-node-sdk');
const { v4 } = require('uuid');

class Mixin extends ModTemplate {
  constructor(app) {
    super(app);

    this.name = 'Mixin';
    this.slug = 'mixin';
    this.appname = 'Mixin';
    this.description = 'Adding support for Web3 Crypto transfers on Saito';
    this.categories = 'Finance Utilities';
    this.icon = 'fas fa-wallet';
    this.class = 'utility';

    //
    // All the stuff we save in our wallet
    //
    this.mixin = {};
    // this.mixin.user_id = '';
    // this.mixin.session_id = '';
    // this.mixin.session_seed = '';
    // this.mixin.full_name = '';
    // this.mixin.tip_key_base64 = '';
    // this.mixin.spend_private_key = '';
    // this.mixin.spend_public_key = '';

    this.mixin_peer = null;

    this.bot = null;

    this.account_created = 0;

    this.crypto_mods = [];
  }

  returnServices() {
    this.services = [];
    if (this.bot) {
      this.services.push(new PeerService(null, 'mixin'));
    }
    return this.services;
  }

  async initialize(app) {
    await super.initialize(app);
    await this.load();

    if (!app.BROWSER) {
      if (!this.bot) {
        // get mixin env
        let m = this.getEnv();
        if (m) {
          const keystore = {
            app_id: m.app_id,
            session_id: m.session_id,
            server_public_key: m.server_public_key,
            session_private_key: m.session_private_key
          };

          this.bot = MixinApi({ keystore });
        }
      }
    }

    await this.loadCryptos();
  }

  canRenderInto(qs) {
    return false;
  }

  async handlePeerTransaction(app, tx = null, peer, mycallback = null) {
    if (tx == null) {
      return 0;
    }
    let message = tx.returnMessage();

    //
    // we receive requests to create accounts here
    //
    if (message.request === 'mixin create account') {
      if (this.bot) {
        return await this.receiveCreateAccountTransaction(app, tx, peer, mycallback);
      } else {
        console.error('Cannot process Mixin account request for peer');
      }
    }

    //
    // Save user info when we create a deposit address (for a particular ticker)
    //
    if (message.request === 'mixin save user') {
      return await this.receiveSaveUserTransaction(app, tx, peer, mycallback);
    }

    //
    // sendPayment, returnWithdrawalFeeForAddress
    //
    if (message.request === 'mixin fetch user') {
      return await this.receiveFetchUserTransaction(app, tx, peer, mycallback);
    }

    //
    // getMixinAddress
    //
    if (message.request === 'mixin fetch user by publickey') {
      return await this.receiveFetchUserByPublickeyTransaction(app, tx, peer, mycallback);
    }

    //
    // returnHistory
    //
    if (message.request === 'mixin fetch address by user id') {
      return await this.receiveFetchAddressByUserIdTransaction(app, tx, peer, mycallback);
    }

    if (message.request === 'mixin backup') {
      await this.saveMixinAccountData(message.data.account_hash, peer.publicKey);
      if (mycallback) {
        mycallback();
      }
      return 1;
    }

    if (message.request === 'mixin validation') {
      let db_results = await this.retrieveMixinAccountData(peer.publicKey);
      if (mycallback) {
        mycallback(db_results);
      }
      return 1;
    }

    if (message.request === 'mixin request payment address') {
      return await this.receiveRequestPaymentAddressTransaction(app, tx, peer, mycallback);
    }

    return super.handlePeerTransaction(app, tx, peer, mycallback);
  }

  async loadCryptos() {
    let mixin_self = this;
    let rtModules = this.app.modules.respondTo('mixin-crypto');

    for (let i = 0; i < rtModules.length; i++) {
      //
      // Create a crypto module for the currency
      //
      let crypto_module = new MixinModule(
        this.app,
        mixin_self,
        rtModules[i].ticker,
        rtModules[i].asset_id,
        rtModules[i].chain_id
      );

      //
      // Use the module's returnBalance function if provided
      //
      if (rtModules[i].returnBalance) {
        crypto_module.returnBalance = rtModules[i].returnBalance;
      }

      if (this.app.BROWSER) {
        if (!this.app.browser.returnURLParameter('withdraw')) {
          if (rtModules[i].name !== rtModules[i].ticker) {
            console.warn(
              'Installing a ghost crypto module: ',
              rtModules[i].name,
              rtModules[i].ticker
            );
            crypto_module.hide_me = true;
          }
        }
      }

      let info = await crypto_module.returnNetworkInfo();
      crypto_module.price_usd = info.price_usd;

      await crypto_module.installModule(mixin_self.app);
      this.crypto_mods.push(crypto_module);
      this.app.modules.mods.push(crypto_module);

      // Do an initial balance check if we are able to
      if (mixin_self.account_created) {
        if (crypto_module.isActivated()) {
          await this.fetchSafeUtxoBalance();
        } else if (crypto_module.address) {
          crypto_module.activate();
        }
      }
    }
  }

  async onPeerServiceUp(app, peer, service = {}) {
    if (service.service === 'mixin') {
      console.log('Mixin API online!!!!');
      this.mixin_peer = peer;

      if (this.mixin.user_id) {
        if (this.mixin.backed_up) {
          console.log('Validate my mixin backup');
          const privateKey = await this.app.wallet.getPrivateKey();

          this.app.network.sendRequestAsTransaction(
            'mixin validation',
            {},
            (res) => {
              console.log(`Found ${res.length} mixin accounts...`);
              for (let i = 0; i < res.length; i++) {
                const buf1 = Buffer.from(res[i].account_hash, 'base64');
                const buf2 = this.app.crypto.decryptWithPrivateKey(buf1, privateKey);
                console.log(JSON.parse(buf2.toString('utf8')));
              }
            },
            peer.peerIndex
          );
        } else {
          console.log('Need to back up my mixin');
          let input = Buffer.from(JSON.stringify(this.mixin), 'utf8');
          let account_hash = this.app.crypto
            .encryptWithPublicKey(input, this.publicKey)
            .toString('base64');

          this.app.network.sendRequestAsTransaction(
            'mixin backup',
            { account_hash },
            () => {
              console.log('Saved mixin credentials remotely');
              this.mixin.backed_up = true;
              this.save();
            },
            peer.peerIndex
          );
        }
      }
    }
  }

  async createAccount(callback = null) {
    if (this.account_created == 0) {
      const mixin_self = this;
      const privateKey = await this.app.wallet.getPrivateKey();
      const callback2 = (res) => {
        console.log(res);
        if (typeof res == 'object' && res?.res) {
          // Unencrypt
          const buf1 = Buffer.from(res.res, 'base64');
          const buf2 = mixin_self.app.crypto.decryptWithPrivateKey(buf1, privateKey);
          mixin_self.mixin = JSON.parse(buf2.toString('utf8'));
          mixin_self.account_created = 1;
          mixin_self.save();
          if (res.restored) {
            console.log('Successfully Restored Mixin Account!', mixin_self.mixin);
          } else {
            console.log('Successfully Created Mixin Account!', mixin_self.mixin);
          }
        } else {
          console.error('Mixin Account Error:', res?.err);
        }
        if (callback) {
          return callback(res);
        }
      };

      if (this.mixin_peer) {
        console.log('Request remote node to create Mixin User Account', this.mixin_peer.publicKey);
        await this.sendCreateAccountTransaction(callback2);
      } else {
        console.log('==> Create Mixin User Account on Same Node as API Keys');
        await this.createMixinUserAccount(this.publicKey, callback2);
      }
    }
  }

  sendCreateAccountTransaction(callback = null) {
    let mixin_self = this;

    let data = {};
    return mixin_self.app.network.sendRequestAsTransaction(
      'mixin create account',
      data,
      callback,
      mixin_self.mixin_peer?.peerIndex
    );
  }

  receiveCreateAccountTransaction(app, tx, peer, callback) {
    let pkey = tx.from[0].publicKey;

    return this.createMixinUserAccount(pkey, callback);
  }

  async createMixinUserAccount(pkey, callback) {
    // Check if account is already created and in DB
    const rtn_obj = {};

    let db_results = await this.retrieveMixinAccountData(pkey);
    if (db_results.length > 0) {
      rtn_obj.res = db_results[0].account_hash;
      rtn_obj.restored = true;
    } else {
      try {
        const { seed: sessionSeed, publicKey: sessionPublicKey } = getED25519KeyPair();
        const session_private_key = sessionSeed.toString('hex');
        //console.log('user session_private_key', session_private_key);

        const user = await this.bot.user.createBareUser(
          `Saito User ${pkey}`,
          base64RawURLEncode(sessionPublicKey)
        );

        console.log('user //', user.user_id);

        // update/create first tipPin
        const userClient = MixinApi({
          keystore: {
            app_id: user.user_id,
            session_id: user.session_id,
            pin_token_base64: user.pin_token_base64,
            session_private_key
          }
        });

        const { publicKey: spendPublicKey, seed: spendPrivateKey } = getED25519KeyPair();

        const spend_private_key = spendPrivateKey.toString('hex');

        await userClient.pin.updateTipPin('', spendPublicKey.toString('hex'), user.tip_counter + 1);
        console.log('update pin //');

        await userClient.pin.verifyTipPin(spendPrivateKey);
        console.log('verify pin //');

        const account = await userClient.safe.register(
          user.user_id,
          spend_private_key,
          spendPrivateKey
        );

        console.log('safe account ///', account.user_id, account.has_safe);

        const buf = Buffer.from(
          JSON.stringify({
            user_id: account.user_id,
            full_name: account.full_name,
            session_id: account.session_id,
            tip_key_base64: account.tip_key_base64,
            spend_private_key,
            spend_public_key: spendPublicKey.toString('hex'),
            session_seed: session_private_key,
            backed_up: true
          }),
          'utf8'
        );

        const encrypted_data = this.app.crypto.encryptWithPublicKey(buf, pkey).toString('base64');

        rtn_obj.res = encrypted_data;

        this.saveMixinAccountData(encrypted_data, pkey);
      } catch (err) {
        console.error('Mixin Create Account Error', err);
        Object.assign(rtn_obj, { err: 'Mixin create account error' });
      }
    }

    if (callback) {
      return callback(rtn_obj);
    } else {
      return rtn_obj;
    }
  }

  async createDepositAddress(asset_id, chain_id, save = true) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      console.log('this.mixin: ', this.mixin);

      let address = await user.safe.createDeposit(chain_id);

      if (save) {
        if (typeof address[0].destination != 'undefined') {
          for (let i = 0; i < this.crypto_mods.length; i++) {
            if (this.crypto_mods[i].asset_id === asset_id) {
              this.crypto_mods[i].address = address[0].destination;
              //this.crypto_mods[i].destination = address[0].destination;
              this.crypto_mods[i].save();

              if (this.app.BROWSER) {
                await this.sendSaveUserTransaction({
                  user_id: this.mixin.user_id,
                  asset_id: asset_id,
                  address: address[0].destination,
                  publickey: this.publicKey
                });
              }
            }
          }
        } else {
          throw new Error('Deposit Address undefined!');
        }
      } else {
        return address;
      }
    } catch (err) {
      console.error('ERROR: Mixin error create deposit address: ' + err);
      console.log(this.mixin);
      return false;
    }

    return true;
  }

  async fetchAsset(asset_id) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      let utxo = await user.safe.fetchAsset(asset_id);

      console.log('asset ///');
      console.log(asset);

      for (let i = 0; i < this.crypto_mods.length; i++) {
        if (this.crypto_mods[i].asset_id === asset_id) {
          if (utxo.data.length > 0) {
            this.crypto_mods[i].address = address[0].destination;
            //  removing save here for debugging purposes -- June 21, '24
            this.crypto_mods[i].save();
          }
        }
      }
    } catch (err) {
      console.error('ERROR: Mixin error fetch safe utxo: ' + err);
      return false;
    }
  }

  async fetchSafeUtxoBalance(asset_id) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      let utxo = await user.utxo.safeAssetBalance({
        members: [this.mixin.user_id],
        threshold: 1,
        asset: asset_id
      });

      return utxo;
    } catch (err) {
      console.error('ERROR: Mixin error fetch safe utxo: ' + err);
      return false;
    }
  }

  /***
   *  Returns a chronological Array of Objects with the format
   *
   * snapshot_id: "6049b6c2-3f9e-3627-b671-c81f4f6a88fa"
   * user_id: "95b8a0a4-1032-33e7-9154-5f48ebe00a14"
   * opponent_id: "dac46e33-fdd2-3453-b77a-73ffadba1ff1"
   * transaction_hash: "1db6dc53df33bfc7dd38afa86eb83454b5b71bc178da653431ddc9af025a7487"
   * asset_id: "43d61dcd-e413-450d-80b8-101d5e903357"
   * kernel_asset_id: "8dd50817c082cdcdd6f167514928767a4b52426997bd6d4930eca101c5ff8a27"
   * amount: "0.005"
   * memo: "746573742d6d656d6f"
   * request_id: "bfb05bb6-03e5-4b5c-a7ab-2ad5a4ed56a7"
   * created_at: "2025-08-25T03:23:17.657426Z"
   * level: 11
   * type: "snapshot"
   * inscription_hash: "INSCRIPTION-HASH"
   * deposit: { "deposit_hash": "DEPOSIT-HASH", "deposit_index": 1,
          "sender": "SOME-STRING", "destination": "DEPOSIT-DESTINATION", "tag": "DEPOSIT-TAG" }
   * withdrawal: { "withdrawal_hash": "WITHDRAWAL-HASH", "receiver": "SOME-STRING"  }
   *
   */

  async fetchSafeSnapshots(asset_id, created_at = 0, callback = null) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      let offset = new Date(created_at).toISOString();
      offset = offset.substring(0, offset.length - 1);
      offset = offset + '000000Z';

      console.log(created_at, offset);

      let snapshots = await user.safe.fetchSafeSnapshots({
        asset: asset_id,
        limit: 100,
        offset
      });

      if (callback) {
        return callback(snapshots);
      }
    } catch (err) {
      console.error('ERROR: Mixin error fetch safe snapshots: ' + err);
      return false;
    }
  }

  async fetchUtxo(state = 'unspent', limit = 100000, order = 'DESC', callback = null) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      let params = {
        limit: limit,
        state: state,
        order: order
      };

      let utxo_list = await user.utxo.safeOutputs(params);
      console.log(`utxo_list ${state}:///`, utxo_list);

      if (callback) {
        return callback(utxo_list);
      }
    } catch (err) {
      console.error('ERROR: Mixin error return utxo: ' + err);
      return false;
    }
  }

  async returnNetworkInfo(asset_id) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      let asset = await user.network.fetchAsset(asset_id);

      return asset;
    } catch (err) {
      console.error('ERROR: Mixin error check network fee: ' + err);
      return false;
    }
  }

  async returnWithdrawalFee(asset_id, recipient) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      const asset = await user.safe.fetchAsset(asset_id);
      const chain =
        asset.chain_id === asset.asset_id ? asset : await user.safe.fetchAsset(asset.chain_id);
      const fees = await user.safe.fetchFee(asset.asset_id, recipient);
      const assetFee = fees.find((f) => f.asset_id === asset.asset_id);
      const chainFee = fees.find((f) => f.asset_id === chain.asset_id);
      const fee = assetFee ?? chainFee;

      return fee.amount;
    } catch (err) {
      console.error('ERROR: Mixin error check withdrawl fee: ' + err);
      return false;
    }
  }

  async sendInNetworkTransferRequest(asset_id, destination, amount, unique_hash = '') {
    try {
      let spend_private_key = this.mixin.spend_private_key;
      let client = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      // destination
      const members = [destination];
      const threshold = 1;
      const recipients = [buildSafeTransactionRecipient(members, threshold, amount)];

      // get unspent utxos
      const outputs = await client.utxo.safeOutputs({
        members: [this.mixin.user_id],
        threshold: 1,
        asset: asset_id,
        state: 'unspent'
      });
      console.log('outputs: ', outputs);
      const balance = await client.utxo.safeAssetBalance({
        members: [this.mixin.user_id],
        threshold: 1,
        asset: asset_id,
        state: 'unspent'
      });
      console.log('balance: ', balance);

      // Get utxo inputs and change fot tx
      const { utxos, change } = getUnspentOutputsForRecipients(outputs, recipients);
      if (!change.isZero() && !change.isNegative()) {
        recipients.push(
          buildSafeTransactionRecipient(
            outputs[0].receivers,
            outputs[0].receivers_threshold,
            change.toString()
          )
        );
      }

      console.log('mixin checkpoint');

      const request_id = v4();
      const ghosts = await client.utxo.ghostKey(recipients, request_id, spend_private_key);

      console.log('ghosts: ', ghosts);

      // build safe transaction raw
      const tx = buildSafeTransaction(utxos, recipients, ghosts, 'test-memo');
      console.log('tx: ', tx);
      const raw = encodeSafeTransaction(tx);
      console.log('raw: ', raw);

      // verify safe transaction
      const verifiedTx = await client.utxo.verifyTransaction([
        {
          raw,
          request_id
        }
      ]);
      console.log('verifiedTx: ', verifiedTx);

      // sign safe transaction with the private key registerd to safe
      const signedRaw = signSafeTransaction(tx, verifiedTx[0].views, spend_private_key);
      console.log('signedRaw:', signedRaw);
      const sendedTx = await client.utxo.sendTransactions([
        {
          raw: signedRaw,
          request_id: request_id
        }
      ]);

      console.log('sendedTx: ', sendedTx);
      return { status: 200, message: sendedTx };
    } catch (err) {
      return { status: 400, message: err };
    }
  }

  async sendExternalNetworkTransferRequest(asset_id, destination, amount, unique_hash = '') {
    try {
      let spend_private_key = this.mixin.spend_private_key;
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      const asset = await user.safe.fetchAsset(asset_id);
      const chain =
        asset.chain_id === asset.asset_id ? asset : await user.safe.fetchAsset(asset.chain_id);
      const fees = await user.safe.fetchFee(asset.asset_id, destination);
      const assetFee = fees.find((f) => f.asset_id === asset.asset_id);
      const chainFee = fees.find((f) => f.asset_id === chain.asset_id);
      const fee = assetFee ?? chainFee;
      console.log('fee', fee);

      // withdrawal with chain asset as fee
      if (fee.asset_id !== asset.asset_id) {
        const outputs = await user.utxo.safeOutputs({
          asset: asset_id,
          state: 'unspent'
        });
        const feeOutputs = await user.utxo.safeOutputs({
          asset: fee.asset_id,
          state: 'unspent'
        });
        console.log('outputs: ', outputs, 'feeOutputs: ', feeOutputs);

        let recipients = [
          // withdrawal output, must be put first
          {
            amount: amount,
            destination: destination
          }
        ];
        const { utxos, change } = getUnspentOutputsForRecipients(outputs, recipients);
        if (!change.isZero() && !change.isNegative()) {
          // add change output if needed
          recipients.push(
            buildSafeTransactionRecipient(
              outputs[0].receivers,
              outputs[0].receivers_threshold,
              change.toString()
            )
          );
        }

        // get ghost key to send tx
        const txId = v4();
        const ghosts = await client.utxo.ghostKey(recipients, txId, spend_private_key);

        // spare the 0 inedx for withdrawal output, withdrawal output doesnt need ghost key
        const tx = buildSafeTransaction(
          utxos,
          recipients,
          [undefined, ...ghosts],
          'withdrawal-memo'
        );
        console.log('tx: ', tx);
        const raw = encodeSafeTransaction(tx);
        const ref = blake3Hash(Buffer.from(raw, 'hex')).toString('hex');

        const feeRecipients = [
          // fee output
          buildSafeTransactionRecipient([MixinCashier], 1, fee.amount)
        ];
        const { utxos: feeUtxos, change: feeChange } = getUnspentOutputsForRecipients(
          feeOutputs,
          feeRecipients
        );
        if (!feeChange.isZero() && !feeChange.isNegative()) {
          // add fee change output if needed
          feeRecipients.push(
            buildSafeTransactionRecipient(
              feeOutputs[0].receivers,
              feeOutputs[0].receivers_threshold,
              feeChange.toString()
            )
          );
        }
        const feeId = v4();
        const feeGhosts = await client.utxo.ghostKey(feeRecipients, feeId, spendPrivateKey);
        const feeTx = buildSafeTransaction(
          feeUtxos,
          feeRecipients,
          feeGhosts,
          'withdrawal-fee-memo',
          [ref]
        );
        console.log('feeTx: ', feeTx);
        const feeRaw = encodeSafeTransaction(feeTx);
        console.log('feeRaw: ', feeRaw);

        //console.log(txId, feeId);
        let txs = await user.utxo.verifyTransaction([
          {
            raw,
            request_id: txId
          },
          {
            raw: feeRaw,
            request_id: feeId
          }
        ]);

        const signedRaw = signSafeTransaction(tx, txs[0].views, spend_private_key);
        const signedFeeRaw = signSafeTransaction(feeTx, txs[1].views, spend_private_key);
        const res = await user.utxo.sendTransactions([
          {
            raw: signedRaw,
            request_id: txId
          },
          {
            raw: signedFeeRaw,
            request_id: feeId
          }
        ]);

        console.log('res: ', res);
        return { status: 200, message: res };
      } else {
        // withdrawal with asset as fee
        const outputs = await user.utxo.safeOutputs({
          asset: asset_id,
          state: 'unspent'
        });
        console.log('outputs: ', outputs);

        let recipients = [
          // withdrawal output, must be put first
          {
            amount: amount,
            destination: destination
          },
          // fee output
          buildSafeTransactionRecipient([MixinCashier], 1, fee.amount)
        ];
        const { utxos, change } = getUnspentOutputsForRecipients(outputs, recipients);
        if (!change.isZero() && !change.isNegative()) {
          // add change output if needed
          recipients.push(
            buildSafeTransactionRecipient(
              outputs[0].receivers,
              outputs[0].receivers_threshold,
              change.toString()
            )
          );
        }

        console.log('mixin checkpoint');

        // the index of ghost keys must be the same with the index of outputs
        // but withdrawal output doesnt need ghost key, so index + 1
        const request_id = v4();
        const ghosts = await client.utxo.ghostKey(recipients, request_id, spendPrivateKey);
        // spare the 0 inedx for withdrawal output, withdrawal output doesnt need ghost key
        const tx = buildSafeTransaction(
          utxos,
          recipients,
          [undefined, ...ghosts],
          'withdrawal-memo'
        );
        console.log('tx: ', tx);
        const raw = encodeSafeTransaction(tx);

        console.log(request_id);
        let txs = await user.utxo.verifyTransaction([
          {
            raw,
            request_id
          }
        ]);

        const signedRaw = signSafeTransaction(tx, txs[0].views, spend_private_key);
        const res = await user.utxo.sendTransactions([
          {
            raw: signedRaw,
            request_id
          }
        ]);
        console.log('res: ', res);
        return { status: 200, message: res };
      }
    } catch (err) {
      return { status: 400, message: err };
    }
  }

  async sendSaveUserTransaction(params = {}) {
    await this.app.network.sendRequestAsTransaction(
      'mixin save user',
      params,
      function (res) {
        console.log('Callback for sendSaveUserTransaction request: ', res);
      },
      this.mixin_peer?.peerIndex
    );
  }

  async receiveSaveUserTransaction(app, tx, peer, callback) {
    let message = tx.returnMessage();

    let user_id = message.data.user_id;
    let address = message.data.address;
    let publickey = message.data.publickey;
    let asset_id = message.data.asset_id;
    let created_at = tx.timestamp;
    let updated_at = tx.timestamp;

    let sql = `INSERT INTO mixin_users (user_id,
                                   address,
                                   publickey,
                                   asset_id,
                                   created_at,
                                   updated_at)
               VALUES ($user_id,
                       $address,
                       $publickey,
                       $asset_id,
                       $created_at,
                       $updated_at
                       )`;

    let params = {
      $user_id: user_id,
      $address: address,
      $publickey: publickey,
      $asset_id: asset_id,
      $created_at: created_at,
      $updated_at: updated_at
    };

    let result = await this.app.storage.runDatabase(sql, params, 'mixin');
    console.log(result);
  }

  async saveMixinAccountData(data, pkey) {
    let sql = `INSERT INTO mixin_accounts (publickey, account_hash) VALUES ($publickey, $account_hash)`;
    let params = {
      $publickey: pkey,
      $account_hash: data
    };

    let result = await this.app.storage.runDatabase(sql, params, 'mixin');
    console.log(result);
    return result;
  }

  async retrieveMixinAccountData(pkey) {
    let sql = `SELECT * FROM mixin_accounts WHERE publickey = $publickey`;
    let params = { $publickey: pkey };

    let result = await this.app.storage.queryDatabase(sql, params, 'mixin');

    return result;
  }

  async sendFetchUserTransaction(params = {}, callback) {
    let data = params;
    return this.app.network.sendRequestAsTransaction(
      'mixin fetch user',
      data,
      function (res) {
        console.log('Callback for sendFetchUserTransaction request: ', res);
        return callback(res);
      },
      this.mixin_peer?.peerIndex
    );
  }

  async receiveFetchUserTransaction(app, tx, peer, callback = null) {
    let message = tx.returnMessage();
    let address = message.data.address;
    let sql = `SELECT * FROM mixin_users 
               WHERE address = $address;`;
    let params = {
      $address: address
    };

    let result = await this.app.storage.queryDatabase(sql, params, 'mixin');
    if (result.length > 0) {
      return callback(result[0]);
    }

    return callback(false);
  }

  // Get MixinAddress -> returnAddressFromPublicKey
  async sendFetchUserByPublicKeyTransaction(params = {}, callback) {
    console.log('params: ', params);

    return await this.app.network.sendRequestAsTransaction(
      'mixin fetch user by publickey',
      params,
      callback,
      this.mixin_peer?.peerIndex
    );
  }

  async receiveFetchUserByPublickeyTransaction(app, tx, peer, callback = null) {
    let message = tx.returnMessage();
    let publicKey = message.data.publicKey;
    let asset_id = message.data.asset_id;
    let sql = `SELECT * FROM mixin_users 
               WHERE publickey = $publicKey AND asset_id = $asset_id ORDER BY created_at DESC;`;
    let params = {
      $publicKey: publicKey,
      $asset_id: asset_id
    };
    let result = await this.app.storage.queryDatabase(sql, params, 'mixin');
    if (result.length > 0) {
      return callback(result);
    }

    return callback(false);
  }

  //Return History
  async sendFetchAddressByUserIdTransaction(asset_id, user_id) {
    if (this.mixin_peer?.peerIndex) {
      return await this.app.network.sendRequestAsTransaction(
        'mixin fetch address by user id',
        { asset_id, user_id },
        function (res) {
          if (res.length > 0) {
            return res[0];
          }
          return null;
        },
        this.mixin_peer.peerIndex
      );
    } else {
      return null;
    }
  }

  async receiveFetchAddressByUserIdTransaction(app, tx, peer, callback = null) {
    console.log('tx:', tx);
    let message = tx.returnMessage();
    let user_id = message.data.user_id;
    let asset_id = message.data.asset_id;
    let sql = `SELECT * FROM mixin_users 
               WHERE user_id = $user_id AND asset_id = $asset_id ORDER BY created_at DESC;`;
    let params = {
      $user_id: user_id,
      $asset_id: asset_id
    };
    let result = await this.app.storage.queryDatabase(sql, params, 'mixin');
    console.log('result:', result);
    if (result.length > 0) {
      return callback(result);
    }

    return callback(false);
  }

  async fetchPendingDeposits(asset_id, destination, callback) {
    try {
      let user = MixinApi({
        keystore: {
          app_id: this.mixin.user_id,
          session_id: this.mixin.session_id,
          pin_token_base64: this.mixin.tip_key_base64,
          session_private_key: this.mixin.session_seed
        }
      });

      if (!destination) {
        return callback([]);
      }

      let params = {
        asset: asset_id,
        destination: destination
      };

      let deposits = await user.safe.pendingDeposits(params);
      return callback(deposits);
    } catch (err) {
      console.error('ERROR: Mixin error fetch fetchPendingDeposits: ' + err);
      return false;
    }
  }

  async getReservedPaymentAddress({ public_key, amount, minutes = 30, ticker, tx_serialized, callback }) {
    console.log('this.mixin: ', this.mixin);
    console.log('this.mixin_peer: ', this.mixin_peer);
    if (this.mixin_peer?.peerIndex) {
      return await this.app.network.sendRequestAsTransaction(
        'mixin request payment address',
        { public_key, amount, minutes, ticker, tx_serialized }, // serialized tx
        (res) => callback?.(res),
        this.mixin_peer.peerIndex
      );
    }
    return null;
  }

  async receiveRequestPaymentAddressTransaction(app, tx, peer, callback = null) {
    try {
      console.log('inside receiveRequestPaymentAddressTransaction 1 ///');
      console.log(tx.returnMessage());
      let { public_key, amount, minutes = 30, ticker, tx_serialized } = tx.returnMessage().data || {};

      if (!public_key) {
        let public_key = tx.from[0].publicKey;
      }

      if (!amount || !ticker) {
        let err = { ok: false, error: 'missing_params' };
        return callback ? callback(err) : err;
      }

      console.log('inside receiveRequestPaymentAddressTransaction 2 ///');

      //
      // get asset_id / chain_id from installed crypto modules by ticker
      //
      let mod = this.crypto_mods.find(
        (m) => (m.ticker || '').toUpperCase() === (ticker || '').toUpperCase()
      );
      if (!mod) {
        let err = { ok: false, error: 'unsupported_ticker' };
        return callback ? callback(err) : err;
      }
      let asset_id = mod.asset_id;
      let chain_id = mod.chain_id;

      console.log('inside receiveRequestPaymentAddressTransaction 3 ///');

      //
      // get or create an UNUSED address
      //
      let addr = await this.getOrCreateUnusedDepositAddressServer({
        public_key,
        asset_id,
        chain_id
      });

      console.log('address: ', addr);
      if (!addr) {
        let err = { ok: false, error: 'address_pool_unavailable' };
        return callback ? callback(err) : err;
      }
      let { address, address_id, status } = addr;

      //
      // status
      // 0 = not reserved
      // 1 = reserved
      //
      if (status != 1) {
        console.log('inside receiveRequestPaymentAddressTransaction 4 ///');
        //
        // reserve address
        //
        let reserved = await this.reservePaymentAddressServer({
          public_key,
          asset_id,
          chain_id,
          address,
          address_id,
          amount,
          minutes,
          tx_serialized // serialized tx
        });

        console.log('reserved: ', reserved);
      }

      console.log('inside receiveRequestPaymentAddressTransaction 5 ///');
      //
      // return address details
      //
      return callback ? callback(addr) : addr;
    } catch (e) {
      console.error('receiveRequestPaymentAddressTransaction error:', e);
      let err = { ok: false, error: 'server_error' };
      return callback ? callback(err) : err;
    }
  }

  async getOrCreateUnusedDepositAddressServer({ public_key, asset_id, chain_id }) {
    //
    // fetch unsed address
    //
    let existing = await this.app.storage.queryDatabase(
      `SELECT *
        FROM mixin_payment_addresses
        WHERE reserved_by = $reserved_by
          AND asset_id   = $asset_id
          AND chain_id   = $chain_id
        ORDER BY created_at DESC
      `,
      { $reserved_by: public_key, $asset_id: asset_id, $chain_id: chain_id },
      'mixin'
    );

    console.log('existing: ', existing);

    if (existing && existing.length > 0) {
      return {
        reserved_by: existing[0].address,
        address_id: existing[0].id,
        reserved_request: existing[0].reserved_request,
        reserved_at: existing[0].reserved_at,
        created_at: existing[0].created_at
      };
    }

    //
    // address not available, create a new one
    //
    // let created = await this.createDepositAddress(asset_id, chain_id, /* save */ false);
    // if (!created || !created.length) return null;

    //
    // hardcoded temporarily
    //
    let created = [
      {
        destination: 'TRZiP1cLYxg8cgubEH6rGDoeXBgg4D4ZHN'
      }
    ];

    console.log('created:', created);

    let destination = created[0]?.destination || null;
    if (!destination) return null;

    //
    // insert into mixin_payment_addresses as UNUSED
    //
    let now = Math.floor(Date.now() / 1000);
    let reserved_until = now + 30 * 60; // 1800

    let updated = await this.app.storage.runDatabase(
      `
        INSERT OR IGNORE INTO mixin_payment_addresses
          (reserved_by, asset_id, chain_id, address, created_at, reserved_until)
        VALUES
          ($reserved_by, $asset_id, $chain_id, $address, $now, $reserved_until);
      `,
      {
        $reserved_by: public_key,
        $asset_id: asset_id,
        $chain_id: chain_id,
        $address: destination,
        $now: now,
        $reserved_until: reserved_until,
      },
      'mixin'
    );

    console.log('updated:', updated);

    // Fetch back to get its id
    let row = await this.app.storage.queryDatabase(
      `
        SELECT id
        FROM mixin_payment_addresses
        WHERE reserved_by = $reserved_by
          AND asset_id   = $asset_id
          AND chain_id   = $chain_id
          AND address    = $address
        LIMIT 1;
      `,
      { $reserved_by: public_key, $asset_id: asset_id, $chain_id: chain_id, $address: destination },
      'mixin'
    );

    console.log('fetch back: ', row);

    if (!row || !row.length) return null;
    return { address: destination, address_id: row[0].id };
  }

  async reservePaymentAddressServer({
    public_key,
    asset_id,
    chain_id,
    address,
    address_id,
    amount,
    minutes,
    tx_serialized
  }) {
    try {
      if (!public_key || !asset_id || !chain_id || !address || !address_id || !amount || !minutes) {
        return { ok: false, error: 'missing_params' };
      }

      let now = Math.floor(Date.now() / 1000);

      //
      // create payment_request (status=reserved)
      //
      let reserved = await this.app.storage.runDatabase(
        `
          INSERT INTO mixin_payment_requests
            (requested_id,
             requested_by, amount, tx,
             tx, status, created_at, updated_at)
          VALUES
            ($requested_id, 
             $requested_by, $amount, $tx,
             $tx, 'unpaid', $now, $now);
        `,
        {
          $requested_id: address_id,
          $requested_by: public_key,
          $amount: String(amount),
          $tx: tx_serialized,
          $now: now
        },
        'mixin'
      );

      console.log('reserved db: ', reserved);

      //
      // grab autoincrement id
      //
      let last = await this.app.storage.queryDatabase(
        `SELECT last_insert_rowid() AS id;`,
        {},
        'mixin'
      );

      console.log('last: ', last);
      let request_id = last && last[0] ? last[0].id : null;
      if (!request_id) return { ok: false, error: 'no_request_id' };

      //
      // change address to reserved if still unused
      //
      // let update = await this.app.storage.runDatabase(
      //   `
      //     UPDATE mixin_payment_addresses
      //     SET status=1, reserved_at=$now, reserved_request=$request_id, updated_at=$now
      //     WHERE id=$address_id AND status=0;
      //   `,
      //   { $now: now, $request_id: request_id, $address_id: address_id },
      //   'mixin'
      // );

      // console.log('update: ', update);

      //
      // verify we have address against given request id
      //
      // let check = await this.app.storage.queryDatabase(
      //   `SELECT * FROM mixin_payment_addresses WHERE id=$id;`,
      //   { $id: address_id },
      //   'mixin'
      // );

      // console.log('check: ', check);
      // console.log('request_id: ', request_id);

      // if (
      //   !check ||
      //   !check.length ||
      //   check[0].status != 1
      //   //        check[0].reserved_request != request_id
      // ) {
      //   return { ok: false, error: 'address_not_available' };
      // }

      return { ok: true, request_id, address, minutes, expected_amount: String(amount) };
    } catch (e) {
      console.error('reservePaymentAddressServer error:', e);
      return { ok: false, error: 'reservation_failed' };
    }
  }

  //
  // to be called by loop every 30 mins
  //
  async releaseExpiredReservations() {
    let now = Math.floor(Date.now() / 1000);

    //
    // mark requests expired
    //
    await this.app.storage.runDatabase(
      `UPDATE payment_requests
       SET status='expired', updated_at=$now
       WHERE status='reserved' AND expires_at < $now`,
      { $now: now },
      'mixin'
    );

    //
    // free addresses whose reserved_request points to an expired request
    //
    await this.app.storage.runDatabase(
      `UPDATE mixin_payment_addresses
       SET status=0, reserved_at=NULL, reserved_request=NULL, updated_at=$now
       WHERE status=1
         AND reserved_request IN (
           SELECT id FROM payment_requests WHERE status='expired'
         )`,
      { $now: now },
      'mixin'
    );
  }

  async load() {
    if (this.app?.options?.mixin) {
      console.log('USING SAVED MIXIN USER ACCOUNT');
      this.mixin = this.app.options.mixin;
      if (this.mixin.user_id) {
        this.account_created = 1;

        //check if legacy user
        if (typeof this.mixin.pin_token_base64 != 'undefined') {
          await this.saveLegacy();
          this.account_created = 0;
          this.mixin = {};
          this.save();

          await this.app.wallet.setPreferredCrypto('SAITO', 1);
        }
      }
    }
  }

  async receiveCreatePurchaseAddress(app, tx_serialized, peer, callback = null) {
    try {
      console.log('inside receiveCreatePurchaseAddress ///');

      //
      // Temporary hardcoded (to be created by mixin)
      //
      let address = {
        destination: 'TRZiP1cLYxg8cgubEH6rGDoeXBgg4D4ZHN'
      };

      return callback ? callback(address) : address;
    } catch (e) {
      console.error('receiveCreatePurchaseAddress error:', e);
      let err = { ok: false, error: 'server_error' };
      return callback ? callback(err) : err;
    }
  }

  save() {
    this.app.options.mixin = this.mixin;
    this.app.storage.saveOptions();
  }

  async saveLegacy() {
    this.app.options.mixin_legacy = this.mixin;
    this.app.storage.saveOptions();
  }

  getEnv() {
    try {
      if (typeof process.env.MIXIN != 'undefined') {
        return JSON.parse(process.env.MIXIN);
      } else {
        // to develop locally please request a mixin key and add it as an
        // enviromnent variable 'MIXIN'
        return false;
      }
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = Mixin;
