module.exports = (obj) => {
	let html = `<div id='node-config'>`;

	html += `
			<div class="module-config-header">
				<h3>Modules</h3>
				<button id='modconfig-button'>Save Changes</button>
			</div>
			<div class="mod-config-table">
	`;

	let lite_mods = obj.module_config.lite.join(' ');
	let core_mods = obj.module_config.core.join(' ');

	for (let m of obj.available_modules) {
		html += `
			<input type="checkbox" name="${m}" ${lite_mods.includes(m + '/' + m) || core_mods.includes(m + '/' + m) ? 'checked' : ''}/>
			<label for="${m}">${m}</label>
		`;
	}

	html += '</div>';

	html += '</div>';

	html += `<hr>
			 <div class="module-config-header"> 
			 	<h3>Options</h3>
			 	<button id="node-options-button">Save Changes</button>
			 </div>
			 <div id='node-options' class='node-options'></div>
	`;

	return html;
};
