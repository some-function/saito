module.exports = VaultMainTemplate = (app, mod) => {
  return `
<div class="saito-vault">

  <!-- HERO SECTION -->
  <section class="vault-hero">
    <h1>Saito File Vault</h1>

    <h2>
      No passwords.<br>
      No accounts.<br>
      Your NFT is the key.
    </h2>

    <p class="vault-subtag">
      Secure a file and mint an NFT that controls access.  
      Whoever holds the NFT can open the file — access follows ownership.
    </p>

    <div class="vault-cta">
      <button class="vault-btn primary" id="vault-secure-btn">Secure a File</button>
      <button class="vault-btn secondary" id="vault-learn-btn">Learn More</button>
    </div>
  </section>

  <!-- WHY SECTION -->
  <section class="vault-why">
    <div class="vault-why-item">
      <h3>Access Moves With Ownership</h3>
      <p>Your file stays in the Vault — only the access key changes hands.</p>
    </div>
    <div class="vault-why-item">
      <h3>No Identity Systems</h3>
      <p>No passwords, accounts, or permission settings. The NFT is the permission.</p>
    </div>
    <div class="vault-why-item">
      <h3>Secure & Durable</h3>
      <p>Files are stored on-chain. Nodes can host them, but only key-holders can decrypt.</p>
    </div>
    <div class="vault-why-item">
      <h3>For Creators & Businesses</h3>
      <p>Sell access, deliver exclusive content, or share private files using a transferable key.</p>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section class="vault-how">
    <h2>How It Works</h2>

    <div class="vault-steps">
      <div class="vault-step">
        <h4>1. Secure a File</h4>
        <p>Upload your file to the Vault. It becomes permanently stored on-chain.</p>
      </div>

      <div class="vault-step">
        <h4>2. Mint an Access NFT</h4>
        <p>This NFT becomes the only object that can unlock the file.</p>
      </div>

      <div class="vault-step">
        <h4>3. Access Follows Ownership</h4>
        <p>Trade, sell, or transfer the NFT. The holder can open the file — automatically.</p>
      </div>
    </div>
  </section>

</div>

`;
};

