module.exports = VaultMainTemplate = (app, mod) => {
  return `
<div class="saito-vault">

  <!-- HERO SECTION -->
  <section class="vault-hero">
    <h1>Saito File Vault</h1>

    <h2>
      no passwords </br>
      no accounts </br>
      your NFT is the key...
    </h2>

    <div class="vault-cta">
      <button class="vault-btn primary" id="vault-secure-btn">Upload File</button>
      <button class="vault-btn primary" id="vault-access-btn">Access File</button>
    </div>
  </section>

</div>

`;
};

