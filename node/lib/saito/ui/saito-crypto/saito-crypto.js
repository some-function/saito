const Deposit = require('./overlays/deposit');
const Withdraw = require('./overlays/withdraw');
const History = require('./overlays/history');
const Send = require('./overlays/send');
const Receive = require('./overlays/receive');
const Details = require('./overlays/details');

class SaitoCrypto {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;

    this.deposit_overlay = new Deposit(app, mod);
    this.withdrawal_overlay = new Withdraw(app, mod);
    this.history_overlay = new History(app, mod);
    this.send_overlay = new Send(app, mod);
    this.receive_overlay = new Receive(app, mod);
    this.details_overlay = new Details(app, mod);
  }
}

module.exports = SaitoCrypto;
