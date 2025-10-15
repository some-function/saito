module.exports = (mod, app) => {
	return `
		<div class="migration-check">
				<h3> Friendly Reminder </h3>
				<div> This service is only available for ERC-20 wrapped SAITO. Maximum deposit limits apply. </div>
				<div> If you have not already backed-up your wallet, you risk losing access to your tokens once they are migrated. Unsure if you are safe? Click below:. </div>
				<div class="user-id-check"></div>
		        <div class="saito-button-row">
		          <div class="saito-anchor" id="log-in"><span>not me?</span></div>
		          <button type="button" class="saito-button-secondary" id="migration-cancel">cancel</button>
		          <button type="button" class="saito-button-primary" id="migration-confirm">confirm</button>
		        </div>
		</div>
	`;
};
