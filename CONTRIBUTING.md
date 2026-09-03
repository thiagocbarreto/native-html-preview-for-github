# Contributing

Bug reports and focused pull requests are welcome.

Report security problems through the private process in
[`SECURITY.md`](SECURITY.md), not through a public issue.

## Development

The extension uses browser APIs and plain JavaScript with no build step or
installed dependencies.

1. Fork and clone the [repository](https://github.com/thiagocbarreto/native-html-preview-for-github).
2. Run `npm test`.
3. Load the repository root through `chrome://extensions`.
4. Test one blob page, one blame page, and GitHub soft navigation.
5. Test both active and restricted preview modes.

Keep changes within the extension's single purpose: rendering repository HTML
inside GitHub. Update privacy and store disclosures whenever permissions,
storage, network access, or remote-code behavior changes.

## Pull requests

Explain the user-visible outcome and security impact. Include a regression test
for fixes and visible proof for UI changes.
