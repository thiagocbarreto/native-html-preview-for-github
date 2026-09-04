// Persists preview settings without exposing repository content.

(() => {
  'use strict';

  const ACTIVE_CONTENT_KEY = 'activeContentEnabled';
  const SHOW_WARNING_KEY = 'showActiveContentWarning';
  const activeContentToggle =
    requiredElement<HTMLInputElement>('#active-content');
  const warningToggle = requiredElement<HTMLInputElement>('#show-warning');
  const description = requiredElement<HTMLElement>('#mode-description');

  function requiredElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing required element: ${selector}`);
    }
    return element;
  }

  function renderToggle(toggle: HTMLInputElement, enabled: boolean): void {
    toggle.checked = enabled;
    toggle.setAttribute('aria-checked', String(enabled));
  }

  function renderActiveContent(enabled: boolean): void {
    renderToggle(activeContentToggle, enabled);
    description.dataset.active = String(enabled);
    description.textContent = enabled
      ? 'Active mode is on. HTML can run inline and external scripts, load HTTPS assets, and contact external servers.'
      : 'Restricted mode is on. JavaScript and external network access are blocked; inline styles and embedded assets still render.';
  }

  async function saveToggle(
    toggle: HTMLInputElement,
    key: string,
    render: (enabled: boolean) => void
  ): Promise<void> {
    const enabled = toggle.checked;
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({ [key]: enabled });
      render(enabled);
    } catch {
      render(!enabled);
      description.textContent = 'Could not save preview settings.';
    } finally {
      toggle.disabled = false;
    }
  }

  async function load(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get({
        [ACTIVE_CONTENT_KEY]: true,
        [SHOW_WARNING_KEY]: true,
      });
      renderActiveContent(stored[ACTIVE_CONTENT_KEY] !== false);
      renderToggle(warningToggle, stored[SHOW_WARNING_KEY] !== false);
    } catch {
      description.textContent = 'Could not load preview settings.';
    }
  }

  activeContentToggle.addEventListener('change', () => {
    void saveToggle(
      activeContentToggle,
      ACTIVE_CONTENT_KEY,
      renderActiveContent
    );
  });
  warningToggle.addEventListener('change', () => {
    void saveToggle(warningToggle, SHOW_WARNING_KEY, (enabled) => {
      renderToggle(warningToggle, enabled);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }
    const activeContentChange = changes[ACTIVE_CONTENT_KEY];
    if (activeContentChange) {
      renderActiveContent(activeContentChange.newValue !== false);
    }
    const warningChange = changes[SHOW_WARNING_KEY];
    if (warningChange) {
      renderToggle(warningToggle, warningChange.newValue !== false);
    }
  });

  renderActiveContent(true);
  renderToggle(warningToggle, true);
  void load();
})();
