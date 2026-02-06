import "reflect-metadata";
import Server, {NodeSharedMethods} from "../lib/saito/server";
import StorageCore from "../lib/saito/storage-core";
import {AppFull, parseLogLevel} from "../lib/saito/app";
import S, {initialize as initS} from "saito-js/index.node";
import modsConfig from "../config/modules.config";
import process from "process";
import Factory from "../lib/saito/factory";
import Wallet from "../lib/saito/wallet";
import Blockchain from "../lib/saito/blockchain";


async function initSaito() {
	Error.stackTraceLimit = 20;
	const app = new AppFull({modPaths: modsConfig.core});
	// @ts-ignore
	app.storage = new StorageCore(app);
	app.BROWSER = false;
	app.SPVMODE = 0;
	global.__webdir = __dirname + "/lib/saito/web/";
	await app.storage.initialize();
	const privateKey = app.options.wallet?.privateKey || "";
  const getCommandLineArg = (key) => {
    const prefix = key + "=";
    const arg = process.argv.find((arg) => arg.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
  }
	const logLevelArg = getCommandLineArg("l") || getCommandLineArg("loglevel");
	const logLevel = parseLogLevel(logLevelArg || process.env.SAITO_LOG_LEVEL || "info");
	await initS(app.options, new NodeSharedMethods(app), new Factory(), privateKey, logLevel, BigInt(1), true)
    .then(() => { console.log("saito wasm lib initialized"); });
	app.wallet = (await S.getInstance().getWallet()) as Wallet;
	app.wallet.app = app;
	app.blockchain = (await S.getInstance().getBlockchain()) as Blockchain;
	app.blockchain.app = app;
	app.server = new Server(app);
	await app.init();
  app.server.initialize();
	if (app.options.blockchain?.fork_id) {
		await app.blockchain.setForkId(app.options.blockchain!.fork_id);
	}
	S.getInstance().start();
	console.log(`                                   
    ################################################################
    Welcome to Saito
    address: ${await app.wallet.getPublicKey()}
    balance: ${await app.wallet.getBalance()}
    ################################################################
  `);
	const shutdownSaito = () => { console.log("Shutting down Saito"); app.server.close(); app.network.close(); };
	process.on("SIGTERM", () => { shutdownSaito();  console.log("Network Shutdown");  process.exit(0); });
	process.on("SIGINT",  () => { shutdownSaito();  console.log("Network Shutdown");  process.exit(0); });
}

initSaito().catch((e) => console.error(e));