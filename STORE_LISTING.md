# Chrome Web Store Listing

## Product details

**Title:** Native HTML Preview for GitHub

**Category:** Developer Tools

**Language:** English

**Summary:** Preview HTML inline on GitHub with sandboxed scripts, private
repository support, and no token or third-party renderer.

**Single purpose:** Render repository HTML files inline on GitHub.

## Detailed description

Preview HTML files where they live: inside GitHub.

Native HTML Preview for GitHub adds an **HTML** control beside GitHub's
**Code** and **Blame** controls. One click replaces the source section with the
browser-rendered document while GitHub's commit details, file statistics, and
navigation stay in place.

Key features:

- Preview `.html`, `.htm`, and `.xhtml` repository files inline.
- Use files from public or private repositories already open in your session.
- Run inline and HTTPS-hosted JavaScript in an isolated sandbox.
- Load relative and CDN-hosted styles, images, fonts, media, and libraries.
- Show a clear warning whenever scripts and external network access are enabled.
- Disable active content globally through Chrome's native side panel.
- Share or refresh preview state through the page URL.
- Switch back to Code or Blame without reloading the page.
- Use no API token, extra account, external renderer, analytics, or tracking.

Repository code cannot access your GitHub cookies, storage, page, or extension
APIs. Active content is enabled by default so real documents can load their
libraries and assets, but it can contact external servers. Turn it off in the
extension side panel for a script-free, network-blocked preview. Frames, forms,
objects, popups, and top-level navigation remain blocked in both modes.

Native HTML Preview for GitHub is independent and is not affiliated with,
sponsored by, or endorsed by GitHub, Inc.

## Name choice

“Native HTML Preview for GitHub” improves “Native HTML in Github” in three ways:

- **HTML Preview** matches the task people search for.
- **GitHub** uses the product's correct casing.
- **for GitHub** reads as compatibility rather than official ownership.

The title stays concise and descriptive, follows the [Chrome Web Store listing
guidance](https://developer.chrome.com/docs/webstore/best-listing), and keeps
the distinctive **Native** prefix in a store with several products named
[GitHub HTML Preview](https://chromewebstore.google.com/detail/github-html-preview/pdmpdkapppamcbbjgpfofidigdnhndmm).

## Privacy fields

- **Data handled:** Website content is read locally for preview. The developer
  does not collect it. Active repository code may transmit content to external
  servers selected by that code.
- **Remote code:** Repository inline and HTTPS-hosted JavaScript runs only inside
  an opaque-origin iframe isolated from extension APIs. This sandboxed context
  is covered by the [Manifest V3 remote-code exception](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements).
- **`storage`:** Remembers whether active content is enabled. No repository
  content is persisted.
- **`sidePanel`:** Provides the active-content setting in Chrome's native side
  panel.
- **Site access:** `github.com`, required to add the preview control and read the
  current file source.
- **Privacy policy:** Publish [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) at a stable
  public URL.

## Required assets

- 128 × 128 store icon: [`assets/icons/icon-128.png`](assets/icons/icon-128.png)
- 1280 × 800 screenshot: [`assets/store/native-html-preview-store-html-tab-active-20260903-1444.png`](assets/store/native-html-preview-store-html-tab-active-20260903-1444.png)
- 440 × 280 promotional tile: [`assets/store/promo-small-440x280.png`](assets/store/promo-small-440x280.png)
- Optional 1400 × 560 marquee image

Screenshots must show the real extension UI and current behavior. Use an
independent visual identity rather than GitHub's logo.
