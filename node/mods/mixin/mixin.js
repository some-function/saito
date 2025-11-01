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


//
// Mixin Module
//
// Mixin is an infrastructure / API provider for multiple cryptocurrency wallets. Thie Saito
// modules provides integration with their backend API to various Saito modules, permitting 
// users to store and use Mixin-held cryptocurrencies on the network as with other crypto-
// modules like DOT.
//
// In addition to integrating with the Saito Wallet. This module also offers functionality 
// that allows Saito nodes to collect payment in non-SAITO cryptocurrencies, by supporting
// their ability to automatically collect non-SAITO cryptos and exchange them for SAITO in
// real-time. This powers the "buy with other crypto" functionality in the Saito Store and
// in the "buysaito" app.
//
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
    // wallets will contain
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
    this.deposit_interval = new Map(); // key: address, val: { timer, peerIndex, ... }

    //
    // these variables control payments
    //
    this.minutes_to_reserve_payment_address = 30;
    this.maximum_reservable_payment_addresses = 50;

    //
    // payment monitoring polling loops
    //
    //this.monitor_payments_polling_loop = null;
    //this.send_payments_polling_loop = null;

  }

  //  
  // returnServices  
  //  
  // Mixin service allows nodes and browsers which connect to this device to create
  // wallets using the Mixin API key of this node. This service is necessary since
  // requests for account creation must be linked to an existing API-key, and fee-free
  // transfers within Saito are possible between wallets that were created with the 
  // same API-key.
  //  
  returnServices() {
    this.services = [];
    if (this.bot) {
      this.services.push(new PeerService(null, 'mixin'));
    }
    return this.services;
  }


  //
  // initialize
  //
  // the information needed to access Mixin through its API requires data that is
  // stored in the ENV of the server that is running Saito. On initialization we
  // fetch this information and put it into the "this.bot" variable.
  //
  async initialize(app) {

    await super.initialize(app);
    await this.load();

    if (!app.BROWSER) {
      if (!this.bot) {

 	let m = null;

        try {
          if (typeof process.env.MIXIN != 'undefined') {
            m = JSON.parse(process.env.MIXIN);
          }
	} catch (err) {}

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


  //
  // off-chain requests
  //
  async handlePeerTransaction(app, tx = null, peer, mycallback = null) {

    if (tx == null) {
      return 0;
    }

    let message = tx.returnMessage();

    //
    // requests to create accounts
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
      if (mycallback) { mycallback(db_results); }
      return 1;
    }

    if (message.request === 'mixin request payment address') {
      await this.createAccount(); // skips if created
      if (!account_created) { return mycallback({}); }
      return await this.receiveRequestPaymentAddressTransaction(app, tx, peer, mycallback);
    }

    if (message.request === 'mixin fetch pending deposit') {
      return await this.receiveFetchPendingDepositTransaction(app, tx, peer, mycallback);
    }

    if (message.request === 'mixin save payment receipt') {
      return await this.receiveSavePaymentReceipt(app, tx, peer, mycallback);
    }

    if (message.request === 'mixin list payment receipts') {
      return await this.receiveListPaymentReceipts(app, tx, peer, mycallback);
    }

    if (message.request === 'mixin issue purchased saito') {
      return await this.receiveIssuePurchasedSaito(app, tx, peer, mycallback);
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

      console.log('Mixin Module: API online!');
      this.mixin_peer = peer;

      if (this.mixin.user_id) {
        if (this.mixin.backed_up) {

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

                  if (account_to_keep.length < 2) {
                    if (account_to_keep.length == 1) {
                      this.mixin = account_to_keep[0];
                    } else {
                      this.mixin = m;
                    }
                    this.mixin.backed_up = true;

                    let input = Buffer.from(JSON.stringify(this.mixin), 'utf8');
                    let account_hash = this.app.crypto.encryptWithPublicKey(input, this.publicKey).toString('base64');

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
                    salert('ERROR: You have multiple active Mixin accounts associated with your Saito Mixin module....');
                  }
                }, 1000);
              }
            },
            peer.peerIndex
          );
        } else {
          let input = Buffer.from(JSON.stringify(this.mixin), 'utf8');
          let account_hash = this.app.crypto.encryptWithPublicKey(input, this.publicKey).toString('base64');

          this.app.network.sendRequestAsTransaction(
            'mixin backup',
            { account_hash },
            () => {
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

    if (db_results?.length > 0) {
      rtn_obj.res = db_results[0].account_hash;
      rtn_obj.restored = true;
    } else if (!this.bot) {
      Object.assign(rtn_obj, { err: 'Cannot process Mixin account request for peer' });
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

      let address = await user.safe.createDeposit(chain_id);

      if (save) {
        if (typeof address[0].destination != 'undefined') {
          for (let i = 0; i < this.crypto_mods.length; i++) {
            if (this.crypto_mods[i].asset_id === asset_id) {

              this.crypto_mods[i].address = address[0].destination;
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
  // receiveRequestPaymentAddressTransaction
  //
  // users request to make payments in non-SAITO cryptocurrencies by sending a request
  // that is received off-chain. this function processes these requests (sent as txs) 
  // by attempting to reserve an existing-and-non-reserved payment address within our 
  // account.
  //
  // if we cannot find a free account, we will create one and reserve it automatically 
  // for the user until we hit our limit on the number of accounts that we will create
  // for payments, which is hardcoded.
  //
  // the transaction contains instructions on how to fulfill the payment request, so
  // in addition to providing a payment address, we save the payment request so that 
  // it can be fulfilled after payment has been received.
  //
  async receiveRequestPaymentAddressTransaction(
    app,
    request_tx = null,
    peer = null,
    callback = null
  ) {
    try {

      //
      // response object (for user)
      //
      let res = { ok: false, err: '', address: null, request: null, pool: null };

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

      //
      // extract payment request info from transaction
      //
      let msg = request_tx.returnMessage();
      let data = msg && msg.data ? msg.data : {};
      let amount = data.amount;
      let reserved_minutes = this.minutes_to_reserve_payment_address;
      let ticker = data.ticker;
      let tx = data.tx;
      let buyer_publickey = data.publickey;

      //
      // if the buyer is not specified in this transaction, we treat the sender of the 
      // transaction as the buyer. this is simply to ensure that we have an address to 
      // connect with the purchase.
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
      // sanity check
      //
      if (!buyer_publickey || !amount || !ticker) {
        res.err = 'missing_params';
        return callback ? callback(res) : res;
      }

      //
      // get asset_id, chain_id from ticker (for creating mixin address)
      //
      let mod = this.crypto_mods && this.crypto_mods.find((m) => (m && m.ticker ? m.ticker : '').toUpperCase() === (ticker || '').toUpperCase());
      if (!mod) {
        res.err = 'unsupported_ticker';
        return callback ? callback(res) : res;
      }
      let asset_id = mod.asset_id;
      let chain_id = mod.chain_id;

      //
      // at this point we have the information needed from the buyer, such as their SAITO
      // address and the amount of SAITO they wish to purchase and the instructions they 
      // have provided on what to do with teh SAITO after purchase. And we have the
      // information needed about the Mixin-supported crypto that we are using to make
      // the purchase.
      //
      // we proceed to try and reserve a payment address
      //
      // this will either result in a successful reservation, in which case the reserved
      // address is returned to us, or a failure in which case no address will be provided
      // and we can return an error message to the user.
      //
      let addr = await this.reservePaymentAddress({ buyer_publickey, asset_id, chain_id, ticker });

      //
      // exit if unsuccessful
      //
      if (!addr || !addr.address || !addr.id) {
        res.err = 'address_pool_unavailable';
        res.data = { asset_id, chain_id };
        return callback ? callback(res) : res;
      }

      //
      // we now save the details of this payment request, including the reserved address (unpaid row)
      //
      let request = await this.createMixinPaymentRequest({
        buyer_publickey,
        asset_id,
        chain_id,
        ticker,
        address: addr.address,
        address_id: addr.id,
        amount,
        reserved_minutes,
        tx
      });

console.log("payment request reserved!");

console.log("REQUEST? " + JSON.stringify(request));

      //
      // if there is an error inserting the payment request for any reason, we want to return an error
      // message to the user so that they do not attempt payment to an address that we control, but 
      // which will result in a failure to fulfill payment, because of a missing entry from our DB.
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
      res.address = addr;
      res.request = {
        id: request.id,
        reserved_until: request.reserved_until,
        remaining_minutes: request.remaining_minutes,
        expected_amount: request.expected_amount,
      };
      res.pool = {
        ticker: ticker,
      };

      return callback ? callback(res) : res;

    } catch (e) {

console.log("SERVER ERROR: " + JSON.stringify(e));

      //
      // unexpected failure
      //
      let res = { ok: false, err: 'server_error', add: null, data: null };
      return callback ? callback(res) : res;

    }

  }


  //
  // reservePaymentAddress
  //
  // this function is triggered when a request for payment in a Mixin-supported crypto is 
  // received. if the purchase request is from a specific user and an address is already 
  // reserved by that user, we return the same address and simply extend the time-period 
  // for which the address is reserved. this can happen if a user attempts to make a purchase
  // and then reloads their browser and tries again.
  //
  // if there is no address associated with this account, we try to provide them with an 
  // existing address that *was* reserved but where the reservation has already expired.
  //
  // if there is no address that has already expired, we will create a new address if the
  // total number of addresses we have already is less than the maximum limit specified 
  // by our configuration vars. This limit is intended to avoid DDOS attacks on the payment
  // provider. In a worst case scenario it becomes difficult to reserve an address, but the
  // payment system will not collapse under load.
  //
  async reservePaymentAddress({ buyer_publickey, asset_id, chain_id, ticker, reserved_minutes }) {

console.log("###############################");
console.log("### RESERVE PAYMENT ADDRESS ###");
console.log("###############################");

    //
    // check to see if an address is already reserved by this user
    //
    // extend reservation if so
    //
    let existing_reserved_addresses = await this.app.storage.queryDatabase(
      `SELECT * FROM mixin_payment_addresses
       WHERE reserved_by = $reserved_by
         AND asset_id    = $asset_id
         AND chain_id    = $chain_id
       ORDER BY created_at DESC
       LIMIT 1;`,
      { $reserved_by: buyer_publickey, $asset_id: asset_id, $chain_id: chain_id },
      'mixin'
    );

    if (existing_reserved_addresses && existing_reserved_addresses.length > 0) {

console.log("reserved address exists: " + JSON.stringify(existing_reserved_addresses));

      let reserved_until = Date.now() + (this.minutes_to_reserve_payment_address * 60 * 1000);
      await this.app.storage.runDatabase(
        `UPDATE mixin_payment_addresses SET reserved_until = $reserved_until WHERE id = $id;`,
        { $reserved_until: reserved_until, $id: existing_reserved_addresses[0].id },
        'mixin'
      );
console.log("returning first item...");
      return existing_reserved_addresses[0];
    }

console.log("###  ");
console.log("### 2");
console.log("###  ");

    //
    // otherwise, look for an available address...
    //
    // and reserve it
    //
    let reservable_addresses = await this.app.storage.queryDatabase(
      `SELECT * FROM mixin_payment_addresses
       WHERE reserved_until < $current_time
         AND asset_id    = $asset_id
         AND chain_id    = $chain_id
       ORDER BY created_at DESC
       LIMIT 1;`,
      { $current_time : Date.now() , $asset_id: asset_id, $chain_id: chain_id },
      'mixin'
    );

    if (reservable_addresses && reservable_addresses.length > 0) {
      let reserved_until = Date.now() + (this.minutes_to_reserve_payment_address * 60 * 1000);
      await this.app.storage.runDatabase(
        `UPDATE mixin_payment_addresses SET reserved_by = $reserved_by , reserved_until = $reserved_until WHERE id = $id;`,
        { $reserved_until: reserved_until, $reserved_by : buyer_publickey , $id: reservable_addresses[0].id },
        'mixin'
      );
      return reservable_addresses[0];
    }

console.log("###  ");
console.log("### 3");
console.log("###  ");

    //
    // otherwise, no address is free / available
    //
    // so try to create a new one
    //
    let number_of_existing_addresses = await this.app.storage.queryDatabase(
      `SELECT count(*) AS count FROM mixin_payment_addresses
         WHERE asset_id    = $asset_id
         AND chain_id    = $chain_id
      ;`,
      { $asset_id: asset_id, $chain_id: chain_id },
      'mixin'
    );

console.log("###  ");
console.log("### 4");
console.log("###  ");

console.log("number of existing addresses? " + JSON.stringify(number_of_existing_addresses));

    if (number_of_existing_addresses && number_of_existing_addresses.length > 0) {
    
    }

return;

    let created = await this.createDepositAddress(asset_id, chain_id, false);
    if (!created || !created.length) { return null; }

    let destination = created[0] ? created[0].destination : null;
    if (!destination) { return null; }

    //
    // insert new address into mixin_payment_addresses
    //
    let minutesNum = Number.isFinite(+reserved_minutes) ? +reserved_minutes : 15;
    let now = Date.now();
    let reserved_until = now + (minutesNum * 60 * 1000);

    if (!buyer_publickey) { console.error('reserved_by missing'); return null; }

    console.log('insert-binds', {
      $ticker: ticker || '',
      $address: destination,
      $asset_id: asset_id,
      $chain_id: chain_id,
      $now: Math.floor(Date.now() / 1000),          
      $reserved_until: reserved_until,
      $reserved_by: buyer_publickey,
    });


    let insert = await this.app.storage.runDatabase(
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

    console.log("insert: ", insert);

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

      console.log("createMixinPaymentRequest 1 ////");

      //
      // validate required inputs
      //
      if (!buyer_publickey || !asset_id || !chain_id || !address || !address_id || !amount) {
        res.err = 'missing_params';
        return res;
      }

      console.log("createMixinPaymentRequest 2 ////");

      //
      // compute current time
      //
      let now = Date.now();

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

      console.log("current reservation window: ", cur);

      let current_until = Number(cur[0].reserved_until) || 0;
      let reserved_until = current_until;

      console.log("now: ", now);
      console.log("reserved_until:", reserved_until);

      //
      // extend reservation only if expired (avoid refreshing on page reload)
      //
      if (current_until <= now) {
        reserved_until = now + (reserved_minutes * 60 * 1000);

        console.log("address reservation time expired, updating it..");
        console.log("updated reserved_until:", reserved_until);
        let extend = await this.app.storage.runDatabase(
          `UPDATE mixin_payment_addresses
             SET reserved_until = $reserved_until
           WHERE id = $id;`,
          { $reserved_until: reserved_until, $id: address_id },
          'mixin'
        );

        console.log("extend: ", extend);
      }

      //
      // insert an unpaid payment request linked to this address
      //
      let insert = await this.app.storage.runDatabase(
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

      console.log("insert: ", insert);

      //
      // fetch the inserted id via last_insert_rowid()
      //
      let last = await this.app.storage.queryDatabase(
        `SELECT last_insert_rowid() AS id;`,
        {},
        'mixin'
      );

      console.log("last insert row: ", last);

      let request_row_id = last && last[0] ? last[0].id : null;
      if (!request_row_id) {
        res.err = 'no_request_id';
        return res;
      }

console.log("before compute remaining minutes...");

      //
      // compute remaining minutes if not refreshed; otherwise reserved_minutes
      //
      let minutes_remaining = Math.max(0, Math.ceil((reserved_until - now) / (60 * 1000)));
      let remaining_minutes = (current_until <= now) ? reserved_minutes : minutes_remaining;

console.log("before success payload...");

      //
      // success payload
      //
      res.ok = true;
      res.err = '';
      res.id = request_row_id;
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

  async receiveFetchPendingDepositTransaction(app, tx, peer, mycallback) {
    try {
      //
      // validate tx
      //
      if (!tx) {
        return mycallback?.({ ok: false, err: 'missing_tx' });
      }
      if (typeof tx.returnMessage !== 'function') {
        return mycallback?.({ ok: false, err: 'invalid_request' });
      }

      console.log('[pending][recv] enter receiveFetchPendingDepositTransaction');
      if (!tx || typeof tx.returnMessage !== 'function') {
        console.log('[pending][recv] invalid tx / missing returnMessage');
        return mycallback?.({ ok: false, err: 'invalid_request' });
      }
      if (!peer) {
        console.log('[pending][recv] missing peer');
        return mycallback?.({ ok: false, err: 'missing_peer' });
      }

      //
      // parse request payload
      //
      const msg = tx.returnMessage();
      const d = (msg && msg.data) || {};
      const asset_id        = d.asset_id;
      const address         = d.address;
      const expected_amount = parseFloat(d.expected_amount || '0');
      const reserved_until  = +d.reserved_until || 0;
      const ticker          = (d.ticker || '').toUpperCase();
      console.log('[pending][recv] parsed payload:', {
        asset_id, address, expected_amount, reserved_until, ticker,
        reserved_until_iso: reserved_until ? new Date(reserved_until).toISOString() : null
      });

      //
      // check required params
      //
      if (!asset_id || !address || !reserved_until) {
        console.log('[pending][recv] missing required params');
        return mycallback?.({ ok: false, err: 'missing_params' });
      }

      //
      // ensure single watcher per address
      //
      console.log('[pending][recv] checking existing watcher for', address);
      const existing = this.deposit_interval.get(address);
      if (existing && existing.timer) {
        console.log('[pending][recv] existing watcher found — clearing interval');
        clearInterval(existing.timer);
        this.deposit_interval.delete(address);
      } else {
        console.log('[pending][recv] no existing watcher for', address);
      }

      //
      // configure polling parameters
      //
      const poll_every_ms = 5000;   // temporary for testing (should be 1m, 3m, 5m, 8m...)
      const eps = expected_amount * 0.001; // 0.1% tolerance
      console.log('[pending][recv] poll_every_ms:', poll_every_ms, 'eps:', eps);

      //
      // define polling function
      //
      const runCheck = async () => {
        console.log('[pending][check] tick — now:', new Date().toISOString());

        //
        // expire first
        //
        if (reserved_until && Date.now() > reserved_until) {
          console.log('[pending][check] window expired — stopping watcher');
          clearInterval(entry.timer);
          this.deposit_interval.delete(address);
          return entry.mycallback?.({ ok: true, status: 'expired' });
        }

        //
        // ask mixin for pending deposits
        //
        console.log('[pending][check] calling fetchPendingDeposits', { asset_id, address });
        this.fetchPendingDeposits(asset_id, address, (rows) => {
          try {
            console.log('[pending][check] fetchPendingDeposits returned rows:', Array.isArray(rows) ? rows.length : 'non-array');

            //
            // hardcoded for local testing
            //
            // rows = [
            //   {
            //     amount: "1",
            //     state: "pending",
            //     confirmations: 23,
            //   }
            // ]

            //
            // no pending deposits yet
            //
            if (!Array.isArray(rows) || rows.length === 0) {
              console.log('[pending][check] no rows yet — continue polling');
              return;
            }

            //
            // sum all amounts
            //
            const total = rows.reduce((a, r) => a + parseFloat(r?.amount || '0'), 0);
            console.log('[pending][check] total pending amount:', total, 'expected:', expected_amount);

            //
            // decide whether paid
            //
            const isPaid = expected_amount === 0 ? total > 0 : (total + eps >= expected_amount);
            console.log('[pending][check] isPaid:', isPaid, 'eps:', eps);

            //
            // success: clear interval and return callback
            //
            if (isPaid) {
              console.log('[pending][check] payment detected — clearing watcher and responding');
              clearInterval(entry.timer);
              this.deposit_interval.delete(address);
              return entry.mycallback?.({
                ok: true,
                status: 'confirmed',
                ticker,
                address,
                total_amount: String(total),
                rows
              });
            }

            //
            // still not enough — keep polling
            //
            console.log('[pending][check] below expected — keep polling');
          } catch (e) {
            console.error('[pending][check] parse error:', e);
          }
        });
      };

      //
      // register watcher entry
      //
      console.log('[pending][recv] registering watcher entry for', address);
      const entry = {
        timer: null,
        peerIndex: peer.peerIndex,
        mycallback,
        created_at: Date.now(),
        address,
        asset_id,
        expected_amount,
        reserved_until
      };
      this.deposit_interval.set(address, entry);

      //
      // prime first check and schedule interval
      //
      console.log('[pending][recv] priming first check immediately');
      await runCheck();
      console.log('[pending][recv] scheduling interval every', poll_every_ms, 'ms');
      entry.timer = setInterval(runCheck, poll_every_ms);

      //
      // return 1 so the network layer knows we handled it
      //
      console.log('[pending][recv] watcher armed — returning 1');
      return 1;
    } catch (err) {
      //
      // unexpected failure
      //
      console.error('receiveFetchPendingDepositTransaction error:', err);
      return mycallback?.({ ok: false, err: 'server_error' });
    }
  }


  async receiveSavePaymentReceipt(app, tx, peer, callback = null) {
    try {
      //
      // validate tx
      //
      if (!tx) {
        return mycallback?.({ ok: false, err: 'missing_tx' });
      }
      if (typeof tx.returnMessage !== 'function') {
        return mycallback?.({ ok: false, err: 'invalid_request' });
      }

      const message = tx.returnMessage();
      const d = message.data || {};

      //
      // validation
      //
      const required = ['request_id', 'address_id', 'recipient_pubkey', 'status'];
      for (let k of required) {
        if (typeof d[k] === 'undefined' || d[k] === null) {
          const err = `missing_field_${k}`;
          if (callback) return callback({ ok: false, err });
          return { ok: false, err };
        }
      }

      const created_at = tx.timestamp;
      const updated_at = tx.timestamp;

      const sql = `
        INSERT INTO mixin_payment_receipts
          (request_id, address_id, recipient_pubkey, issued_amount, status, reason, tx, created_at, updated_at)
        VALUES
          ($request_id, $address_id, $recipient_pubkey, $issued_amount, $status, $reason, $tx, $created_at, $updated_at);
      `;

      const params = {
        $request_id:       d.request_id,
        $address_id:       d.address_id,
        $recipient_pubkey: d.recipient_pubkey,
        $issued_amount:    (d.issued_amount ?? '').toString(),
        $status:           d.status,            // pending|issuing|succeeded|failed|cancelled
        $reason:           d.reason ?? '',
        $tx:               d.tx ?? '',
        $created_at:       created_at,
        $updated_at:       updated_at
      };

      const result = await this.app.storage.runDatabase(sql, params, 'mixin'); // same pattern as other inserts :contentReference[oaicite:3]{index=3}
      const res = { ok: true, id: result?.lastInsertRowid ?? null };

      if (callback) return callback(res);
      return res;
    } catch (e) {
      console.error('receiveSavePaymentReceipt error:', e);
      const err = { ok: false, err: 'db_insert_error' };
      if (callback) return callback(err);
      return err;
    }
  }

  async receiveListPaymentReceipts(app, tx, peer, callback = null) {
    try {
      //
      // validate tx
      //
      if (!tx) {
        return mycallback?.({ ok: false, err: 'missing_tx' });
      }
      if (typeof tx.returnMessage !== 'function') {
        return mycallback?.({ ok: false, err: 'invalid_request' });
      }

      const msg = tx.returnMessage();
      const d = (msg && msg.data) || {};

      //
      // filters 
      //
      const {
        id,
        request_id,
        address_id,
        recipient_pubkey,
        status,               // 'pending'|'issuing'|'succeeded'|'failed'|'cancelled'
        created_after,        // unix ms (inclusive)
        created_before,       // unix ms (exclusive)
        limit = 200,          // sane cap
        offset = 0,
        order = 'DESC'        // 'ASC' or 'DESC' on created_at
      } = d;

      const where = [];
      const params = {};

      if (id != null)               { where.push('id = $id');                       params.$id = id; }
      if (request_id != null)       { where.push('request_id = $request_id');       params.$request_id = request_id; }
      if (address_id != null)       { where.push('address_id = $address_id');       params.$address_id = address_id; }
      if (recipient_pubkey)         { where.push('recipient_pubkey = $recipient');  params.$recipient = recipient_pubkey; }
      if (status)                   { where.push('status = $status');               params.$status = status; }
      if (created_after != null)    { where.push('created_at >= $created_after');   params.$created_after = created_after; }
      if (created_before != null)   { where.push('created_at <  $created_before');  params.$created_before = created_before; }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const ord = (String(order).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
      const lim = Number.isFinite(+limit) ? Math.max(1, Math.min(1000, +limit)) : 200;
      const off = Number.isFinite(+offset) ? Math.max(0, +offset) : 0;

      const sql = `
        SELECT
          id, request_id, address_id, recipient_pubkey, issued_amount,
          status, reason, tx, created_at, updated_at
        FROM mixin_payment_receipts
        ${whereSql}
        ORDER BY created_at ${ord}, id ${ord}
        LIMIT ${lim} OFFSET ${off};
      `;

      const rows = await this.app.storage.queryDatabase(sql, params, 'mixin');
      const res = { ok: true, rows: rows || [] };
      return callback ? callback(res) : res;

    } catch (err) {
      console.error('receiveListPaymentReceipts error:', err);
      const res = { ok: false, err: 'db_query_error' };
      return callback ? callback(res) : res;
    }
  }

  //
  // issue saito against "pending" receipts
  // 
  async receiveIssuePurchasedSaito(app, tx, peer, callback = null) {
    try {
      //
      // validate tx
      //
      console.log('[issuePurchasedSaito] start - validating tx');
      if (!tx) {
        console.log('[issuePurchasedSaito] validation failed: missing_tx');
        return mycallback?.({ ok: false, err: 'missing_tx' });
      }
      if (typeof tx.returnMessage !== 'function') {
        console.log('[issuePurchasedSaito] validation failed: invalid_request (no returnMessage)');
        return mycallback?.({ ok: false, err: 'invalid_request' });
      }

      const msg = tx.returnMessage();
      console.log('[issuePurchasedSaito] message extracted');
      const d = (msg && msg.data) || {};
      const rows = Array.isArray(d.rows) ? d.rows : [];
      console.log('[issuePurchasedSaito] rows received:', rows.length);

      //
      // validation
      //
      if (rows.length === 0) {
        console.log('[issuePurchasedSaito] no_rows to process');
        const res = { ok: false, err: 'no_rows' };
        return callback ? callback(res) : res;
      }

      const results = [];
      console.log('[issuePurchasedSaito] processing rows...');

      //
      // process each pending row
      //
      for (let i = 0; i < rows.length; i++) {
        const item = rows[i] || {};
        const rowId = item.id;
        console.log(`[#${i}] rowId=${rowId} - begin`);

        //
        // verify if payment is "pending" in DB
        //
        console.log(`[#${i}] querying DB for rowId=${rowId}`);
        const dbRows = await this.app.storage.queryDatabase(
          `
            SELECT id, recipient_pubkey, issued_amount, status
            FROM mixin_payment_receipts
            WHERE id = $id
            LIMIT 1;
          `,
          { $id: rowId },
          'mixin'
        );
        console.log(`[#${i}] dbRows length:`, dbRows?.length || 0);

        if (!dbRows || dbRows.length === 0) {
          console.log(`[#${i}] not_found in DB for id=${rowId}`);
          results.push({ id: rowId, ok: false, err: 'not_found' });
          continue;
        }

        const r = dbRows[0];
        console.log(`[#${i}] dbRow status=${r.status}, recipient=${r.recipient_pubkey}`);

        //
        // must be "pending"
        //
        if (r.status !== 'pending') {
          console.log(`[#${i}] invalid_status: ${r.status}`);
          results.push({ id: r.id, ok: false, err: `invalid_status_${r.status}` });
          continue;
        }

        //
        // validate issued_amount (prefer server, fallback to client)
        //
        const issued_amount_text = (r.issued_amount ?? item.issued_amount ?? '').toString().trim();
        console.log(`[#${i}] issued_amount_text='${issued_amount_text}'`);
        if (!issued_amount_text) {
          console.log(`[#${i}] missing_issued_amount`);
          results.push({ id: r.id, ok: false, err: 'missing_issued_amount' });
          continue;
        }

        let issued_amt_num = 0;
        try {
          issued_amt_num = parseFloat(issued_amount_text);
        } catch (e) {
          // keep 0
        }
        console.log(`[#${i}] parsed issued_amt_num=`, issued_amt_num);
        if (!Number.isFinite(issued_amt_num) || issued_amt_num <= 0) {
          console.log(`[#${i}] invalid_issued_amount`);
          results.push({ id: r.id, ok: false, err: 'invalid_issued_amount' });
          continue;
        }

        //
        // validate recipient
        //
        const recipient = r.recipient_pubkey || item.recipient_pubkey || '';
        console.log(`[#${i}] recipient='${recipient}'`);
        if (!recipient) {
          console.log(`[#${i}] missing_recipient_pubkey`);
          results.push({ id: r.id, ok: false, err: 'missing_recipient_pubkey' });
          continue;
        }

        //
        // Check if server has enough balance to process issuance 
        //
        console.log(`[#${i}] fetching server SAITO balance`);
        let server_balance_saito = this.app.wallet.returnBalance('SAITO');
        let server_balance_nolan = BigInt(this.app.wallet.convertSaitoToNolan(server_balance_saito));
        const nolan_amount_required = BigInt(this.app.wallet.convertSaitoToNolan(issued_amount_text));
        console.log(
          `[#${i}] server_balance_saito=${server_balance_saito} server_balance_nolan=${server_balance_nolan.toString()} nolan_needed=${nolan_amount_required.toString()}`
        );

        if (server_balance_nolan < nolan_amount_required) {
          console.log(`[#${i}] insufficient_server_balance for this row — skipping`);
          results.push({
            id: r.id,
            ok: false,
            err: 'insufficient_server_balance',
            server_balance_nolan: server_balance_nolan.toString(),
            row_nolan_needed: nolan_amount_required.toString(),
          });
          continue;
        }

        //
        // send SAITO to recipient
        //
        let sendOk = false;
        let sendErr = '';

        try {
          console.log(`[#${i}] preparing send - create+sign+propagate`);
          let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(
            recipient,
            nolan_amount_required
          );

          newtx.msg = {
            request: 'saito purchase',
            from: this.publicKey,
            to: recipient,
          };

          newtx.packData();
          await newtx.sign();
          await this.app.network.propagateTransaction(newtx);

          console.log(`[#${i}] send success`);
          sendOk = true;
        } catch (e) {
          sendOk = false;
          sendErr = e?.message || 'send_failed';
          console.log(`[#${i}] send failed:`, sendErr);
        }

        if (!sendOk) {
          results.push({ id: r.id, ok: false, err: sendErr || 'send_failed' });
          continue;
        }

        //
        // update status -> 'issuing'
        // will be marked "successful" when send saito tx 
        // is verified inside onConfirmation()
        //
        console.log(`[#${i}] updating DB status -> 'issuing' for id=${r.id}`);
        const now = tx.timestamp || Date.now();
        const upd = await this.app.storage.runDatabase(
          `
            UPDATE mixin_payment_receipts
               SET status = 'issuing',
                   updated_at = $now
             WHERE id = $id
               AND status = 'pending';
          `,
          { $id: r.id, $now: now },
          'mixin'
        );
        console.log(`[#${i}] DB update result:`, upd);

        //
        // verify row was actually updated
        //
        const changed = upd && (upd.changes > 0);
        console.log(`[#${i}] update changed=${changed}`);
        results.push({ id: r.id, ok: changed, status: changed ? 'issuing' : 'pending' });

        console.log(`[#${i}] rowId=${rowId} - done`);
      }

      //
      // return callbackback with response
      //
      const res = { ok: true, results };
      console.log('[issuePurchasedSaito] complete - returning results');
      return callback ? callback(res) : res;
    } catch (err) {
      console.error('receiveIssuePurchasedSaito error:', err);
      const res = { ok: false, err: 'server_error' };
      return callback ? callback(res) : res;
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

}

module.exports = Mixin;
