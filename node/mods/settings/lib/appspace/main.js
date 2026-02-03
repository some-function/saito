const SettingsAppspaceTemplate = require("./main.template.js");
const SaitoOverlay = require("../../../../lib/ui/saito-overlay/saito-overlay");
const jsonTree = require("json-tree-viewer");


class SettingsAppspace {
	constructor(app, mod, container="") {
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

		if (document.querySelector(".settings-appspace")) {
      for (const mod of this.app.modManager.mods) {
        const foo = mod.respondTo("settings-appspace");
				if (foo != null) foo.render(this.app, this.mod);
      }
		}

		this.renderDebugTree();
		this.renderStorageInfo();

		await this.attachEvents();
	}

	renderDebugTree() {
		const el = document.querySelector(".settings-appspace-debug-content");
		el.innerHTML = "";

		try {
			jsonTree.create(JSON.parse(JSON.stringify(this.app.options, (key, value) => (typeof value === "bigint" ? value.toString() : value))), el);
		} catch (err) {
			console.log("error creating jsonTree: " + err);
		}

    const deleteMarkedElement = document.getElementById("delete_marked");
		if (deleteMarkedElement) {
			deleteMarkedElement.onclick = async (e) => {
				let updated = false;
        for (const node of document.querySelectorAll(".jsontree_node_marked")) {
					updated = true;
					const path = this.getJSONPath(node).replaceAll("\"]", "").split("[\"");

					let obj = this.app.options;
					while (path.length > 1) {
						const key = path.shift();
						if (key) {
							obj = obj[key];
						}
					}

					const finalKey = path.shift();
					console.log(obj, finalKey);
					if (Array.isArray(obj)) {
						obj.splice(parseInt(finalKey), 1);
					} else {
						delete obj[finalKey];
					}
        }
				this.renderDebugTree();
				if (await sconfirm(`Would you like to save your ${updated ? "updated " : ""}options file?`)) {
					this.app.storage.saveOptions();
				}
			};
		}
	}

	getJSONPath(node) {
		if (node.classList.contains("jsontree_tree")) {
			return "";
		} else {
      const b = node.classList.contains("jsontree_node") && node.children[0].classList.contains("jsontree_label-wrapper");
      const currentPath = b ? ("[" + node.querySelector(".jsontree_label").textContent + "]") : "";
  
      return this.getJSONPath(node.parentElement) + currentPath;
    }
	}

