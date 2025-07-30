module.exports = (link) => {
  let html = `
  <div class="link-preview">
          <a `;

  if (!link.url.includes(window.location.host)) {
    html += `target="_blank" `;
  }

  let style = '';
  if (link.src) {
    style += `background-image: url(${link.src}); `;
  }
  if (link.set_height) {
    style += 'height: 2.5rem;';
  }

  html += `href="${link.url}">
            <div class="link-container">
              <div class="link-img" style="${style}"></div>
              <div class="link-info">
                <div class="link-url">${link.url}</div>
                <div class="link-title">${link.title}</div>
                <div class="link-description">${link.description}</div>
              </div>
            </div>
          </a>
        </div>
    `;
  return html;
};
