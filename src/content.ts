// Native HTML Preview for GitHub — isolated previews for repository HTML files

(() => {
  'use strict';

  const HTML_FILE_PATH =
    /^\/[^/]+\/[^/]+\/(?:blob|blame)\/.+\.(?:html?|xhtml)$/i;
  const FILE_VIEW_SELECTOR =
    'ul[aria-label="File view"][data-component="SegmentedControl"]';
  const TAB_CLASS = 'native-html-preview-tab';
  const RENDER_PARAM = 'native-html';
  const RENDER_VALUE = 'preview';
  const ACTIVE_CONTENT_KEY = 'activeContentEnabled';
  const SHOW_WARNING_KEY = 'showActiveContentWarning';
  const OPEN_SETTINGS_MESSAGE = 'native-html-preview:open-settings';
  const preview = new NativeHtmlPreviewView(openSettings);
  let previewSelected = false;
  let activeContentEnabled = true;
  let showActiveContentWarning = true;
  let settingsReady = false;
  let activePage = '';
  let loadSequence = 0;
  let updateScheduled = false;

  function pageKey(): string {
    const url = new URL(window.location.href);
    url.searchParams.delete(RENDER_PARAM);
    return url.pathname + url.search;
  }

  function isRenderedRequested(): boolean {
    return (
      new URL(window.location.href).searchParams.get(RENDER_PARAM) ===
      RENDER_VALUE
    );
  }

  function setRenderedParam(rendered: boolean): void {
    const url = new URL(window.location.href);
    if (rendered) {
      url.searchParams.set(RENDER_PARAM, RENDER_VALUE);
    } else {
      url.searchParams.delete(RENDER_PARAM);
    }
    window.history.replaceState(window.history.state, '', url);
  }

  function isHtmlFilePage(): boolean {
    return HTML_FILE_PATH.test(window.location.pathname);
  }

  function update(): void {
    if (!settingsReady) {
      return;
    }

    const currentPage = pageKey();
    const requested = isRenderedRequested();
    if (currentPage !== activePage || requested !== previewSelected) {
      resetPreview();
      activePage = currentPage;
      previewSelected = requested;
    }

    if (!isHtmlFilePage()) {
      removeTab();
      return;
    }

    const tabs = document.querySelector<HTMLUListElement>(FILE_VIEW_SELECTOR);
    if (!tabs) {
      return;
    }

    ensureNativeTabListener(tabs);
    ensureTab(tabs);
    if (previewSelected) {
      preview.show();
      setRenderedSelection(tabs, true);
      if (preview.isEmpty) {
        void loadPreview();
      }
    }
  }

  function ensureTab(tabs: HTMLUListElement): void {
    if (tabs.querySelector(`.${TAB_CLASS}`)) {
      return;
    }

    const template = [...tabs.children].find((item) =>
      item.querySelector('button')
    );
    if (!template) {
      return;
    }

    const item = template.cloneNode(true) as HTMLElement;
    item.classList.add(TAB_CLASS);
    item.removeAttribute('data-selected');

    const button = item.querySelector<HTMLButtonElement>('button');
    if (!button) {
      return;
    }
    button.setAttribute('aria-pressed', 'false');
    button.style.setProperty('--separator-color', 'var(--borderColor-default)');
    button.addEventListener('click', onRenderedHtmlClick);

    const text = item.querySelector<HTMLElement>('[data-text]');
    if (text) {
      text.dataset.text = 'HTML';
      text.textContent = 'HTML';
    } else {
      button.textContent = 'HTML';
    }

    tabs.appendChild(item);
  }

  function ensureNativeTabListener(tabs: HTMLUListElement): void {
    if (tabs.dataset.nativeHtmlPreviewListener === 'true') {
      return;
    }
    tabs.dataset.nativeHtmlPreviewListener = 'true';
    tabs.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(`.${TAB_CLASS}`)) {
        deactivate();
      }
    });
  }

  function removeTab(): void {
    document.querySelectorAll(`.${TAB_CLASS}`).forEach((tab) => {
      tab.remove();
    });
  }

  function onRenderedHtmlClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    previewSelected = true;
    activePage = pageKey();
    setRenderedParam(true);
    preview.show();
    const tabs = document.querySelector<HTMLUListElement>(FILE_VIEW_SELECTOR);
    if (tabs) {
      setRenderedSelection(tabs, true);
    }
    void loadPreview();
  }

  function setRenderedSelection(
    tabs: HTMLUListElement,
    rendered: boolean
  ): void {
    for (const item of tabs.children) {
      const button = item.querySelector<HTMLButtonElement>('button');
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

  function isCodeTab(item: Element): boolean {
    const text = item.querySelector<HTMLElement>('[data-text]');
    return text?.dataset.text === 'Code';
  }

  async function loadPreview(): Promise<void> {
    const sequence = ++loadSequence;
    const requestedPage = pageKey();
    preview.renderStatus('Loading rendered HTML…');

    try {
      const { html, baseUrl } = await NativeHtmlPreviewGitHub.loadHtmlSource();
      if (
        sequence !== loadSequence ||
        !previewSelected ||
        pageKey() !== requestedPage
      ) {
        return;
      }
      preview.renderDocument(
        NativeHtmlPreviewSecurity.buildDocument(
          html,
          baseUrl,
          activeContentEnabled
        ),
        { activeContentEnabled, showActiveContentWarning }
      );
    } catch (error) {
      if (sequence === loadSequence && previewSelected) {
        preview.renderStatus(
          error instanceof Error ? error.message : String(error),
          true
        );
      }
    }
  }

  function openSettings(): void {
    chrome.runtime.sendMessage({ type: OPEN_SETTINGS_MESSAGE }).catch(() => {
      preview.renderStatus('Could not open the extension side panel', true);
    });
  }

  function resetPreview(): void {
    loadSequence += 1;
    preview.reset();
  }

  function deactivate(): void {
    previewSelected = false;
    resetPreview();
    setRenderedParam(false);
    const tabs = document.querySelector<HTMLUListElement>(FILE_VIEW_SELECTOR);
    if (tabs) {
      setRenderedSelection(tabs, false);
    }
  }

  function scheduleUpdate(): void {
    if (updateScheduled) {
      return;
    }
    updateScheduled = true;
    window.requestAnimationFrame(() => {
      updateScheduled = false;
      update();
    });
  }

  async function loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get({
        [ACTIVE_CONTENT_KEY]: true,
        [SHOW_WARNING_KEY]: true,
      });
      activeContentEnabled = stored[ACTIVE_CONTENT_KEY] !== false;
      showActiveContentWarning = stored[SHOW_WARNING_KEY] !== false;
    } catch {
      activeContentEnabled = true;
    }
    settingsReady = true;
    scheduleUpdate();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }

    let changed = false;
    const activeContentChange = changes[ACTIVE_CONTENT_KEY];
    if (activeContentChange) {
      const enabled = activeContentChange.newValue !== false;
      changed = enabled !== activeContentEnabled;
      activeContentEnabled = enabled;
    }

    const warningChange = changes[SHOW_WARNING_KEY];
    if (warningChange) {
      const visible = warningChange.newValue !== false;
      changed = changed || visible !== showActiveContentWarning;
      showActiveContentWarning = visible;
    }

    if (changed && previewSelected) {
      resetPreview();
      scheduleUpdate();
    }
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
  previewSelected = isRenderedRequested();
  void loadSettings();
})();
