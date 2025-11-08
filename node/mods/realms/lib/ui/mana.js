const ManaTemplate = require('./mana.template');

class Mana {
	constructor(app, mod, container = '') {
		this.app = app;
		this.mod = mod;
		this.container = container;
	}

	render() {

		//
		//
		//
                if (document.querySelector(`${this.container} #mana-wheel`)) {
                        this.app.browser.replaceElementBySelector(ManaTemplate(), `${this.container} #mana-wheel`);
                } else {
                        this.app.browser.addElementToSelector(
                                ManaTemplate(),
                                this.container
                        );
                }


		mana = { red:2, blue:1, green:0, white:0, black:0, total:3 }

		let slot = document.querySelector(this.container);
  		const svg = slot.querySelector(`.mana-pie`);
  		const total = Math.max(mana.total, 1);
  		const colors = ["red", "green", "blue", "white", "black"];
  		let startAngle = 0;

  		colors.forEach(color => {
  		  const value = mana[color] || 0;
  		  const percent = value / total;
  		  const endAngle = startAngle + percent * 2 * Math.PI;
  		  const largeArc = percent > 0.5 ? 1 : 0;

  		  const x1 = 50 + 50 * Math.cos(startAngle);
  		  const y1 = 50 + 50 * Math.sin(startAngle);
  		  const x2 = 50 + 50 * Math.cos(endAngle);
  		  const y2 = 50 + 50 * Math.sin(endAngle);

  		  const path = svg.querySelector(`.mana.${color}`);
    		  if (value > 0) {
  		    const d = [
  		      `M 50 50`,
  		      `L ${x1} ${y1}`,
  		      `A 50 50 0 ${largeArc} 1 ${x2} ${y2}`,
  		      `Z`
  		    ].join(" ");
  		    path.setAttribute("d", d);
  		    path.style.display = "";
  		  } else {
  		    path.style.display = "none";
  		  }

  		  startAngle = endAngle;
  		});

  		const totalDiv = slot.querySelector('.mana-total');
  		totalDiv.textContent = mana.total;

	}

	attachEvents() {

	}

}

module.exports = Mana;
