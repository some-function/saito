module.exports = (app, mod) => {
  let html = `
<div class="vault-file-info">

      <h1>Success</h1>

      If you transfer the key to someone else, make sure thay have this information:

      <label for="file-info">File Info</label>
      <div class="file-info"></div>

</div>
`;
  return html;
};
