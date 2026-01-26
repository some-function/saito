const EventEmitter = require("events");

class Connection extends EventEmitter {
  public setMaxListeners: any;

  constructor() {
    super();
    this.setMaxListeners(200);
  }
}

export default Connection;