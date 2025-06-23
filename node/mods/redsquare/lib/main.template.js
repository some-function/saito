module.exports = (mod) => {

  let curated_css = "";
  let uncurated_css = "";
  let parent_css = "";

  if (mod.curated == true) { 
    curated_css = "active";
    uncurated_css = "active-left";
  } else {
    curated_css = "";
    uncurated_css = "active"
    parent_css = "active-right";
  }

  let html = `
    <div id="saito-container" class="saito-container">
      
      <div class="saito-sidebar hide-scrollbar left">
      </div>
      
      <div class="saito-main hide-scrollbar">
         <div class="redsquare-load-new-tweets-container"></div>
         <div class="tweet-container"></div>
         <div class="redsquare-intersection" id="redsquare-intersection">
           <div id="intersection-observer-trigger" class="intersection-observer-trigger"></div>
         </div>
         <div class="tweet-thread-holder" id="tweet-thread-holder"></div>
      </div>
     
      <div class="saito-sidebar redsquare-sidebar hide-scrollbar right">

	<div class="curation-toggle-switch ${parent_css}">
	  <button class="curation-toggle-option ${curated_css}" data-view="curated">Curated</button>
	  <button class="curation-toggle-option ${uncurated_css}" data-view="unfiltered">Unfiltered</button>
	</div>

      </div>
      
    </div>
  `;


  return html;
};
