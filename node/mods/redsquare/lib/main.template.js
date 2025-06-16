module.exports = () => {
	return `
    <div id="saito-container" class="saito-container">
      
      <div class="saito-sidebar left">
      </div>
      
      <div class="saito-main">
         <div class="redsquare-progress-banner"></div>
         <div class="tweet-container"></div>
         <div class="redsquare-intersection" id="redsquare-intersection">
           <div id="intersection-observer-trigger" class="intersection-observer-trigger"></div>
         </div>
         <div class="tweet-thread-holder" id="tweet-thread-holder"></div>
      </div>
     
      <div class="saito-sidebar right">
      </div>
      
    </div>
  `;
};
