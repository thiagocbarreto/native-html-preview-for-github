# Privacy Policy

Native HTML Preview for GitHub does not collect, sell, transfer, or persist
personal data.

## Data handled

The extension reads the source of the HTML file shown on the current GitHub page
so it can render that file. Source stays in the current browser tab's memory. If
GitHub does not embed the source in the page, the extension fetches the file from
its GitHub raw URL using the existing browser session.

The extension stores one boolean setting in `chrome.storage.local`: whether
active content is enabled. It does not persist repository content.

The extension has no analytics, account, API token, advertising, or developer
server. GitHub page and file content is used only to provide the preview and is
not transferred for unrelated purposes.

## Preview network requests

Active content is enabled by default. Previewed documents may run inline and
HTTPS-hosted scripts, load HTTPS styles, images, fonts, and media, and make HTTPS
or secure WebSocket requests. Those requests go directly from the browser to
hosts selected by the repository HTML, not to the extension developer. Scripts
can include preview content in outbound requests.

Turning off **Allow active content** removes JavaScript and blocks external
network access. Frames, objects, forms, popups, and top-level navigation remain
blocked in both modes. The preview cannot access GitHub cookies, GitHub storage,
the GitHub page, or extension APIs.

## Scope

The extension runs only on `github.com` and activates only on repository HTML
blob and blame pages.

## Contact

Report privacy questions through the project's [GitHub issues](https://github.com/thiagocbarreto/native-html-preview-for-github/issues).
