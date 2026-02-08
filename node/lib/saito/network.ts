import Transaction from "./transaction";
import Peer from "./peer";
import S from "saito-js/saito";
import {App} from "./app";
import PeerService from "saito-js/lib/peer_service";


export default class Network {
  callbacks = [];
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  initialize() {
    console.debug("[DEBUG] initialize network");
  }

  public async propagateTransaction(tx:Transaction) {
    return S.getInstance().propagateTransaction(tx);
  }

  public async getPeers(): Promise<Array<Peer>> {
    return S.getInstance().getPeers();
  }

  public async getPeer(index:bigint): Promise<Peer> {
    return S.getInstance().getPeer(index);
  }

  public async sendRequest(message:string, data:any="", callback:null, peer:Peer=null, signature_required=false) {
    return S.getInstance().sendRequest(message, data, callback, peer ? peer.peerIndex : undefined, signature_required);
  }

  public async sendTransactionWithCallback(transaction:Transaction, callback?:any, peerIndex?:bigint) {
    return S.getInstance().sendTransactionWithCallback(transaction, callback, peerIndex);
  }

  public async sendRequestAsTransaction(message:string, data:any="", peerIndex?:bigint, signature_required?:boolean) {
    return new Promise((resolve) => { S.getInstance().sendRequest(message, data, resolve, peerIndex, signature_required); });
  }

  public close() {}

  async addStunPeer(publicKey, peerConnection) { await S.getInstance().addStunPeer(publicKey, peerConnection); }

  public getMyServices(): PeerService[] {
    const myServices = [];
    for (let i = 0; i < this.app.modManager.mods.length; i++) {
      const modservices: PeerService[] = this.app.modManager.mods[i].returnServices();
      for (let k = 0; k < modservices.length; k++) {
        myServices.push(modservices[k]);
      }
    }
    return myServices;
  }
}