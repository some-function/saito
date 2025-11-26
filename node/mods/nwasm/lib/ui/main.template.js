module.exports  = (app, mod, do_we_have_games_to_show) => {

	let html = `

		<div class="nwasm-libraries" id="nwasm-libraries">
			The Saito Nintendo 64 emulator provides a user-friendly in-browser way to archive 
			and play the N64 games you own. Game files are encrypted so only you can decrypt 
			them and archived in your private transaction store.

          		<p></p>

			We welcome use of this module from those with legal access to their own ROMS. 
			Feedback and suggestions on improvements are welcone.
		</div>

	`;


	if (do_we_have_games_to_show > 0) {
	    html = `
		<div class="nwasm-libraries saito-table" id="nwasm-libraries">
	      		<div class="nwasm-library-introduction">Your library contains the following titles:</div>
	    	</div>
	    `;
	}

	return html;

};
