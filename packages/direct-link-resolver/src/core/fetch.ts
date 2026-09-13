import { DirectLinkResolverError } from './errors.js';
import { defaultFetch } from './runtime.js';
import type { FetchLike } from './runtime.js';
import type { CoreOptions } from './types.js';

export interface FetchedResponse {
  /** The final (post-redirect) response. Its body stream must be consumed. */
  response: Response;
  /** The final URL after redirects (what `response.url` reports). */
  url: string;
  /** `true` when the runtime followed at least one redirect. */
  redirected: boolean;
  /** Abort signal actually used, if one was configured (timeout or external). */
  signal?: AbortSignal;
}

/**
 * Fetch a URL following redirects.
 *
 * We deliberately use `redirect: 'follow'`: it is the only mode that behaves
 * identically on Node 18+ (undici) and in browsers, which cannot read a
 * redirect's Location header when `redirect: 'manual'` is used (they get an
 * opaque redirect response). The Fetch spec therefore never exposes an exact
 * redirect count; `redirected` is a boolean we surface as a 0/1 value.
 *
 * If `timeoutMs` is configured, the request is aborted via an AbortController.
 */
export async function fetchWithRedirects(
  input: string,
  options: CoreOptions,
): Promise<FetchedResponse> {
  const fetch: FetchLike = options.fetch ?? defaultFetch;
  const controller = new AbortController();
  const timer =
    options.timeoutMs !== undefined
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      // Aborting after the request completed is a harmless no-op, so we don't
      // bother removing the listener.
      options.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  let response: Response;
  try {
    response = await fetch(input, {
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new DirectLinkResolverError(
        `Request timed out after ${String(options.timeoutMs)}ms for ${input}`,
        { cause: err },
      );
    }
    throw new DirectLinkResolverError(`Network error while fetching ${input}`, {
      cause: err,
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  return {
    response,
    url: response.url || input,
    redirected: response.redirected,
    signal: controller.signal,
  };
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  );
}
