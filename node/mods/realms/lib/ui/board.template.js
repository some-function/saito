module.exports  = () => {
	return `
<div id="realms-board" class="realms-board">
    <div class="battlefield opponent">
      <div class="card-container" data-slot="1"></div>
      <div class="card-container" data-slot="2"></div>
      <div class="card-container" data-slot="3"></div>
      <div class="card-container" data-slot="4"></div>
      <div class="card-container" data-slot="5"></div>
    </div>

    <div class="battlefield player">
      <div class="card-container" data-slot="1"></div>
      <div class="card-container" data-slot="2"></div>
      <div class="card-container" data-slot="3"></div>
      <div class="card-container" data-slot="4"></div>
      <div class="card-container" data-slot="5"></div>
    </div>
</div>
  `;
};
