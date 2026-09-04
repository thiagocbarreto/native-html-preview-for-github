# Contributing

Bug reports and focused pull requests are welcome.

Report security problems through the private process in
[`SECURITY.md`](SECURITY.md), not through a public issue.

## Development

The extension uses TypeScript, Biome, and Playwright during development. The
packaged extension has no runtime dependency.

1. Fork and clone the [repository](https://github.com/thiagocbarreto/native-html-preview-for-github).
2. Run `npm ci --ignore-scripts`.
3. Run `npx --no-install playwright install chromium`.
4. Run `npm run check`.
5. Load `dist/extension` through `chrome://extensions` when testing manually.

Keep changes within the extension's single purpose: rendering repository HTML
inside GitHub. Update privacy and store disclosures whenever permissions,
storage, network access, or remote-code behavior changes.

## Pull requests

Explain the user-visible outcome and security impact. Include a regression test
for fixes and visible proof for UI changes.
