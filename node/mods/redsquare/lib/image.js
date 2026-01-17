const SaitoImageOverlay = require('./../../../lib/saito/ui/saito-image-overlay/saito-image-overlay');
const RedSquareImageTemplate = require('./image.template');

class RedSquareImage {
	constructor(app, mod, container = '', images = [], sig) {
		this.app = app;
		this.mod = mod;
		this.container = container;
		this.images = images;
		this.sig = sig;
		this.overlay = new SaitoImageOverlay(app, mod, images);
	}

	render() {
		let element = this.container + ' > .tweet-image ';
		let template = RedSquareImageTemplate(this.app, this.mod, this.images);
		let sig = this.sig;

		let expected_width = 520;
		let expected_height = 'auto';

		for (let i = 0; i < this.images.length; i++) {
			var img = new Image();
			img.src = this.images[i];
		}
		if (document.querySelector(element)) {
			this.app.browser.replaceElementBySelector(template, element);
		} else {
			if (this.container) {
				this.app.browser.addElementToSelector(template, this.container);
			} else {
				this.app.browser.addElementToDom(template);
			}
		}

		this.attachEvents();
	}

	attachEvents() {
		let sel = '.tweet-' + this.sig + ' > .tweet-body .tweet-image img';

		if (document.querySelector(sel)) {
			document.querySelectorAll(sel).forEach((image) => {
				image.onclick = (e) => {
					if (image.naturalHeight > image.height || image.naturalWidth > image.width) {
						let image_idx = e.currentTarget.getAttribute('data-index');
						this.overlay.render(image_idx);
					} else {
						console.warn(
							'Img small, no preview',
							`${image.width}x${image.height} versus ${image.naturalWidth}x${image.naturalHeight}`
						);
					}
				};
			});
		} else {
			console.warn('No image selected!!!');
		}
	}
}

module.exports = RedSquareImage;
