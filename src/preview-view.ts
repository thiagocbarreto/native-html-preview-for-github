// Owns the GitHub source swap and all trusted UI around the sandboxed frame.

(() => {
  'use strict';

  const CONTENT_CONTAINER_SELECTOR =
    '[class*="BlobViewContent-module__blobContentWrapper"]';
  const SOURCE_CONTENT_SELECTOR =
    '[class*="BlobContent-module__blobContentSection"]';
  const PREVIEW_CLASS = 'native-html-preview';
  const SOURCE_HIDDEN_CLASS = 'native-html-source-hidden';

  class HtmlPreviewView implements NativeHtmlPreviewViewApi {
    readonly #openSettings: () => void;
    #element: HTMLElement | null = null;

    constructor(openSettings: () => void) {
      this.#openSettings = openSettings;
    }

    get isEmpty(): boolean {
      return !this.#element?.hasChildNodes();
    }

    show(): void {
      const container = document.querySelector<HTMLElement>(
        CONTENT_CONTAINER_SELECTOR
      );
      const source = container?.querySelector<HTMLElement>(
        SOURCE_CONTENT_SELECTOR
      );
      if (!container || !source) {
        return;
      }
      source.classList.add(SOURCE_HIDDEN_CLASS);

      if (!this.#element?.isConnected) {
        this.#element = document.createElement('section');
        this.#element.className = PREVIEW_CLASS;
        this.#element.setAttribute('aria-label', 'Rendered HTML preview');
        this.#element.style.marginTop = source.style.marginTop;
        source.insertAdjacentElement('afterend', this.#element);
      }
    }

    renderDocument(source: string, options: HtmlPreviewOptions): void {
      if (!this.#element) {
        return;
      }
      this.#element.textContent = '';
      if (options.activeContentEnabled && options.showActiveContentWarning) {
        this.#element.appendChild(this.#activeContentWarning());
      }

      const iframe = document.createElement('iframe');
      iframe.className = `${PREVIEW_CLASS}__frame`;
      iframe.title = 'Rendered HTML';
      iframe.setAttribute(
        'sandbox',
        options.activeContentEnabled ? 'allow-scripts' : ''
      );
      iframe.referrerPolicy = 'no-referrer';
      iframe.srcdoc = source;
      this.#element.appendChild(iframe);
    }

    renderStatus(message: string, isError = false): void {
      this.show();
      if (!this.#element) {
        return;
      }
      this.#element.textContent = '';
      const status = document.createElement('div');
      status.className = `${PREVIEW_CLASS}__status`;
      status.toggleAttribute('data-error', isError);
      status.textContent = message;
      this.#element.appendChild(status);
    }

    reset(): void {
      document
        .querySelectorAll(`.${SOURCE_HIDDEN_CLASS}`)
        .forEach((content) => {
          content.classList.remove(SOURCE_HIDDEN_CLASS);
        });
      this.#element?.remove();
      this.#element = null;
    }

    #activeContentWarning(): HTMLElement {
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
      settings.addEventListener('click', this.#openSettings);
      warning.appendChild(settings);
      return warning;
    }
  }

  (
    globalThis as typeof globalThis & {
      NativeHtmlPreviewView: typeof HtmlPreviewView;
    }
  ).NativeHtmlPreviewView = HtmlPreviewView;
})();
