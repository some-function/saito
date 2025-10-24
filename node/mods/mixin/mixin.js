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
      return await this.receiveCreateAccountTransaction(app, tx, peer, mycallback);
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

    //
    // backup 
    //
    if (message.request.includes('mixin backup')) {
      await this.saveMixinAccountData(
        message.data.account_hash,
        peer.publicKey,
        message.request.includes('reset')
      );
      if (mycallback) {
        mycallback();
      }
      return 1;
    }

    //
    // validation
    //
    if (message.request === 'mixin validation') {
      let db_results = await this.retrieveMixinAccountData(peer.publicKey);
      if (mycallback) {
        mycallback(db_results);
      }
      return 1;
    }

    //
    // web3 crypto payment
    //
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
              let accounts = {};
              for (let i = 0; i < res.length; i++) {
                const buf1 = Buffer.from(res[i].account_hash, 'base64');
                const buf2 = this.app.crypto.decryptWithPrivateKey(buf1, privateKey);

                accounts[buf2.toString('utf8')] = res[i].account_hash;
              }

              if (Object.keys(accounts).length > 1) {
                console.log(`Found ${res.length} mixin accounts...`);
                console.log('mixin: ', Object.keys(accounts).length, accounts);
                const account_to_keep = [];
                setTimeout(async () => {
                  let m;
                  for (let a in accounts) {
                    m = JSON.parse(a);
                    let user = MixinApi({
                      keystore: {
                        app_id: m.user_id,
                        session_id: m.session_id,
                        pin_token_base64: m.tip_key_base64,
                        session_private_key: m.session_seed
                      }
                    });

                    let snapshots = await user.safe.fetchSafeSnapshots({
                      limit: 100
                    });
                    if (snapshots.length > 0) {
                      account_to_keep.push(m);
                    }
                  }

                  // No more than one mixin account has any activity
                  if (account_to_keep.length < 2) {
                    if (account_to_keep.length == 1) {
                      this.mixin = account_to_keep[0];
                    } else {
                      this.mixin = m;
                    }
                    this.mixin.backed_up = true;

                    let input = Buffer.from(JSON.stringify(this.mixin), 'utf8');
                    let account_hash = this.app.crypto
                      .encryptWithPublicKey(input, this.publicKey)
                      .toString('base64');
                    this.app.network.sendRequestAsTransaction(
                      'mixin backup reset',
                      { account_hash },
                      () => {
                        console.log('Deleted superfluous remote mixin credentials');
                      },
                      peer.peerIndex
                    );
                    this.save();
                  } else {
                    salert(
                      'You have multiple active mixin (3rd party crypto) accounts associated with your Saito public key. Please reach out to the team for help resolving...'
                    );
                  }
                }, 1000);
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
    } else if (!this.bot) {
      console.error('Cannot process Mixin account request for peer');
      mycallback({ err: 'Cannot process Mixin account request for peer' });
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

  async saveMixinAccountData(data, pkey, delete_first = false) {
    if (delete_first) {
      let sql2 = `DELETE FROM mixin_accounts WHERE publickey = $publickey`;
      let params2 = {
        $publickey: pkey
      };

      let r = await this.app.storage.runDatabase(sql2, params2, 'mixin');
      console.log(`Mixin cleanup for ${pkey}: `, r);
    }

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

  //
  // main handler: now calls checkAddressPoolAvailability()
  // early-exits when pool is not available
  //
  async receiveRequestPaymentAddressTransaction(
    app,
    request_tx = null,
    peer = null,
    callback = null
  ) {
    try {
      //
      // init response
      //
      let res = { ok: false, err: '', add: null, data: null };

      //
      // validate request_tx
      //
      if (!request_tx) {
        res.err = 'missing_request_tx';
        return callback ? callback(res) : res;
      }
      if (typeof request_tx.returnMessage !== 'function') {
        res.err = 'invalid_request_tx';
        return callback ? callback(res) : res;
      }

      //
      // validate peer
      //
      if (!peer) {
        res.err = 'missing_peer';
        return callback ? callback(res) : res;
      }

      console.log('inside receiveRequestPaymentAddressTransaction 1 ///');
      let msg = request_tx.returnMessage();
      console.log(msg);

      //
      // key variables
      //
      let data = msg && msg.data ? msg.data : {};
      let buyer_publickey = data.public_key;
      let amount = data.amount;
      let reserved_minutes = 30;
      let ticker = data.ticker;
      let tx = data.tx;

      //
      // fallback to tx sender if public_key not provided
      //
      if (
        !buyer_publickey &&
        request_tx &&
        request_tx.from &&
        request_tx.from[0] &&
        request_tx.from[0].publicKey
      ) {
        buyer_publickey = request_tx.from[0].publicKey;
      }

      //
      // params check
      //
      if (!buyer_publickey || !amount || !ticker) {
        res.err = 'missing_params';
        return callback ? callback(res) : res;
      }

      console.log('inside receiveRequestPaymentAddressTransaction 2 ///');

      //
      // get asset_id, chain_id from ticker (for creating mixin address)
      //
      let mod =
        this.crypto_mods &&
        this.crypto_mods.find(
          (m) => (m && m.ticker ? m.ticker : '').toUpperCase() === (ticker || '').toUpperCase()
        );
      if (!mod) {
        res.err = 'unsupported_ticker';
        return callback ? callback(res) : res;
      }
      let asset_id = mod.asset_id;
      let chain_id = mod.chain_id;

      //
      // check pool availability using the new method
      //
      let pool = await this.checkAddressPoolAvailability({ asset_id, chain_id, limit: 50 });
      if (!pool.ok || pool.available !== true) {
        //
        // early exit when pool is exhausted
        //
        res.err = pool.err || 'address_not_available_in_pool';
        res.data = { asset_id, chain_id, total: pool.total, limit: pool.limit };
        return callback ? callback(res) : res;
      }

      console.log('inside receiveRequestPaymentAddressTransaction 3 ///');

      //
      // reserve or fetch existing payment address
      //
      let addr = await this.reservePaymentAddress({ buyer_publickey, asset_id, chain_id, ticker });
      console.log('address: ', addr);

      if (!addr || !addr.address || !addr.address_id) {
        res.err = 'address_pool_unavailable';
        res.data = { asset_id, chain_id };
        return callback ? callback(res) : res;
      }

      //
      // add payment request against reserved address (creates unpaid row)
      //
      let request = await this.createMixinPaymentRequest({
        buyer_publickey,
        asset_id,
        chain_id,
        ticker,
        address: addr.address,
        address_id: addr.address_id,
        amount,
        minutes: reserved_minutes,
        tx
      });

      //
      // return request error
      //
      if (!request || request.ok === false) {
        res.err = request && request.error ? request.error : 'reservation_failed';
        res.data = request || null;
        return callback ? callback(res) : res;
      }

      //
      // success payload
      //
      res.ok = true;
      res.err = '';
      res.add = {
        address: addr.address,
        address_id: addr.address_id,
        reserved_until: request.reserved_until || addr.reserved_until || null,
        minutes: request.minutes || reserved_minutes
      };
      res.data = {
        request_row_id: request.request_row_id,
        ticker,
        asset_id,
        chain_id,
        amount: String(amount),
        pool_total: pool.total,
        pool_limit: pool.limit
      };

      console.log('inside receiveRequestPaymentAddressTransaction 5 ///');
      return callback ? callback(res) : res;
    } catch (e) {
      //
      // unexpected failure
      //
      console.error('receiveRequestPaymentAddressTransaction error:', e);
      let res = { ok: false, err: 'server_error', add: null, data: null };
      return callback ? callback(res) : res;
    }
  }

  //
  // checks how many addresses exist for a given asset_id + chain_id
  // returns availability object with total count and limit gate
  //
  async checkAddressPoolAvailability({ asset_id, chain_id, limit = 50 }) {
    //
    // default response
    //
    let out = { ok: true, available: true, total: 0, limit: limit, err: '' };

    try {
      //
      // count total addresses in pool for this asset/chain
      //
      let rows = await this.app.storage.queryDatabase(
        `SELECT COUNT(*) AS cnt
           FROM mixin_payment_addresses
          WHERE asset_id = $asset_id
            AND chain_id = $chain_id;`,
        { $asset_id: asset_id, $chain_id: chain_id },
        'mixin'
      );

      let total = rows && rows[0] && Number(rows[0].cnt) ? Number(rows[0].cnt) : 0;
      out.total = total;

      //
      // mark unavailable if beyond limit
      //
      if (total > out.limit) {
        out.ok = false;
        out.available = false;
        out.err = 'address_pool_exhausted';
      }

      return out;
    } catch (e) {
      //
      // unexpected failure while checking pool
      //
      out.ok = false;
      out.available = false;
      out.err = 'pool_check_failed';
      return out;
    }
  }

  async reservePaymentAddress({ buyer_publickey, asset_id, chain_id, ticker, reserved_minutes }) {
    //
    // check if purchase address exist already
    // against asset_id, chain_id, buyer_publickey
    //
    let existing = await this.app.storage.queryDatabase(
      `SELECT id, address, reserved_until, created_at, ticker, asset_id, chain_id
       FROM mixin_payment_addresses
       WHERE reserved_by = $reserved_by
         AND asset_id    = $asset_id
         AND chain_id    = $chain_id
       ORDER BY created_at DESC
       LIMIT 1;`,
      { $reserved_by: buyer_publickey, $asset_id: asset_id, $chain_id: chain_id },
      'mixin'
    );

    console.log('existing: ', existing);

    //
    // if address exists return it
    //
    if (existing && existing.length > 0) {
      return existing[0];
    }

    //
    // if address doesnt exist, let mixin create one
    // (temporarily hardcoded)
    //
    // let created = await this.createDepositAddress(asset_id, chain_id, false);
    // if (!created || !created.length) return null;

    let created = [{ destination: 'TRZiP1cLYxg8cgubEH6rGDoeXBgg4D4ZHN' }];
    console.log('created:', created);

    let destination = created[0] ? created[0].destination : null;
    if (!destination) return null;

    //
    // insert newly created address into mixin_payment_addresses
    //
    let now = Math.floor(Date.now() / 1000);
    let reserved_until = now + reserved_minutes * 60;

    await this.app.storage.runDatabase(
      `INSERT OR IGNORE INTO mixin_payment_addresses
         (ticker, address, asset_id, chain_id, created_at, reserved_until, reserved_by)
       VALUES
         ($ticker, $address, $asset_id, $chain_id, $now, $reserved_until, $reserved_by);`,
      {
        $ticker: ticker || '',
        $address: destination,
        $asset_id: asset_id,
        $chain_id: chain_id,
        $now: now,
        $reserved_until: reserved_until,
        $reserved_by: buyer_publickey
      },
      'mixin'
    );

    //
    // verify address added successfully
    // and return address details
    //
    let row = await this.app.storage.queryDatabase(
      `SELECT * FROM mixin_payment_addresses
       WHERE address  = $address
         AND asset_id = $asset_id
         AND chain_id = $chain_id
       ORDER BY id DESC
       LIMIT 1;`,
      { $address: destination, $asset_id: asset_id, $chain_id: chain_id },
      'mixin'
    );

    console.log('fetch back: ', row);
    if (!row || !row.length) return null;

    return row[0];
  }

  async createMixinPaymentRequest({
    buyer_publickey,
    asset_id,
    chain_id,
    ticker,
    address,
    address_id,
    amount,
    reserved_minutes,
    tx
  }) {
    try {
      //
      // init return object
      //
      let res = {
        ok: false,
        err: '',
        request_row_id: null,
        address: address || null,
        address_id: address_id || null,
        ticker: ticker || null,
        asset_id: asset_id || null,
        chain_id: chain_id || null,
        reserved_until: null,
        remaining_minutes: 0,
        expected_amount: amount != null ? String(amount) : null
      };

      //
      // validate required inputs
      //
      if (!buyer_publickey || !asset_id || !chain_id || !address || !address_id || !amount) {
        res.err = 'missing_params';
        return res;
      }

      //
      // compute current time
      //
      let now = Math.floor(Date.now() / 1000);

      //
      // fetch current reservation window for this address
      //
      let cur = await this.app.storage.queryDatabase(
        `SELECT reserved_until
           FROM mixin_payment_addresses
          WHERE id = $id
          LIMIT 1;`,
        { $id: address_id },
        'mixin'
      );
      if (!cur || !cur.length) {
        res.err = 'address_not_found';
        return res;
      }

      let current_until = cur[0].reserved_until || 0;
      let reserved_until = current_until;

      //
      // extend reservation only if expired (avoid refreshing on page reload)
      //
      if (current_until <= now) {
        reserved_until = now + reserved_minutes * 60;
        await this.app.storage.runDatabase(
          `UPDATE mixin_payment_addresses
             SET reserved_until = $reserved_until
           WHERE id = $id;`,
          { $reserved_until: reserved_until, $id: address_id },
          'mixin'
        );
      }

      //
      // insert an unpaid payment request linked to this address
      //
      await this.app.storage.runDatabase(
        `INSERT INTO mixin_payment_requests
           (address_id, requested_by, amount, tx, status, created_at, updated_at)
         VALUES
           ($address_id, $requested_by, $amount, $tx, 'unpaid', $now, $now);`,
        {
          $address_id: address_id,
          $requested_by: buyer_publickey,
          $amount: String(amount),
          $tx: tx || '',
          $now: now
        },
        'mixin'
      );

      //
      // fetch the inserted id via last_insert_rowid()
      //
      let last = await this.app.storage.queryDatabase(
        `SELECT last_insert_rowid() AS id;`,
        {},
        'mixin'
      );
      let request_row_id = last && last[0] ? last[0].id : null;
      if (!request_row_id) {
        res.err = 'no_request_id';
        return res;
      }

      //
      // compute remaining minutes if not refreshed; otherwise reserved_minutes
      //
      let minutes_remaining = Math.max(0, Math.ceil((reserved_until - now) / 60));
      let remaining_minutes = current_until <= now ? reserved_minutes : minutes_remaining;

      //
      // success payload
      //
      res.ok = true;
      res.err = '';
      res.request_row_id = request_row_id;
      res.address = address;
      res.address_id = address_id;
      res.ticker = ticker;
      res.asset_id = asset_id;
      res.chain_id = chain_id;
      res.reserved_until = reserved_until;
      res.remaining_minutes = remaining_minutes;
      res.expected_amount = String(amount);

      return res;
    } catch (e) {
      //
      // unexpected failure
      //
      console.error('createMixinPaymentRequest error:', e);
      let res = { ok: false, err: 'reservation_failed', row: null };
      return res;
    }
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
