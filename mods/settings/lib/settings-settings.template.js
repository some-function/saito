module.exports = (app, mod) => {
	return `
    <fieldset class="saito-grid">
      <legend class="settings-label">Module Debug Mode</legend>
      <input type="checkbox" id="show" ${(app.options.settings?.debug || false) ? "checked" : ""}/> 
      <label for="show">Verbose Logging <span class="note">I want to know what is happening</span></label>
    </fieldset>
	`;
};