module.exports = (app, mod) => {
  return `
    <div class="saitostack-create-post">
      <h2>Create New Post</h2>
      <form id="saitostack-post-form">
        <div class="saitostack-form-group">
          <label for="post-title">Title</label>
          <input type="text" id="post-title" name="title" required placeholder="Enter post title">
        </div>

        <div class="saitostack-form-group">
          <label for="post-excerpt">Excerpt (optional)</label>
          <textarea id="post-excerpt" name="excerpt" rows="3" placeholder="Brief description of your post"></textarea>
        </div>

        <div class="saitostack-form-group">
          <label for="post-content">Content</label>
          <textarea id="post-content" name="content" rows="15" required placeholder="Write your post content here..."></textarea>
        </div>

        <div class="saitostack-form-group">
          <label for="post-subscription-tier">Subscription Tier</label>
          <select id="post-subscription-tier" name="subscription_tier">
            <option value="free">Free - Accessible to everyone</option>
            <option value="paid">Paid - Subscribers only</option>
          </select>
        </div>

        <div class="saitostack-form-group">
          <label for="post-tags">Tags (comma-separated)</label>
          <input type="text" id="post-tags" name="tags" placeholder="technology, blockchain, web3">
        </div>

        <div class="saitostack-form-actions">
          <button type="submit" class="saitostack-btn saitostack-btn-primary">Publish Post</button>
          <button type="button" class="saitostack-btn saitostack-btn-secondary" id="saitostack-cancel-post">Cancel</button>
        </div>
      </form>
    </div>
  `;
};


