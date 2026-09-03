# Native HTML Preview for GitHub

Preview repository HTML files inside [GitHub](https://github.com) without a
download, API token, or third-party renderer.

The extension adds **HTML** beside GitHub's **Code** and **Blame**
controls. The preview replaces only the source section, so commit details, file
statistics, and native controls stay visible.

![HTML preview active on a GitHub file](assets/store/native-html-preview-store-html-tab-active-20260903-1444.png)

## Contents

- [Features](#features)
- [Security model](#security-model)
- [Permissions](#permissions)
- [Load unpacked](#load-unpacked)
- [Development](#development)
- [Project structure](#project-structure)
- [Independence](#independence)
- [License](#license)

## Features

- Supports `.html`, `.htm`, and `.xhtml` files on blob and blame pages.
- Works with public and private files already visible in the current session.
- Keeps preview state in the URL with `?native-html=preview`.
- Resolves relative assets from the file's raw URL.
- Runs inline and HTTPS-hosted scripts in an isolated frame by default.
- Loads HTTPS styles, images, fonts, media, and API requests by default.
- Provides a Chrome side-panel setting for restricted previews.
- Uses no API token, extra account, build step, or runtime dependency.

## Security model

Repository HTML runs in a sandboxed iframe with an opaque origin. It cannot read
GitHub cookies, storage, DOM, or extension APIs. Frames, objects, forms, popups,
and top-level navigation remain blocked.

Active mode is the default because most HTML documents depend on external
assets. A warning above every active preview states that the file can run
scripts and contact external servers. Only preview active HTML you trust,
especially in private repositories.

Turn off **Allow active content** in Chrome's extension side panel for restricted
mode. Restricted previews remove JavaScript and block external network access;
inline styles and embedded `data:` or `blob:` assets still render.

The extension validates raw source URLs against the current repository and
rejects HTML larger than 5 MB.

## Permissions

- `storage` remembers the active-content setting.
- `sidePanel` shows that setting in Chrome's native side panel.
- Access to `github.com` adds the preview control and reads the current file.

No repository content is stored through the `storage` permission.

## Load unpacked

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's root directory.
5. Open an HTML file on GitHub and click **HTML**.

Reload the extension and refresh GitHub after changing source files.

## Development

Run dependency-free checks with:

```sh
nvm use
npm run check
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for browser checks and
[`SECURITY.md`](SECURITY.md) for private vulnerability reporting.

Build a deterministic Chrome Web Store ZIP from a clean commit:

```sh
npm run package
```

The package and its SHA-256 checksum are written under `dist/`.

## Project structure

- [`manifest.json`](manifest.json) defines the dependency-free Manifest V3
  extension.
- [`src/content.js`](src/content.js) owns GitHub integration, source loading,
  settings, and preview lifecycle.
- [`src/preview-security.js`](src/preview-security.js) owns document hardening
  and mode-specific Content Security Policy.
- [`src/content.css`](src/content.css) owns the inline preview presentation.
- [`sidepanel/index.html`](sidepanel/index.html) exposes the global active-content
  setting through Chrome's native side panel.
- [`scripts/package.sh`](scripts/package.sh) creates the release ZIP from the
  committed extension files.
- [`STORE_LISTING.md`](STORE_LISTING.md) contains Chrome Web Store copy and
  submission fields.
- [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) documents data handling.

## Independence

Native HTML Preview for GitHub is an independent project. It is not affiliated
with, sponsored by, or endorsed by GitHub, Inc. GitHub is a trademark of GitHub,
Inc.

## License

[MIT](LICENSE)
