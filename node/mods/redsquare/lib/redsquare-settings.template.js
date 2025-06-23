module.exports = (app, mod) => {

	let html = `
		<div id="redsquare-settings" class="saito-module-settings">
            		<fieldset class="saito-grid">
            			<legend class="settings-label">Moderation Settings:</legend>
				<div>
					Blacklist users to remove their tweets from your feed. Whitelist users to 
					ensure their tweets show up. Unless you have explicitly whitelisted an 
					account, your browser will also respect the filtering-preferences of
					your friends on the network.
				</div>
            		</fieldset>
	`;
	try {
		if (app.options.modtools.whitelist) {
			html += `
			<fieldset id="whitelisted-accounts" class="saito-grid settings-link">
		                <i class="fa-regular fa-face-smile-beam"></i>
        		        <label>Whitelisted Accounts (${app.options.modtools.whitelist.length})</label>
                		<div id="add-whitelist" class="saito-grid-extra-button saito-button-secondary">Add</div>
               		</fieldset>
			`;
		}
		if (app.options.modtools.blacklist) {
			html += `
                	<fieldset id="blacklisted-accounts" class="saito-grid settings-link">
                		<i class="fa-solid fa-ban"></i>
                		<label>Manage Blocked Accounts (${app.options.modtools.blacklist.length})</label>
                	</fieldset>
			`;
		}
	} catch (err) {}
	html += `
		</div>
	`;

	return html;
}
