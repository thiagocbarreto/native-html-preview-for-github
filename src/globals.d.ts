interface HtmlSource {
  baseUrl: string;
  html: string;
}

interface NativeHtmlPreviewGitHubApi {
  loadHtmlSource(): Promise<HtmlSource>;
}

interface HtmlPreviewOptions {
  activeContentEnabled: boolean;
  showActiveContentWarning: boolean;
}

interface NativeHtmlPreviewViewApi {
  readonly isEmpty: boolean;
  renderDocument(source: string, options: HtmlPreviewOptions): void;
  renderStatus(message: string, isError?: boolean): void;
  reset(): void;
  show(): void;
}

interface NativeHtmlPreviewViewConstructor {
  new (openSettings: () => void): NativeHtmlPreviewViewApi;
}

interface NativeHtmlPreviewSecurityApi {
  buildDocument(
    html: string,
    baseUrl: string,
    activeContentEnabled: boolean
  ): string;
  contentSecurityPolicy(activeContentEnabled: boolean): string;
  trustedRawUrl(value: string, pageHref: string): string;
}

declare const NativeHtmlPreviewGitHub: NativeHtmlPreviewGitHubApi;
declare const NativeHtmlPreviewSecurity: NativeHtmlPreviewSecurityApi;
declare const NativeHtmlPreviewView: NativeHtmlPreviewViewConstructor;
