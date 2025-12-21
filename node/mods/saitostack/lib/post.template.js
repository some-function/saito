module.exports = (app, mod, post) => {
  const author = post.author || 'Unknown';
  const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString() : '';
  const tierBadge = post.subscription_tier === 'paid' 
    ? '<span class="saitostack-tier-badge saitostack-tier-paid">Paid</span>'
    : '<span class="saitostack-tier-badge saitostack-tier-free">Free</span>';

  return `
    <div class="saitostack-post" data-post-sig="${post.signature}">
      <div class="saitostack-post-header">
        <div class="saitostack-post-meta">
          <span class="saitostack-post-author">${author.slice(0, 8)}...</span>
          <span class="saitostack-post-date">${date}</span>
          ${tierBadge}
        </div>
      </div>
      <div class="saitostack-post-content">
        <h2 class="saitostack-post-title">${post.title || 'Untitled'}</h2>
        ${post.excerpt ? `<p class="saitostack-post-excerpt">${post.excerpt}</p>` : ''}
        <div class="saitostack-post-body">${post.content || ''}</div>
        ${post.tags && post.tags.length > 0 ? `
          <div class="saitostack-post-tags">
            ${post.tags.map(tag => `<span class="saitostack-tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="saitostack-post-actions">
        <button class="saitostack-btn saitostack-btn-link" data-action="read-more">
          Read More
        </button>
      </div>
    </div>
  `;
};


