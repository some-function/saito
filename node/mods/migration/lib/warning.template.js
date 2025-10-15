module.exports = (mod, app) => {
	return `
		<div class="migration-check">
				<h2> <i class="fa-solid fa-triangle-exclamation"></i> Warning </h2>
				<div> Failure to properly secure your account may result in unrecoverable losses. </div>
				<div> This service is only available for ERC-20 wrapped SAITO. Maximum deposit limits apply. </div>
				<div class="user-id-check"></div>
				<div class='confirmation-block'><input type="checkbox" checked value="true"/>I accept responsibility for funds deposited into this account</div>
		        <div class="saito-button-row">
		          <div class="saito-anchor" id="log-in"><span>not me?</span></div>
		          <button type="button" class="saito-button-secondary" id="migration-cancel">cancel</button>
		          <button type="button" class="saito-button-primary" id="migration-confirm">confirm</button>
		        </div>
		</div>
	`;
};
