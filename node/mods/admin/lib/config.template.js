module.exports = (obj) => {
	let html = `<div id='node-config'>`;

	html += `
			<div class="module-config-header">
				<h3>Modules</h3>
				<button id='modconfig-button'>Save Changes</button>
			</div>
			<div class="mod-config-table">
				<div class="table-header">Module</div>
				<div class="table-header">Lite</div>
				<div class="table-header">Core</div>
				<div class="table-header">Module</div>
				<div class="table-header">Lite</div>
				<div class="table-header">Core</div>
				<div class="table-header hide2">Module</div>
				<div class="table-header hide2">Lite</div>
				<div class="table-header hide2">Core</div>
				<div class="table-header hide1">Module</div>
				<div class="table-header hide1">Lite</div>
				<div class="table-header hide1">Core</div>
	`;

	let lite_mods = obj.module_config.lite.join(' ');
	let core_mods = obj.module_config.core.join(' ');

	for (let m of obj.available_modules) {
		html += `<div>${m}</div>
				<input type="checkbox" name="${m}-lite" ${lite_mods.includes(m + '/' + m) ? 'checked' : ''}/>
				<input type="checkbox" name="${m}-core" ${core_mods.includes(m + '/' + m) ? 'checked' : ''}/>
		`;
	}

	html += '</div>';

	html += '</div>';
	return html;
};
