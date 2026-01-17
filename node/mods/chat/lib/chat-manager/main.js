const ChatPopup = require('./popup');
const ChatManagerTemplate = require('./main.template');
const ChatTeaser = require('./teaser.template');
const JSON = require('json-bigint');
const ChatUserMenu = require('./../overlays/chat-user-menu');
const ChatManagerMenu = require('./../overlays/chat-manager-menu');

class ChatManager {
	constructor(app, mod, container = '') {
		this.app = app;
		this.mod = mod;
		this.container = container;

		this.render_manager_to_screen = 0;
		this.render_popups_to_screen = 1;

		this.popups = {};

		this.timers = {};
		this.pinged = {};

		app.connection.on('chat-manager-render-request', () => {
			if (this.render_manager_to_screen) {
				this.render();
			} else {
				console.log('*** ! render manager to screen ');
			}
		});

		app.connection.on('chat-manager-request-no-interrupts', () => {
			this.render_popups_to_screen = 0;
		});

		app.connection.on('chat-popup-render-request', (group = null) => {
			if (!group) {
				group = this.mod.returnCommunityChat();
			}

			if (group) {
				if (!this.popups[group.id]) {
					this.popups[group.id] = new ChatPopup(
						this.app,
						this.mod,
						group?.target_container || this.chat_popup_container
					);
					this.popups[group.id].group = group;
				}

				let popup_rendered = 0;
				if (
					this.render_popups_to_screen ||
					this.popups[group.id].is_rendered
				) {
					popup_rendered = this.popups[group.id].render();
				}

				this.app.connection.emit('chat-manager-render-request');
			}
		});

		app.connection.on('chat-popup-remove-request', (group = null) => {
			if (!group) {
				return;
			} else {
				if (this.popups[group.id]) {
					this.popups[group.id].remove();
					delete this.popups[group.id];
				}
			}
		});

		app.connection.on('chat-manager-animation-request', (group = null) => {
			let cm_handle = document.getElementById(`saito-user-${group?.id}`);
			if (cm_handle) {
				if (!cm_handle.classList.contains('new-notification')) {
					cm_handle.classList.add('new-notification');
					setTimeout(() => {
						cm_handle.classList.remove('new-notification');
						this.app.connection.emit('chat-manager-render-request');
					}, 1000);
				}
			}
		});

		app.connection.on('open-chat-with', (data = null) => {
			let popup_status = this.render_popups_to_screen;
			this.render_popups_to_screen = 1;

			if (this.mod.debug) {
				console.log('open-chat-with');
			}

			let group = null;

			if (!data) {
				group = this.mod.returnCommunityChat();
			} else {
				if (data.key) {
					if (Array.isArray(data.key)) {
						group = this.mod.returnOrCreateChatGroupFromMembers(
							data.key,
							data.name
						);
					} else {
						group = this.mod.returnOrCreateChatGroupFromMembers(
							[this.mod.publicKey, data.key],
							data.name
						);
					}
				}else{
					console.log("**********", data);
					if (data.id && data.name) {
						this.mod.createFreshGroup(data.name, data.id);
					}
				}

				if (data.id) {
					let group2 = this.mod.returnGroup(data.id);
					if (!group2 && group) {
						group.id = data.id;
					} else {
						group = group2;
					}
				}

				if (data?.temporary){
					group.temporary = true;
				}

			}

			if (this.mod.browser_active) {
				this.switchTabs();
			}

			if (this.popups[group.id]) {
				this.popups[group.id].manually_closed = false;
			}

			app.connection.emit('chat-popup-render-request', group);
			this.render_popups_to_screen = popup_status;

			this.popups[group.id].activate();
		});

		app.connection.on("stun-connection-connected", (peer) => {
			app.connection.emit("relay-is-online", peer, true);
		});

		app.connection.on('relay-is-online', (pkey, stun = false) => {
			let target_id = this.mod.createGroupIdFromMembers([
				pkey,
				this.mod.publicKey
			]);
			let group = this.mod.returnGroup(target_id);
			if (!group || group.members.length !== 2) {
				return;
			}

			if (stun){
				group.online = " stun";	
			}else{
				group.online = " online";
			}
			
			let cm_handle = document.querySelector(
				`.chat-manager #saito-user-${group.id}`
			);
			if (cm_handle) {
				cm_handle.classList.add('online');
				if (stun){
					cm_handle.classList.add("stun");
				}
				if (this.timers[group.id]) {
					clearTimeout(this.timers[group.id]);
				}
				this.timers[group.id] = null;
			}
		});

		app.connection.on('group-is-active', (group) => {
			if (group.members.length !== 2) {
				return;
			}

			if (!group.online){
				group.online = " online";	
			}
			
			if (this.timers[group.id]) {
				clearTimeout(this.timers[group.id]);
			}

			this.pinged[group.id] = new Date().getTime();

			this.timers[group.id] = setTimeout(() => {
				group.online = false;
				app.connection.emit('chat-manager-render-request');
			}, 60000);
		});
	}

