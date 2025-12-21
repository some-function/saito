module.exports = (app, mod, author, subscription = null) => {
  const isSubscribed = subscription !== null;
  const tier = subscription?.tier || 'free';

  return `
    <div class="saitostack-subscription-item" data-author="${author}">
      <div class="saitostack-subscription-info">
        <div class="saitostack-subscription-author">${author.slice(0, 16)}...</div>
        <div class="saitostack-subscription-tier">${tier === 'paid' ? 'Paid Subscription' : 'Free Subscription'}</div>
      </div>
      <div class="saitostack-subscription-actions">
        ${isSubscribed ? `
          <button class="saitostack-btn saitostack-btn-secondary saitostack-unsubscribe-btn" data-author="${author}">
            Unsubscribe
          </button>
        ` : `
          <button class="saitostack-btn saitostack-btn-primary saitostack-subscribe-btn" data-author="${author}">
            Subscribe
          </button>
        `}
      </div>
    </div>
  `;
};


