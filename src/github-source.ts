// Reads the current file through GitHub's page payload or authenticated raw URL.

(() => {
  'use strict';

  const RAW_BUTTON_SELECTOR = '[data-testid="raw-button"]';
  const EMBEDDED_DATA_SELECTOR =
    'script[type="application/json"][data-target="react-app.embeddedData"]';
  const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
  const MAX_CACHED_SOURCES = 8;
  const sourceCache = new Map<string, string>();

  async function loadHtmlSource(): Promise<HtmlSource> {
    const rawLink =
      document.querySelector<HTMLAnchorElement>(RAW_BUTTON_SELECTOR);
    const rawUrl = rawLink
      ? NativeHtmlPreviewSecurity.trustedRawUrl(
          rawLink.href,
          window.location.href
        )
      : '';
    const embedded = readEmbeddedSource();
    if (embedded) {
      assertSourceSize(embedded);
      return { html: embedded, baseUrl: rawUrl || window.location.href };
    }
    if (!rawUrl) {
      throw new Error('GitHub did not provide the HTML source URL');
    }
    const cached = sourceCache.get(rawUrl);
    if (cached !== undefined) {
      return { html: cached, baseUrl: rawUrl };
    }

    const response = await fetch(rawUrl, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Could not load HTML source (HTTP ${response.status})`);
    }
    const declaredSize = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_SOURCE_BYTES) {
      throw new Error('HTML source exceeds the 5 MB preview limit');
    }
    const html = await response.text();
    assertSourceSize(html);
    if (sourceCache.size >= MAX_CACHED_SOURCES) {
      sourceCache.clear();
    }
    sourceCache.set(rawUrl, html);
    return {
      html,
      baseUrl: NativeHtmlPreviewSecurity.trustedRawUrl(
        response.url || rawUrl,
        window.location.href
      ),
    };
  }

  function assertSourceSize(html: string): void {
    if (new Blob([html]).size > MAX_SOURCE_BYTES) {
      throw new Error('HTML source exceeds the 5 MB preview limit');
    }
  }

  function readEmbeddedSource(): string | null {
    for (const script of document.querySelectorAll(EMBEDDED_DATA_SELECTOR)) {
      if (!script.textContent) {
        continue;
      }
      try {
        const payload: unknown = JSON.parse(script.textContent);
        const path = findProperty(
          payload,
          'path',
          (value): value is string => typeof value === 'string'
        );
        if (!path || !window.location.pathname.endsWith(`/${path}`)) {
          continue;
        }
        const lines = findProperty(payload, 'rawLines', Array.isArray);
        if (lines?.every((line) => typeof line === 'string')) {
          return lines.join('\n');
        }
      } catch {}
    }
    return null;
  }

  function findProperty<T>(
    payload: unknown,
    property: string,
    accepts: (value: unknown) => value is T
  ): T | null {
    let found: T | null = null;
    const visit = (node: unknown): void => {
      if (found !== null || !node || typeof node !== 'object') {
        return;
      }
      const record = node as Record<string, unknown>;
      if (property in record && accepts(record[property])) {
        found = record[property];
        return;
      }
      for (const value of Object.values(record)) {
        visit(value);
      }
    };
    visit(payload);
    return found;
  }

  const api: NativeHtmlPreviewGitHubApi = Object.freeze({ loadHtmlSource });
  (
    globalThis as typeof globalThis & {
      NativeHtmlPreviewGitHub: NativeHtmlPreviewGitHubApi;
    }
  ).NativeHtmlPreviewGitHub = api;
})();
