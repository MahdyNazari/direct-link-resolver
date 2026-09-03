import { HttpStatusError, ResolutionError } from '../errors.js';
import { headersToRecord } from '../url.js';
import { isHtml, normalizeContentType } from '../resolved.js';
import { bestLink, extractCandidateUrls, readStreamText } from '../html.js';
import type { PageDocument, Resolver, ResolverContext, ResolveResult } from './resolver.js';

/**
 * The HTML resolver. Its job is to inspect a fetched HTML page and extract the
 * direct file link embedded in it (an `<a download href>`, a media element, a
 * meta-refresh, etc.). It is reached through the `page` result produced by the
 * {@link RedirectResolver}, so the page body is fetched only once.
 */
export class HtmlPageResolver implements Resolver {
  readonly name = 'html';

  canHandle(url: URL): boolean {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  async resolve(url: URL, ctx: ResolverContext): Promise<ResolveResult> {
    const { response, url: finalUrl } = await ctx.fetchPage(url.toString());
    if (response.status >= 400) {
      await response.body?.cancel().catch(() => {});
      throw new HttpStatusError(response.status, finalUrl);
    }
    const headers = headersToRecord(response.headers);
    const contentType = normalizeContentType(headers['content-type']);
    if (!isHtml(contentType)) {
      await response.body?.cancel().catch(() => {});
      return { kind: 'unhandled' };
    }
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

  async resolvePage(page: PageDocument): Promise<ResolveResult> {
    const html = await readStreamText(page.body);
    const candidates = extractCandidateUrls(html, page.url);
    const link = bestLink(candidates);
    if (!link) {
      throw new ResolutionError(
        `Found an HTML page at ${page.url} but could not extract a direct file link. ` +
          'This typically happens when the real link is revealed by client-side ' +
          'JavaScript (e.g. a countdown), which a pure-fetch tool cannot execute.',
      );
    }
    // Hand the candidate back to the pipeline so it is re-validated (it may
    // itself be a redirect or another HTML page).
    return { kind: 'redirect', to: link };
  }
}
