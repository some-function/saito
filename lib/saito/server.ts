import { Saito } from '../../apps/core';

class Server {
  public app: Saito;

  constructor(app) {
    this.app = app || {};
  }

  initialize() {}
}

export default Server;