const SettingsAppspaceTemplate = require("./main.template.js");
const SaitoOverlay = require("../../../../lib/ui/saito-overlay/saito-overlay");
const jsonTree = require("json-tree-viewer");


class SettingsAppspace {
	constructor(app, mod, container = "") {
		this.app = app;
		this.mod = mod;
		this.container = container;
		this.privateKey = null;

		this.overlay = new SaitoOverlay(app, mod);
	}

	async render() {
		this.privateKey = await this.app.wallet.getPrivateKey();
		this.seed_phrase = this.app.crypto.generateSeedFromPrivateKey(this.privateKey);

		this.overlay.show(SettingsAppspaceTemplate(this.app, this.mod, this));

		let settings_appspace = document.querySelector(".settings-appspace");
		if (settings_appspace) {
			for (let i = 0; i < this.app.modManager.mods.length; i++) {
				if (this.app.modManager.mods[i].respondTo("settings-appspace") != null) {
					let mod_settings_obj = this.app.modManager.mods[i].respondTo("settings-appspace");
					mod_settings_obj.render(this.app, this.mod);
				}
			}
		}

		this.renderDebugTree();
		this.renderStorageInfo();

		await this.attachEvents();
	}

	renderDebugTree() {
		let el = document.querySelector(".settings-appspace-debug-content");
		el.innerHTML = "";

		try {
			let optjson = JSON.parse(
				JSON.stringify(
					this.app.options,
					(key, value) => (typeof value === "bigint" ? value.toString() : value)
				)
			);
			var tree = jsonTree.create(optjson, el);
		} catch (err) {
			console.log("error creating jsonTree: " + err);
		}

		if (document.getElementById("delete_marked")) {
			document.getElementById("delete_marked").onclick = async (e) => {
				let updated = false;
				Array.from(document.querySelectorAll(".jsontree_node_marked")).forEach((node) => {
					updated = true;
					let path = this.getJSONPath(node).replaceAll("\"]", "").split("[\"");

					let obj = this.app.options;
					while (path.length > 1) {
						let key = path.shift();
						if (key) {
							obj = obj[key];
						}
					}

					let final_key = path.shift();
					console.log(obj, final_key);
					if (Array.isArray(obj)) {
						obj.splice(parseInt(final_key), 1);
					} else {
						delete obj[final_key];
					}
				});
				this.renderDebugTree();
				let c = await sconfirm(
					`Would you like to save your ${updated ? "updated " : ""}options file?`
				);
				if (c) {
					this.app.storage.saveOptions();
				}
			};
		}
	}

	getJSONPath(node) {
		if (node.classList.contains("jsontree_tree")) {
			return "";
		}

		let currentPath = "";
		if (node.classList.contains("jsontree_node")) {
			if (node.children[0].classList.contains("jsontree_label-wrapper")) {
				currentPath = "[" + node.querySelector(".jsontree_label").textContent + "]";
			}
		}

		return this.getJSONPath(node.parentElement) + currentPath;
	}

	renderStorageInfo() {
		navigator.storage.estimate().then((estimate) => {
			let percentage = (estimate.usage / estimate.quota) * 100;
			document.querySelector(".settings-appspace-indexdb-info .quota").innerHTML =
				this.app.browser.formatNumberToLocale(estimate.quota);
			document.querySelector(".settings-appspace-indexdb-info .usage").innerHTML =
				this.app.browser.formatNumberToLocale(estimate.usage);
			document.querySelector(".settings-appspace-indexdb-info .percent").innerHTML =
				this.app.browser.formatNumberToLocale(percentage);
		});

		function getLocalStorageSize() {
			let total = 0;
			for (let key in localStorage) {
				if (localStorage.hasOwnProperty(key)) {
					total += localStorage[key].length + key.length;
				}
			}
			return total;
		}

		function getLocalStorageUsagePercentage() {
			const totalSize = getLocalStorageSize();
			const maxSize = 5 * 1024 * 1024;
			const percentageUsed = (totalSize / maxSize) * 100;
			return percentageUsed.toFixed(2);
		}

		document.querySelector(".settings-appspace-localstorage-info .quota").innerHTML =
			this.app.browser.formatNumberToLocale(5 * 1024 * 1024);
		document.querySelector(".settings-appspace-localstorage-info .usage").innerHTML =
			this.app.browser.formatNumberToLocale(getLocalStorageSize());
		document.querySelector(".settings-appspace-localstorage-info .percent").innerHTML =
			this.app.browser.formatNumberToLocale(getLocalStorageUsagePercentage());

		console.log(`LocalStorage is ${getLocalStorageUsagePercentage()}% full.`);
	}

