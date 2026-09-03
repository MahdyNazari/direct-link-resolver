/**
 * Typed errors surfaced by the public API. Keeping them in one place lets
 * callers catch precisely the failure they care about without string matching.
 */

/** Base class for every error thrown by this library. */
export class DirectLinkResolverError extends Error {
  public override readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    // Preserve the underlying cause across engines (Node, browsers, Workers).
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
  }
}

/** The input URL was not an http(s) URL we can operate on. */
export class UnsupportedUrlError extends DirectLinkResolverError {}

/** No registered resolver could determine a direct link for the URL. */
export class ResolutionError extends DirectLinkResolverError {}

/** Too many redirects / re-resolutions were followed, or a cycle was detected. */
export class RedirectError extends DirectLinkResolverError {}

/** The server answered with a non-success status while resolving. */
export class HttpStatusError extends DirectLinkResolverError {
  public readonly status: number;
  public readonly url: string;

  constructor(status: number, url: string, message?: string) {
    super(message ?? `HTTP ${status} for ${url}`, { cause: status });
    this.status = status;
    this.url = url;
  }
}

/** A download sink was required but not provided. */
export class SinkError extends DirectLinkResolverError {}

/** The download was aborted or the stream ended unexpectedly. */
export class DownloadError extends DirectLinkResolverError {}
