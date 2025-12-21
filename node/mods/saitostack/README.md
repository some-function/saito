# SaitoStack

An open-source permissioned blogging platform - an alternative to Substack built on the Saito network.

## Features

- **Permissioned Content**: Create free or paid subscription-based content
- **Subscription Management**: Subscribe/unsubscribe from publications
- **Content Access Control**: Automatic access control based on subscription tiers
- **Decentralized Storage**: All content and subscriptions stored on Saito blockchain
- **Creator Monetization**: Support for paid subscriptions

## Module Structure

```
saitostack/
├── saitostack.js          # Main module file
├── index.js               # Homepage template loader
├── README.md              # This file
├── lib/                   # Templates and components
│   ├── saitostack.template.js
│   ├── post.template.js
│   ├── create-post.template.js
│   └── subscription.template.js
└── web/                   # Web assets
    └── style.css          # Stylesheet
```

## Usage

### Creating a Post

```javascript
await mod.createPost({
  title: "My First Post",
  content: "This is the content...",
  subscription_tier: "free", // or "paid"
  excerpt: "A brief description",
  tags: ["technology", "blockchain"]
});
```

### Subscribing to a Publication

```javascript
await mod.subscribeToPublication(authorPublicKey, "paid");
```

### Loading Posts

```javascript
const posts = await mod.loadPosts(); // All accessible posts
const myPosts = await mod.loadPosts(mod.publicKey); // My posts
const paidPosts = await mod.loadPosts(null, "paid"); // Paid posts
```

## Transaction Types

- **create_post**: Creates a new blog post
- **subscribe**: Subscribes to a publication
- **unsubscribe**: Unsubscribes from a publication

## Subscription Tiers

- **free**: Accessible to everyone
- **paid**: Requires paid subscription

## Future Enhancements

- Payment integration for paid subscriptions
- Rich text editor for post creation
- Post editing and deletion
- Comments and discussions
- Email notifications
- RSS feeds
- Analytics dashboard

## License

Open source - part of the Saito ecosystem

