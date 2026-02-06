import {EventEmitter} from "events";

class Connection extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }
}

export default Connection;