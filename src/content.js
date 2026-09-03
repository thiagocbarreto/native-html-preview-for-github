// Native HTML Preview for GitHub — isolated previews for repository HTML files

(() => {
  'use strict';

  const HTML_FILE_PATH =
    /^\/[^/]+\/[^/]+\/(?:blob|blame)\/.+\.(?:html?|xhtml)$/i;
  const FILE_VIEW_SELECTOR =
    'ul[aria-label="File view"][data-component="SegmentedControl"]';
  const CONTENT_CONTAINER_SELECTOR =
    '[class*="BlobViewContent-module__blobContentWrapper"]';
  const SOURCE_CONTENT_SELECTOR =
    '[class*="BlobContent-module__blobContentSection"]';
  const RAW_BUTTON_SELECTOR = '[data-testid="raw-button"]';
  const EMBEDDED_DATA_SELECTOR =
    'script[type="application/json"][data-target="react-app.embeddedData"]';
  const TAB_CLASS = 'native-html-preview-tab';
  const PREVIEW_CLASS = 'native-html-preview';
  const SOURCE_HIDDEN_CLASS = 'native-html-source-hidden';
  const RENDER_PARAM = 'native-html';
  const RENDER_VALUE = 'preview';
  const ACTIVE_CONTENT_KEY = 'activeContentEnabled';
  const OPEN_SETTINGS_MESSAGE = 'native-html-preview:open-settings';
  const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
  const MAX_CACHED_SOURCES = 8;

  const sourceCache = new Map();
  let active = false;
  let activeContentEnabled = true;
  let settingsReady = false;
  let activePage = '';
  let previewEl = null;
  let loadSequence = 0;
  let updateScheduled = false;

  function pageKey() {
    const url = new URL(window.location.href);
    url.searchParams.delete(RENDER_PARAM);
    return url.pathname + url.search;
  }

  function isRenderedRequested() {
    return (
      new URL(window.location.href).searchParams.get(RENDER_PARAM) ===
      RENDER_VALUE
    );
  }

  function setRenderedParam(rendered) {
    const url = new URL(window.location.href);
    if (rendered) {
      url.searchParams.set(RENDER_PARAM, RENDER_VALUE);
    } else {
      url.searchParams.delete(RENDER_PARAM);
    }
    window.history.replaceState(window.history.state, '', url);
  }

  function isHtmlFilePage() {
    return HTML_FILE_PATH.test(window.location.pathname);
  }

  function update() {
    if (!settingsReady) {
      return;
    }

    const currentPage = pageKey();
    const requested = isRenderedRequested();
    if (currentPage !== activePage || requested !== active) {
      resetPreview();
      activePage = currentPage;
      active = requested;
    }

    if (!isHtmlFilePage()) {
      removeTab();
      return;
    }

    const tabs = document.querySelector(FILE_VIEW_SELECTOR);
    if (!tabs) {
      return;
    }

    ensureNativeTabListener(tabs);
    ensureTab(tabs);
    if (active) {
      showPreview();
      setRenderedSelection(tabs, true);
      if (previewEl && !previewEl.hasChildNodes()) {
        loadPreview();
      }
    }
  }

  function ensureTab(tabs) {
    if (tabs.querySelector(`.${TAB_CLASS}`)) {
      return;
    }

    const template = [...tabs.children].find((item) =>
      item.querySelector('button')
    );
    if (!template) {
      return;
    }

    const item = template.cloneNode(true);
    item.classList.add(TAB_CLASS);
    item.removeAttribute('data-selected');

    const button = item.querySelector('button');
    button.setAttribute('aria-pressed', 'false');
    button.style.setProperty(
      '--separator-color',
      'var(--borderColor-default)'
    );
    button.addEventListener('click', onRenderedHtmlClick);

    const text = item.querySelector('[data-text]');
    if (text) {
      text.dataset.text = 'HTML';
      text.textContent = 'HTML';
    } else {
      button.textContent = 'HTML';
    }

    tabs.appendChild(item);
  }

  function ensureNativeTabListener(tabs) {
    if (tabs.dataset.nativeHtmlPreviewListener === 'true') {
      return;
    }
    tabs.dataset.nativeHtmlPreviewListener = 'true';
    tabs.addEventListener('click', (event) => {
      if (!event.target.closest(`.${TAB_CLASS}`)) {
        deactivate();
      }
    });
  }

  function removeTab() {
    document.querySelectorAll(`.${TAB_CLASS}`).forEach((tab) => tab.remove());
  }

  function onRenderedHtmlClick(event) {
    event.preventDefault();
    event.stopPropagation();
    active = true;
    activePage = pageKey();
    setRenderedParam(true);
    showPreview();
    const tabs = document.querySelector(FILE_VIEW_SELECTOR);
    if (tabs) {
      setRenderedSelection(tabs, true);
    }
    loadPreview();
  }

  function setRenderedSelection(tabs, rendered) {
    for (const item of tabs.children) {
      const button = item.querySelector('button');
      if (!button) {
        continue;
      }
      const isRendered = item.classList.contains(TAB_CLASS);
      const selected = rendered ? isRendered : isCodeTab(item);
      item.toggleAttribute('data-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.style.setProperty(
        '--separator-color',
        selected ? 'transparent' : 'var(--borderColor-default)'
      );
    }
  }

  function isCodeTab(item) {
    const text = item.querySelector('[data-text]');
    return text && text.dataset.text === 'Code';
  }

  function showPreview() {
    const container = document.querySelector(CONTENT_CONTAINER_SELECTOR);
    const source = container && container.querySelector(SOURCE_CONTENT_SELECTOR);
    if (!container || !source) {
      return;
    }
    source.classList.add(SOURCE_HIDDEN_CLASS);

    if (!previewEl || !previewEl.isConnected) {
      previewEl = document.createElement('section');
      previewEl.className = PREVIEW_CLASS;
      previewEl.setAttribute('aria-label', 'Rendered HTML preview');
      previewEl.style.marginTop = source.style.marginTop;
      source.insertAdjacentElement('afterend', previewEl);
    }
  }

  async function loadPreview() {
    const sequence = ++loadSequence;
    const requestedPage = pageKey();
    renderStatus('Loading rendered HTML…');

    try {
      const { html, baseUrl } = await loadHtmlSource();
      if (
        sequence !== loadSequence ||
        !active ||
        pageKey() !== requestedPage
      ) {
        return;
      }
      const mode = activeContentEnabled;
      renderIframe(
        NativeHtmlPreviewSecurity.buildDocument(html, baseUrl, mode),
        mode
      );
    } catch (error) {
      if (sequence === loadSequence && active) {
        renderStatus(
          error && error.message ? error.message : String(error),
          true
        );
      }
    }
  }

  async function loadHtmlSource() {
    const rawLink = document.querySelector(RAW_BUTTON_SELECTOR);
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
    if (sourceCache.has(rawUrl)) {
      return { html: sourceCache.get(rawUrl), baseUrl: rawUrl };
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

  function assertSourceSize(html) {
    if (new Blob([html]).size > MAX_SOURCE_BYTES) {
      throw new Error('HTML source exceeds the 5 MB preview limit');
    }
  }

  function readEmbeddedSource() {
    for (const script of document.querySelectorAll(EMBEDDED_DATA_SELECTOR)) {
      if (!script.textContent) {
        continue;
      }
      try {
        const payload = JSON.parse(script.textContent);
        const path = findStringProperty(payload, 'path');
        if (!path || !window.location.pathname.endsWith('/' + path)) {
          continue;
        }
        const lines = findArrayProperty(payload, 'rawLines');
        if (lines && lines.every((line) => typeof line === 'string')) {
          return lines.join('\n');
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  function findStringProperty(payload, property) {
    return findProperty(payload, property, (value) => typeof value === 'string');
  }

  function findArrayProperty(payload, property) {
    return findProperty(payload, property, Array.isArray);
  }

  function findProperty(payload, property, accepts) {
    let found = null;
    const visit = (node) => {
      if (found !== null || !node || typeof node !== 'object') {
        return;
      }
      if (property in node && accepts(node[property])) {
        found = node[property];
        return;
      }
      for (const value of Object.values(node)) {
        visit(value);
      }
    };
    visit(payload);
    return found;
  }

  function renderIframe(source, allowActiveContent) {
    if (!previewEl) {
      return;
    }
    previewEl.textContent = '';
    if (allowActiveContent) {
      previewEl.appendChild(buildActiveContentWarning());
    }

    const iframe = document.createElement('iframe');
    iframe.className = `${PREVIEW_CLASS}__frame`;
    iframe.title = 'Rendered HTML';
    iframe.setAttribute('sandbox', allowActiveContent ? 'allow-scripts' : '');
    iframe.referrerPolicy = 'no-referrer';
    iframe.srcdoc = source;
    previewEl.appendChild(iframe);
  }

  function buildActiveContentWarning() {
    const warning = document.createElement('aside');
    warning.className = `${PREVIEW_CLASS}__warning`;
    warning.setAttribute('role', 'status');

    const text = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = 'Active content enabled.';
    text.appendChild(title);
    text.append(
      ' This file can run scripts, load external assets, and contact external servers.'
    );
    warning.appendChild(text);

    const settings = document.createElement('button');
    settings.type = 'button';
    settings.textContent = 'Open settings';
    settings.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: OPEN_SETTINGS_MESSAGE }).catch(() => {
        renderStatus('Could not open the extension side panel', true);
      });
    });
    warning.appendChild(settings);
    return warning;
  }

  function renderStatus(message, isError = false) {
    showPreview();
    if (!previewEl) {
      return;
    }
    previewEl.textContent = '';
    const status = document.createElement('div');
    status.className = `${PREVIEW_CLASS}__status`;
    status.toggleAttribute('data-error', isError);
    status.textContent = message;
    previewEl.appendChild(status);
  }

  function resetPreview() {
    loadSequence += 1;
    document
      .querySelectorAll(`.${SOURCE_HIDDEN_CLASS}`)
      .forEach((content) => content.classList.remove(SOURCE_HIDDEN_CLASS));
    if (previewEl) {
      previewEl.remove();
      previewEl = null;
    }
  }

  function deactivate() {
    active = false;
    resetPreview();
    setRenderedParam(false);
    const tabs = document.querySelector(FILE_VIEW_SELECTOR);
    if (tabs) {
      setRenderedSelection(tabs, false);
    }
  }

  function scheduleUpdate() {
    if (updateScheduled) {
      return;
    }
    updateScheduled = true;
    window.requestAnimationFrame(() => {
      updateScheduled = false;
      update();
    });
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get({
        [ACTIVE_CONTENT_KEY]: true,
      });
      activeContentEnabled = stored[ACTIVE_CONTENT_KEY] !== false;
    } catch {
      activeContentEnabled = true;
    }
    settingsReady = true;
    scheduleUpdate();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(ACTIVE_CONTENT_KEY in changes)) {
      return;
    }
    const enabled = changes[ACTIVE_CONTENT_KEY].newValue !== false;
    if (enabled === activeContentEnabled) {
      return;
    }
    activeContentEnabled = enabled;
    if (active) {
      resetPreview();
    }
    scheduleUpdate();
  });

  new MutationObserver(scheduleUpdate).observe(document.body, {
    childList: true,
    subtree: true,
  });
  document.addEventListener('turbo:render', scheduleUpdate);
  document.addEventListener('turbo:load', scheduleUpdate);
  document.addEventListener('soft-nav:end', scheduleUpdate);
  window.addEventListener('popstate', scheduleUpdate);

  activePage = pageKey();
  active = isRenderedRequested();
  loadSettings();
})();
