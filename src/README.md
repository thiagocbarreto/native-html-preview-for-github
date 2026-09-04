# Source Architecture

The extension keeps GitHub integration, source loading, trusted UI, and
untrusted document handling separate. [`manifest.json`](../manifest.json) loads
the content scripts into the same isolated extension world before the
coordinator starts.

## Files

| File | Responsibility | Relationship |
| --- | --- | --- |
| [`content.ts`](content.ts) | Coordinates page detection, URL state, the **HTML** tab, settings, and GitHub navigation events. | Calls the source, security, and view APIs. |
| [`github-source.ts`](github-source.ts) | Reads HTML from GitHub's embedded page data or authenticated raw-file URL, then applies source limits and caching. | Uses `preview-security.ts` to accept only raw URLs for the current repository. |
| [`preview-security.ts`](preview-security.ts) | Removes privileged document features, builds the active or restricted Content Security Policy, and validates raw URLs. | Returns the complete document passed to `preview-view.ts`. |
| [`preview-view.ts`](preview-view.ts) | Hides GitHub's source panel and owns loading states, errors, warnings, and the sandboxed iframe. | Receives hardened documents from `content.ts`; repository code stays below this boundary. |
| [`background.ts`](background.ts) | Connects the extension toolbar action and trusted warning button to Chrome's native side panel. | Handles no repository content. |
| [`content.css`](content.css) | Styles the trusted preview container, warning, status, and iframe within GitHub. | Loaded beside the content scripts by the manifest. |
| [`globals.d.ts`](globals.d.ts) | Defines compile-time contracts for APIs shared between classic content scripts. | Emits no JavaScript. |

## Runtime relationship

```text
GitHub file page
    │
    ▼
content.ts ──────► github-source.ts ──────► GitHub page data or raw file
    │                       │
    │                       ▼
    ├──────────────► preview-security.ts
    │                       │
    ▼                       ▼
preview-view.ts ◄──── hardened HTML document
    │
    ▼
opaque-origin sandboxed iframe

sidepanel/sidepanel.ts ── chrome.storage ──► content.ts
background.ts ─────────── Chrome side panel
```

## Module boundary

Content scripts are classic scripts rather than JavaScript modules because
Chrome's manifest content-script list does not load ES modules directly. Each
file exposes one small typed global API in the isolated extension world;
[`globals.d.ts`](globals.d.ts) keeps those contracts explicit. The build emits
one JavaScript file per TypeScript file without adding a bundler.

Only [`preview-view.ts`](preview-view.ts) inserts repository HTML, and it inserts
only the document returned by [`preview-security.ts`](preview-security.ts).
Repository scripts run inside the opaque-origin iframe and cannot access these
global APIs, GitHub data, or Chrome extension APIs.