	renderStorageInfo() {
		navigator.storage.estimate().then((estimate) => {
			const percentage = (estimate.usage / estimate.quota) * 100;
			document.querySelector(".settings-appspace-indexdb-info .quota"  ).innerHTML = this.app.browser.formatNumberToLocale(estimate.quota);
			document.querySelector(".settings-appspace-indexdb-info .usage"  ).innerHTML = this.app.browser.formatNumberToLocale(estimate.usage);
			document.querySelector(".settings-appspace-indexdb-info .percent").innerHTML = this.app.browser.formatNumberToLocale(percentage);
		});

		function getLocalStorageSize() {
			let total = 0;
			for (const key in localStorage) {
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
		try {
			document.getElementById("profile-default-fee-input").onchange = (e) => {
				const newDefaultFee = parseFloat(e.target.value);
				const precision = e.target.value.split(".")[1]?.length || 0;

				if (newDefaultFee < 0 || newDefaultFee > 7000000000 || precision > 9) {
					siteMessage("Entry invalid if it is negative, bigger than 7,000,000,000 or has more than nine units of precision.", 1000);
					e.target.value = this.app.wallet.convertNolanToSaito(Number(this.app.options.wallet.defaultFee));
					return;
				}

				this.app.options.wallet.defaultFee = this.app.wallet.convertSaitoToNolan(newDefaultFee.toString());
				this.app.wallet.defaultFee = BigInt(this.app.options.wallet.defaultFee);
				this.app.options.wallet = this.app.options.wallet || {};
				this.app.storage.saveOptions();

        const newDefaultFeeStrInSaito = this.app.wallet.convertNolanToSaito(BigInt(this.app.options.wallet.defaultFee)).toString();
				siteMessage(`Default fee updated to: ${newDefaultFeeStrInSaito} SAITO`, 1000);
			};

			if (document.querySelector(".settings-appspace")) {
        for (const mod of this.app.modManager.mods) {
          const foo = mod.respondTo("settings-appspace");
					if (foo != null) foo.attachEvents(this.app, this.mod);
        }
			}

			Array.from(document.getElementsByClassName("modules_mods_checkbox")).forEach((ckbx) => {
				ckbx.onclick = async (event) => {
					event.stopPropagation();
					const thisid = parseInt(event.currentTarget.id);
					const currentTarget = event.currentTarget;

					if (currentTarget.checked == true) {
						if (await sconfirm("Reactivate this module? (Will take effect on refresh)")) {
							this.app.options.modules[thisid].active = 1;
							this.app.storage.saveOptions();
						} else {
							currentTarget.checked = false;
						}
					} else {
						if (await sconfirm("Remove this module? (Will take effect on refresh)")) {
							this.app.options.modules[thisid].active = 0;
							this.app.storage.saveOptions();
						} else {
							currentTarget.checked = true;
						}
					}
				};
			});

      const backupAccountButton = document.getElementById("backup-account-btn");
			if (backupAccountButton) backupAccountButton.onclick = () => { this.app.wallet.backupWallet(); };

      const restoreAccountButton = document.getElementById("restore-account-btn");
			if (restoreAccountButton) {
				restoreAccountButton.onclick = async () => {
          if (!document.getElementById("file-input")) {
            this.app.browser.addElementToDom(`<input id="file-input" class="file-input" type="file" accept=".json, .aes" style="display:none;" />`);
          }
              
          document.getElementById("file-input").addEventListener(
            "change",
            (e) => {        
              const walletReader = new FileReader();
              walletReader.readAsBinaryString(e.target.files[0]);
              walletReader.onloadend = async () => {
                try {
                  const result = await this.app.wallet.onUpgrade("import", "", walletReader.result.toString());
                  if (result === true) { if (await sconfirm("Success! Confirm to reload")) reloadWindow(300); }
                  else                 { salert("Error installing wallet"); console.error(result);            }
                } catch (err) {
                  console.error("Install Wallet ERROR: ", err);
                  salert("Unable to install wallet");
                }
              };
            },
            {once: true}
          );
      
          document.getElementById("file-input").click();
        };
			}

      const showPhraseElement = document.getElementById("show-phrase");
			if (showPhraseElement) {
				showPhraseElement.onclick = async (e) => {
					const confirmBackup = await sconfirm(`<h4>Copy to clip board?</h4> <br> <span class="monospace">${this.seed_phrase}</div>`);
					if (confirmBackup) {
						navigator.clipboard.writeText(this.seed_phrase);
					}
				};
			}

			document.getElementById("nuke-account-btn").onclick = async (e) => {
				const confirmation = await sconfirm("This will reset/nuke your account, do you wish to proceed?");
				if (confirmation) {
					await this.app.wallet.onUpgrade("nuke");
					reloadWindow(150);
				}
			};

      const clearStorageButton = document.getElementById("clear-storage-btn");
			if (clearStorageButton) {
				clearStorageButton.onclick = async (e) => {
					const confirmation = await sconfirm("This will clear your browser's DB, proceed cautiously");
					if (confirmation) {
						siteMessage("Clearing local \"forage\"...");     await this.app.storage.clearLocalForage();
						siteMessage("Clearing local installed apps..."); await this.app.storage.removeAllLocalApplications();
						siteMessage("rebooting..."); if (this.app.browser.browserActive == 1) reloadWindow(300);
					}
				};
			}

			Array.from(document.querySelectorAll(".settings-appspace .pubkey-grid")).forEach((key) => {
				key.onclick = (e) => {
					navigator.clipboard.writeText(e.currentTarget.dataset.id);
					const iconElement = e.currentTarget.querySelector(".pubkey-grid i");
					iconElement.classList.toggle("fa-copy");
					iconElement.classList.toggle("fa-check");

					setTimeout(() => {
						iconElement.classList.toggle("fa-copy");
						iconElement.classList.toggle("fa-check");
					}, 1500);
				};
			});

			document.getElementById("copy-private-key").onclick = (e) => {
				navigator.clipboard.writeText(this.privateKey);
				const iconElement = document.querySelector("#copy-private-key i");
				if (iconElement) {
					iconElement.classList.toggle("fa-copy");
					iconElement.classList.toggle("fa-check");

					setTimeout(() => {
						iconElement.classList.toggle("fa-copy");
						iconElement.classList.toggle("fa-check");
					}, 1500);
				}
			};

			document.getElementById("restore-privatekey-btn").onclick = async () => {};
		} catch (err) {
			console.log("Error in Settings Appspace: ", err);
		}

		if (document.querySelector("#settings-add-app")) {
			document.querySelector("#settings-add-app").onclick = () => {
				this.app.connection.emit("saito-app-app-render-request");
			};
		}
	}
}

module.exports = SettingsAppspace;