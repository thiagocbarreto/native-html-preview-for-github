// Opens the extension's settings in Chrome's native side panel.

(() => {
  'use strict';

  const OPEN_SETTINGS_MESSAGE = 'native-html-preview:open-settings';

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Could not configure side panel', error));

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== OPEN_SETTINGS_MESSAGE || !sender.tab?.id) {
      return;
    }
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .catch((error) => console.error('Could not open side panel', error));
  });
})();
