import { HttpStatusError } from '../errors.js';
import { headersToRecord } from '../url.js';
import { isHtml, makeDirectLink, normalizeContentType } from '../resolved.js';
import type { Resolver, ResolverContext, ResolveResult } from './resolver.js';

/**
 * The network-level resolver. It is the general fallback: it fetches the URL
 * following redirects, and:
 *
 *  - redirects → `handled` for a directly downloadable resource (non-HTML);
 *  - redirects → `page` when the final response is HTML, so the HTML resolver
 *    can extract an embedded link;
 *  - throws {@link HttpStatusError} for a non-success status.
 */
export class RedirectResolver implements Resolver {
  readonly name = 'redirect';

  canHandle(url: URL): boolean {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  async resolve(url: URL, ctx: ResolverContext): Promise<ResolveResult> {
    const { response, url: finalUrl, redirected } = await ctx.fetchPage(
      url.toString(),
    );

    if (response.status >= 400) {
      await response.body?.cancel().catch(() => {});
      throw new HttpStatusError(response.status, finalUrl);
    }

    const headers = headersToRecord(response.headers);
    const contentType = normalizeContentType(headers['content-type']);

    if (isHtml(contentType)) {
      return {
        kind: 'page',
        page: {
          url: finalUrl,
          headers,
          body: response.body ?? new ReadableStream<Uint8Array>(),
          contentType: contentType ?? 'text/html',
        },
      };
    }

    // A directly downloadable resource. We only need its metadata right now —
    // the actual bytes are re-fetched when the caller downloads — so release
    // the connection by cancelling the body.
    await response.body?.cancel().catch(() => {});

    const link = makeDirectLink({
      url: finalUrl,
      headers,
      resolvedBy: this.name,
      via: [],
      redirects: redirected ? 1 : 0,
    });
    return { kind: 'handled', link };
  }
}
