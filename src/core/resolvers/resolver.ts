import type { FetchedResponse } from '../fetch.js';
import type { CoreOptions, NormalizedHeaders, ResolvedLink } from '../types.js';

/**
 * A fetched HTML page, handed from one resolver to the HTML resolver so the
 * page is fetched only once.
 */
export interface PageDocument {
  /** Final URL of the page (post-redirect). */
  url: string;
  /** Normalized response headers of the page. */
  headers: NormalizedHeaders;
  /** The raw, unconsumed page body. */
  body: ReadableStream<Uint8Array>;
  /** Normalized content type (e.g. `text/html`). */
  contentType: string;
}

/** Everything a resolver may need while doing its work. */
export interface ResolverContext {
  /** Effective request options (fetch impl, timeouts, max redirects). */
  readonly options: CoreOptions;
  /** Fetch a URL following redirects and return the final response. */
  readonly fetchPage: (url: string) => Promise<FetchedResponse>;
}

/**
 * The result of a resolver's attempt. A resolver is a small, standalone module
 * for one kind of "link / service": a plain redirect, an HTML page that embeds
 * a link, a provider-specific page, etc.
 */
export type ResolveResult =
  | { kind: 'handled'; link: ResolvedLink }
  | { kind: 'unhandled' }
  | { kind: 'redirect'; to: string }
  | { kind: 'page'; page: PageDocument };

/**
 * Plugin contract. Adding a new kind of service only means adding one new file
 * that implements this interface and appending it to the registry array — no
 * existing code has to change.
 */
export interface Resolver {
  /** Unique, stable name, reported in `ResolvedLink.resolvedBy`. */
  readonly name: string;
  /** Cheap URL-level predicate used to pick which resolvers to attempt. */
  canHandle(url: URL): boolean;
  /** Attempt to resolve the URL. */
  resolve(url: URL, ctx: ResolverContext): Promise<ResolveResult>;
  /**
   * Optional: handle an already-fetched HTML page. The HTML resolver
   * implements this so that it only re-parses pages handed to it, instead of
   * re-fetching every URL.
   */
  resolvePage?(page: PageDocument, ctx: ResolverContext): Promise<ResolveResult>;
}
