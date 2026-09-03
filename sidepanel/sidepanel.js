// Persists the global preview mode without exposing repository content.

(() => {
  'use strict';

  const ACTIVE_CONTENT_KEY = 'activeContentEnabled';
  const toggle = document.querySelector('#active-content');
  const description = document.querySelector('#mode-description');

  function render(enabled) {
    toggle.checked = enabled;
    description.dataset.active = String(enabled);
    description.textContent = enabled
      ? 'Active mode is on. HTML can run inline and external scripts, load HTTPS assets, and contact external servers.'
      : 'Restricted mode is on. JavaScript and external network access are blocked; inline styles and embedded assets still render.';
  }

  async function load() {
    try {
      const stored = await chrome.storage.local.get({
        [ACTIVE_CONTENT_KEY]: true,
      });
      render(stored[ACTIVE_CONTENT_KEY] !== false);
    } catch {
      description.textContent = 'Could not load preview settings.';
    }
  }

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({ [ACTIVE_CONTENT_KEY]: enabled });
      render(enabled);
    } catch {
      toggle.checked = !enabled;
      description.textContent = 'Could not save preview settings.';
    } finally {
      toggle.disabled = false;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ACTIVE_CONTENT_KEY in changes) {
      render(changes[ACTIVE_CONTENT_KEY].newValue !== false);
    }
  });

  render(true);
  load();
})();