	async attachEvents() {
		let app = this.app;
		let mod = this.mod;

		try {
			document.getElementById("profile-default-fee-input").onchange = (e) => {
				let newDefaultFee = parseFloat(e.target.value);
				let precision = e.target.value.split(".")[1]?.length || 0;

				if (newDefaultFee < 0 || newDefaultFee > 7000000000 || precision > 9) {
					siteMessage("Entry invalid if it is negative, bigger than 7,000,000,000 or has more than nine units of precision.", 1000);
					e.target.value = app.wallet.convertNolanToSaito(Number(app.options.wallet.default_fee));
					return;
				}

				app.options.wallet.default_fee = app.wallet.convertSaitoToNolan(newDefaultFee.toString());
				app.wallet.default_fee = BigInt(app.options.wallet.default_fee);
				app.options.wallet = app.options.wallet || {};
				app.storage.saveOptions();

				siteMessage(
					`Default fee updated to: ${app.wallet.convertNolanToSaito(BigInt(app.options.wallet.default_fee)).toString()} SAITO`,
					1000
				);
			};

			let settings_appspace = document.querySelector(".settings-appspace");
			if (settings_appspace) {
				for (let i = 0; i < app.modManager.mods.length; i++) {
					if (app.modManager.mods[i].respondTo("settings-appspace") != null) {
						const mod_settings_obj = app.modManager.mods[i].respondTo("settings-appspace");
						mod_settings_obj.attachEvents(app, mod);
					}
				}
			}

			if (document.getElementById("register-identifier-btn")) {
				document.getElementById("register-identifier-btn").onclick = () => {
					app.connection.emit("register-username-or-login");
				};
			}

			Array.from(document.getElementsByClassName("modules_mods_checkbox")).forEach((ckbx) => {
				ckbx.onclick = async (e) => {
					e.stopPropagation();
					let thisid = parseInt(e.currentTarget.id);
					let currentTarget = e.currentTarget;

					if (currentTarget.checked == true) {
						let sc = await sconfirm("Reactivate this module? (Will take effect on refresh)");
						if (sc) {
							app.options.modules[thisid].active = 1;
							app.storage.saveOptions();
						} else {
							currentTarget.checked = false;
						}
					} else {
						let sc = await sconfirm("Remove this module? (Will take effect on refresh)");
						if (sc) {
							app.options.modules[thisid].active = 0;
							app.storage.saveOptions();
						} else {
							currentTarget.checked = true;
						}
					}
				};
			});

			Array.from(document.getElementsByClassName("crypto_transfers_checkbox")).forEach((ckbx) => {
				ckbx.onclick = async (e) => {
					e.stopPropagation();
					let thisid = e.currentTarget.id;
					let currentTarget = e.currentTarget;

					console.log("Checbox id: //////", thisid);

					if (currentTarget.checked == false) {
						let sc = await sconfirm(
							"Turning off this setting will make gameplay slower, are you sure?"
						);
						if (sc) {
							app.options.gameprefs[thisid] = 0;
						} else {
							currentTarget.checked = true;
						}
					} else {
						app.options.gameprefs[thisid] = 1;
					}

					await app.wallet.saveWallet();
				};
			});

			if (document.getElementById("backup-account-btn")) {
				document.getElementById("backup-account-btn").onclick = (e) => {
					app.wallet.backupWallet();
				};
			}

			if (document.getElementById("restore-account-btn")) {
				document.getElementById("restore-account-btn").onclick = async () => {};
			}

			if (document.getElementById("show-phrase")) {
				document.getElementById("show-phrase").onclick = async (e) => {
					const egldMnemonic = app?.options?.crypto?.EGLD?.mnemonic_text || "";

					if (egldMnemonic && egldMnemonic !== this.seed_phrase) {
						await sconfirm(
							"Warning: Your EGLD wallet is using a different seed phrase. " +
								"Backing up only the Saito seed does NOT back up your EGLD keys. "
						);
					}

					let confirmBackup = await sconfirm(
						`<h4>Copy to clip board?</h4> <br> <span class="monospace">${this.seed_phrase}</div>`
					);
					if (confirmBackup) {
						navigator.clipboard.writeText(this.seed_phrase);
					}
				};
			}

			document.getElementById("nuke-account-btn").onclick = async (e) => {
				let confirmation = await sconfirm(
					"This will reset/nuke your account, do you wish to proceed?"
				);
				if (confirmation) {
					await app.wallet.onUpgrade("nuke");
					reloadWindow(150);
				}
			};

			if (document.getElementById("clear-storage-btn")) {
				document.getElementById("clear-storage-btn").onclick = async (e) => {
					let confirmation = await sconfirm("This will clear your browser's DB, proceed cautiously");
					if (confirmation) {
						siteMessage("Clearing local \"forage\"...");
						await this.app.storage.clearLocalForage();
						siteMessage("Clearing local installed apps...");
						await this.app.storage.removeAllLocalApplications();

						siteMessage("rebooting...");
						if (this.app.browser.browser_active == 1) {
							reloadWindow(300);
						}
					}
				};
			}

			Array.from(document.querySelectorAll(".settings-appspace .pubkey-grid")).forEach((key) => {
				key.onclick = (e) => {
					navigator.clipboard.writeText(e.currentTarget.dataset.id);
					let icon_element = e.currentTarget.querySelector(".pubkey-grid i");
					icon_element.classList.toggle("fa-copy");
					icon_element.classList.toggle("fa-check");

					setTimeout(() => {
						icon_element.classList.toggle("fa-copy");
						icon_element.classList.toggle("fa-check");
					}, 1500);
				};
			});

			document.getElementById("copy-private-key").onclick = (e) => {
				navigator.clipboard.writeText(this.privateKey);
				let icon_element = document.querySelector("#copy-private-key i");
				if (icon_element) {
					icon_element.classList.toggle("fa-copy");
					icon_element.classList.toggle("fa-check");

					setTimeout(() => {
						icon_element.classList.toggle("fa-copy");
						icon_element.classList.toggle("fa-check");
					}, 1500);
				}
			};

			document.getElementById("restore-privatekey-btn").onclick = async () => {};
		} catch (err) {
			console.log("Error in Settings Appspace: ", err);
		}

		if (document.querySelector("#settings-add-app")) {
			document.querySelector("#settings-add-app").onclick = () => {
				app.connection.emit("saito-app-app-render-request");
			};
		}
	}
}

module.exports = SettingsAppspace;
