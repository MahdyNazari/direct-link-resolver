import { assertHttpUrl } from './url.js';
import { fetchWithRedirects } from './fetch.js';
import { defaultFetch } from './runtime.js';
import {
  RedirectError,
  ResolutionError,
} from './errors.js';
import { resolvers, getResolver, type ResolveResult } from './resolvers/index.js';
import type { ResolverContext } from './resolvers/resolver.js';
import type { CoreOptions, ResolveOptions, ResolvedLink } from './types.js';

interface NormalizedOptions {
  fetch: NonNullable<CoreOptions['fetch']>;
  maxRedirects: number;
  timeoutMs?: number;
}

/**
 * Resolve `input` to the terminal, directly downloadable link.
 *
 * The resolver pipeline is iterative so that any resolver can route to a new
 * URL (an HTTP redirect, or an embedded link found in HTML) and that URL is
 * run through the whole pipeline again. A visited set prevents infinite loops.
 */
export async function resolveLink(
  input: string,
  options: ResolveOptions = {},
): Promise<ResolvedLink> {
  const startUrl = assertHttpUrl(input);
  const opts = normalizeOptions(options);
  const ctx: ResolverContext = {
    options: opts,
    fetchPage: (url: string) => fetchWithRedirects(url, opts),
  };

  let current = startUrl.toString();
  const visited = new Set<string>();
  /** Resolver names that produced a non-terminal hop (a URL change). */
  const hops: string[] = [];
  /** Number of distinct URLs visited, including the starting one. */
  let urlVisits = 0;

  for (;;) {
    if (urlVisits > opts.maxRedirects) {
      throw new RedirectError(
        `Too many redirects/hops (max ${opts.maxRedirects}) while resolving ${input}`,
      );
    }
    const key = urlKey(current);
    if (visited.has(key)) {
      throw new RedirectError(`Circular resolution detected at ${current}`);
    }
    visited.add(key);
    urlVisits += 1;

    const { result, resolverName } = await runResolverChain(current, ctx);
    switch (result.kind) {
      case 'handled': {
        const link = result.link;
        // `via` lists the transformation hops (page fetches, extractions);
        // `resolvedBy` already names the terminal resolver.
        link.via = [...hops, ...link.via];
        link.redirects = urlVisits - 1;
        return link;
      }
      case 'redirect': {
        hops.push(resolverName);
        current = result.to;
        continue;
      }
      case 'page': {
        const htmlResolver = getResolver('html');
        if (!htmlResolver || !htmlResolver.resolvePage) {
          await result.page.body?.cancel().catch(() => {});
          throw new ResolutionError(
            `No HTML resolver is registered; cannot extract a link from ${result.page.url}`,
          );
        }
        hops.push(resolverName);
        const pageResult = await htmlResolver.resolvePage(result.page, ctx);
        switch (pageResult.kind) {
          case 'handled': {
            const link = pageResult.link;
            link.via = [...hops, ...link.via];
            link.redirects = urlVisits - 1;
            return link;
          }
          case 'redirect': {
            hops.push(htmlResolver.name);
            current = pageResult.to;
            continue;
          }
          default:
            throw new ResolutionError(
              `HTML resolver returned "${pageResult.kind}" for ${result.page.url}`,
            );
        }
      }
      case 'unhandled':
        throw new ResolutionError(
          `No registered resolver could resolve ${current}`,
        );
    }
  }
}

function normalizeOptions(options: ResolveOptions): NormalizedOptions {
  return {
    fetch: options.fetch ?? defaultFetch,
    maxRedirects: options.maxRedirects ?? 10,
    timeoutMs: options.timeoutMs,
  };
}

/** A canonical key for loop detection (ignores the URL fragment). */
function urlKey(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
}

async function runResolverChain(
  urlValue: string,
  ctx: ResolverContext,
): Promise<{ result: ResolveResult; resolverName: string }> {
  const url = new URL(urlValue);
  for (const resolver of resolvers) {
    if (!resolver.canHandle(url)) continue;
    const result = await resolver.resolve(url, ctx);
    if (result.kind !== 'unhandled') {
      return { result, resolverName: resolver.name };
    }
  }
  return { result: { kind: 'unhandled' }, resolverName: '' };
}
