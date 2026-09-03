// Keeps repository code inside an opaque-origin frame with mode-specific network access.

(() => {
  'use strict';

  function buildDocument(html, baseUrl, activeContentEnabled) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('iframe, frame, object, embed').forEach((node) =>
      node.remove()
    );
    doc.querySelectorAll('base').forEach((node) => node.remove());
    doc.querySelectorAll('meta[http-equiv]').forEach((meta) => {
      if ((meta.getAttribute('http-equiv') || '').toLowerCase() === 'refresh') {
        meta.remove();
      }
    });

    if (!activeContentEnabled) {
      doc.querySelectorAll('script').forEach((script) => script.remove());
      doc.querySelectorAll('*').forEach((element) => {
        for (const attribute of [...element.attributes]) {
          if (attribute.name.toLowerCase().startsWith('on')) {
            element.removeAttribute(attribute.name);
          }
        }
      });
      doc.querySelectorAll('a[href], area[href]').forEach((link) => {
        if (!link.getAttribute('href').trim().startsWith('#')) {
          link.removeAttribute('href');
        }
        link.removeAttribute('ping');
      });
    }

    const base = doc.createElement('base');
    base.href = baseUrl;
    const policy = doc.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = contentSecurityPolicy(activeContentEnabled);
    doc.head.prepend(base);
    doc.head.prepend(policy);

    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  function trustedRawUrl(value, pageHref) {
    const pageUrl = new URL(pageHref);
    const page = pageUrl.pathname.match(/^\/([^/]+)\/([^/]+)\//);
    let url;
    try {
      url = new URL(value, pageUrl);
    } catch {
      throw new Error('GitHub provided an invalid HTML source URL');
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const sameRepository =
      page &&
      parts[0]?.toLowerCase() === page[1].toLowerCase() &&
      parts[1]?.toLowerCase() === page[2].toLowerCase();
    const isGitHubRaw =
      url.origin === 'https://github.com' && parts[2] === 'raw';
    const isRawHost = url.origin === 'https://raw.githubusercontent.com';
    if (!sameRepository || (!isGitHubRaw && !isRawHost)) {
      throw new Error('GitHub provided an untrusted HTML source URL');
    }
    return url.href;
  }

  function contentSecurityPolicy(activeContentEnabled) {
    const sources = activeContentEnabled
      ? [
          "style-src 'unsafe-inline' https:",
          'font-src https: data:',
          'img-src https: data: blob:',
          'media-src https: data: blob:',
          "script-src 'unsafe-inline' https:",
          'connect-src https: wss:',
        ]
      : [
          "style-src 'unsafe-inline'",
          'font-src data:',
          'img-src data: blob:',
          'media-src data: blob:',
          "script-src 'none'",
          "connect-src 'none'",
        ];

    return [
      "default-src 'none'",
      ...sources,
      "frame-src 'none'",
      "object-src 'none'",
      "form-action 'none'",
      'base-uri https://github.com https://raw.githubusercontent.com',
    ].join('; ');
  }

  globalThis.NativeHtmlPreviewSecurity = Object.freeze({
    buildDocument,
    contentSecurityPolicy,
    trustedRawUrl,
  });
})();