	render() {
		if (this.render_manager_to_screen == 0) {
			return;
		}

		if (document.querySelector(this.container + '.chat-manager')) {
			this.app.browser.replaceElementBySelector(
				ChatManagerTemplate(this),
				'.chat-manager'
			);
		} else {
			if (document.querySelector('.chat-manager')) {
				document.querySelector('.chat-manager').remove();
			}

			this.app.browser.addElementToSelectorOrDom(
				ChatManagerTemplate(this),
				this.container
			);
		}

		this.mod.groups = this.mod.groups.sort((a, b) => {
			let ts_a = a?.last_update || 0;
			let ts_b = b?.last_update || 0;

			return ts_b - ts_a;
		});

		let now = new Date().getTime();

		for (let group of this.mod.groups) {
			if (group.members.length == 2 && this.mod.isRelayConnected) {
				for (let member of group.members) {
					if (member != this.mod.publicKey) {
						if (
							!this.pinged[group.id] ||
							this.pinged[group.id] < now - 60000
						) {

							this.pinged[group.id] = now;

							this.app.connection.emit('relay-ping-peer', member);

							if (this.timers[group.id]) {
								clearTimeout(this.timers[group.id]);
							}

							this.timers[group.id] = setTimeout(() => {
								let cm_handle = document.querySelector(
									`.chat-manager #saito-user-${group.id}`
								);
								if (cm_handle) {
									cm_handle.classList.remove('online');
								}
								group.online = false;
								this.timers[group.id] = null;
							}, 1000 * 5);
						}
					}
				}
			}

			let group_status = false;
			if (this.popups[group.id]?.is_rendered) {
				group_status = true;
			}
			let html = ChatTeaser(this.app, this.mod, group, group_status);
			let divid = 'saito-user-' + group.id;

			let obj = document.getElementById(divid);
			if (obj) {
				this.app.browser.replaceElementById(html, divid);
			} else {
				if (document.querySelector('.chat-manager-list')) {
					this.app.browser.addElementToSelector(
						html,
						'.chat-manager-list'
					);
				}
				obj = document.getElementById(divid);
			}

			setTimeout(() => {
				obj.classList.remove('new-notification');
			}, 1000);
		}

		this.attachEvents();
	}

	switchTabs() {
		for (let popup in this.popups) {
			this.popups[popup].manually_closed = true;
			this.popups[popup].is_rendered = false;
		}
	}

	attachEvents() {
		document
			.querySelectorAll('.chat-manager-list .saito-user')
			.forEach((item) => {
				item.onclick = (e) => {
					e.stopPropagation();

					let gid = e.currentTarget.getAttribute('data-id');
					let group = this.mod.returnGroup(gid);

					if (!this.popups[gid]) {
						this.popups[gid] = new ChatPopup(
							this.app,
							this.mod,
							group?.target_container || this.chat_popup_container
						);
						this.popups[gid].group = group;
					}

					if (this.mod.browser_active) {
						this.switchTabs();
					}

					this.popups[gid].manually_closed = false;

					this.popups[gid].render();
					this.popups[gid].activate();

					if (!this.app.browser.isMobileBrowser()) {
						this.popups[gid].input.focus(true);
					}

					this.app.connection.emit('chat-manager-render-request');
				};

				item.oncontextmenu = (e) => {
					e.preventDefault();
					let gid = e.currentTarget.getAttribute('data-id');
					let chatMenu = new ChatUserMenu(
						this.app,
						this.mod,
						this.mod.returnGroup(gid)
					);
					chatMenu.render();
				};
			});

		if (document.querySelector('.close-chat-manager')) {
			document.querySelector('.close-chat-manager').onclick = (e) => {
				this.app.connection.emit('close-chat-manager-overlay');
			};
		}

		if (document.querySelector('.alternate-close-button')) {
			document.querySelector('.alternate-close-button').onclick = (e) => {
				this.app.connection.emit('close-chat-manager-overlay');
			};
		}

		if (document.querySelector('.chat-manager-options')) {
			document.querySelector('.chat-manager-options').onclick = (e) => {
				this.mod.loadSettings();
			}
		}
	}
}

module.exports = ChatManager;
