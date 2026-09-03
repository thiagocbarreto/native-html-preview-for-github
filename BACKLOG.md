# Backlog

## Persistent storage for sandboxed HTML previews

The [HTML preview](src/content.js) keeps repository code in an opaque-origin iframe so rendered files cannot access GitHub cookies, storage, or DOM. Native `localStorage` therefore remains unavailable.

Add a synchronous `localStorage`-compatible shim backed by [`chrome.storage.local`](https://developer.chrome.com/docs/extensions/reference/api/storage):

- Load stored values before repository scripts run.
- Persist `setItem`, `removeItem`, and `clear` through authenticated `postMessage` events.
- Support `length`, `key`, and `getItem` synchronously inside the iframe.
- Namespace data by repository, ref, and file path.
- Verify message source and a per-preview token before accepting writes.
- Enforce a per-preview quota so repository code cannot exhaust extension storage.
- Keep `allow-same-origin` disabled.
