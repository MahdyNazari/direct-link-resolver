/**
 * direct-link-resolver — public API entry point.
 *
 * This module only re-exports the portable core. It deliberately does NOT
 * import anything Node-specific, so it can be consumed in Node 18+, browsers
 * and Cloudflare Workers. The Node filesystem sink is available separately via
 * the `direct-link-resolver/node` subpath (see `createFileSink`).
 */

export { resolveLink } from './core/resolve.js';
export { downloadFile } from './core/download.js';

export { resolvers, RedirectResolver, HtmlPageResolver } from './core/resolvers/index.js';
export { defaultFetch } from './core/runtime.js';

export {
  DirectLinkResolverError,
  UnsupportedUrlError,
  ResolutionError,
  RedirectError,
  HttpStatusError,
  SinkError,
  DownloadError,
} from './core/errors.js';

export type {
  ResolvedLink,
  ResolveOptions,
  CoreOptions,
  NormalizedHeaders,
  DownloadOptions,
  DownloadResult,
  DownloadProgress,
  DownloadSink,
} from './core/types.js';

export type { FetchLike } from './core/runtime.js';
export type {
  Resolver,
  ResolverContext,
  ResolveResult,
  PageDocument,
} from './core/resolvers/resolver.js';
