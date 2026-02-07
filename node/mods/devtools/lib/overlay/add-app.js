const AddAppOverlayTemplate = require("./add-app.template.js");
const SaitoOverlay = require("../../../../lib/ui/saito-overlay/saito-overlay");
const InstallAppOverlay = require("./install-app.js");


class AddAppOverlay {
	constructor(app, mod) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(app, mod);
		this.installOverlay = new InstallAppOverlay(app, mod);

		this.app.connection.on("saito-app-app-render-request", () => { this.render(); });
	}

	render() {
		this.overlay.show(AddAppOverlayTemplate());
		this.attachEvents();
	}

	attachEvents() {
		try {
      const id = "saito-app-upload";
      const hiddenUploadForm = `
        <form id="uploader_${id}" class="saito-file-uploader" style="display:none">
          <p>Upload multiple files with the file dialog or by dragging and dropping images onto the dashed region</p>
          <input type="file" id="hidden_file_element_${id}" multiple accept="*" class="treated hidden_file_element_${id}">
          <label class="button" class="hidden_file_element_button" id="hidden_file_element_button_${id}" for="hidden_file_element_${id}">
            Select some files
          </label>
        </form>
      `;

      if (!document.getElementById(`uploader_${id}`)) {
        const dropArea = document.getElementById(id);
        if (dropArea) {
          this.app.browser.addElementToDom(hiddenUploadForm, dropArea);
        } else {
          console.error("Undefined id in browser", id);
        }
        
        const addListeners = (eventNames, opacity) => {
          for (const eventName of eventNames) {
            for (const callback of [
              (event) => { event.preventDefault(); event.stopPropagation(); },
              (event) => { document.getElementById(event.currentTarget.id).style.opacity = opacity; }
            ]) {
              dropArea.addEventListener(eventName, callback)
            }
          }
        };

        addListeners(["dragenter", "dragover"], 0.8);
        addListeners(["dragleave", "drop"    ], 1.0);
        
        const foo = (files) => {
          for (const file of files) {
            this.app.browser.showFileReadSpinner(dropArea);
            const reader = new FileReader();
            reader.addEventListener("error", () => {
              console.error("FileReader error for file:", file.name, file.size, "bytes");
              this.app.browser.hideFileReadSpinner(dropArea);
            });
            reader.addEventListener("abort", () => {
              console.warn("FileReader aborted for file:", file.name);
              this.app.browser.hideFileReadSpinner(dropArea);
            });
            reader.addEventListener("load", (event) => {
              this.app.browser.hideFileReadSpinner(dropArea);
              document.querySelector(".saito-app-upload").innerHTML = "Uploading file...";
              const contentObj = JSON.parse(event.target.result);
              this.installOverlay.base64 = contentObj.base64;
              this.installOverlay.slug = contentObj.slug;
              this.installOverlay.render();
              this.overlay.close();
            });
            reader.readAsText(file);
          }
        };
        dropArea.addEventListener("drop", (event) => { foo(event.dataTransfer.files); }, false);
        if (!dropArea.classList.contains("paste_event")) {
          dropArea.addEventListener("paste", (event) => {
            foo(event.clipboardData.files);
            if (event.clipboardData.files.length !== 0) { event.preventDefault(); event.stopPropagation(); }
          }, false);

          dropArea.classList.add("paste_event");
        }
        const input = document.getElementById(`hidden_file_element_${id}`);
        dropArea.addEventListener("click", () => { input.click(); });

        input.addEventListener("change", () => { if (input.files) foo(input.files); }, false);
        dropArea.focus();
      }

		} catch(error) {
			console.error(error);
			salert("An error occurred while getting application details. Check console for details.");
		}
	}
}

module.exports = AddAppOverlay;