function previewSource(assetOrigin: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <script src="${assetOrigin}/library.js"></script>
  </head>
  <body>
    <h1 id="inline-status">Scripts blocked</h1>
    <a id="external-link" href="https://example.test/private-content">External link</a>
    <iframe src="https://example.test/embedded"></iframe>
    <p id="external-status">External script blocked</p>
    <script>
      document.querySelector('#inline-status').textContent = 'Inline script ran';
      document.querySelector('#external-status').textContent =
        globalThis.externalLibraryLoaded ? 'External script ran' : 'External script blocked';
      fetch('${assetOrigin}/status')
        .then((response) => response.text())
        .then((text) => {
          document.querySelector('#network-status').textContent = text;
        });
    </script>
    <p id="network-status">Network blocked</p>
  </body>
</html>`;
}

export function githubFilePage(assetOrigin: string): string {
  const payload = JSON.stringify({
    payload: {
      blob: {
        path: 'index.html',
        rawLines: previewSource(assetOrigin).split('\n'),
      },
    },
  }).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="en">
  <body>
    <ul aria-label="File view" data-component="SegmentedControl">
      <li data-component="SegmentedControl.Button" data-selected>
        <button type="button" aria-pressed="true">
          <span data-text="Code">Code</span>
        </button>
      </li>
      <li data-component="SegmentedControl.Button">
        <button type="button" aria-pressed="false">
          <span data-text="Blame">Blame</span>
        </button>
      </li>
    </ul>
    <a data-testid="raw-button" href="https://github.com/test/repo/raw/main/index.html">Raw</a>
    <main class="BlobViewContent-module__blobContentWrapper">
      <section class="BlobContent-module__blobContentSection">
        <pre id="source">HTML source</pre>
      </section>
    </main>
    <script type="application/json" data-target="react-app.embeddedData">${payload}</script>
  </body>
</html>`;
}
