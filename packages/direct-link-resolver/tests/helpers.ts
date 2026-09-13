import { fetchWithRedirects } from '../src/core/fetch.js';
import type { ResolverContext } from '../src/core/resolvers/resolver.js';
import type { FetchLike } from '../src/core/runtime.js';

export interface MockResponseSpec {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  /** Final URL to report on the response (mimics `response.url`). */
  url?: string;
  /** Whether the runtime "followed" a redirect (mimics `response.redirected`). */
  redirected?: boolean;
}

/**
 * Build a fake `Response` that behaves enough like the real thing for the
 * core: it has a usable `url`, `redirected`, `status`, `headers` and body.
 */
export function makeResponse(spec: MockResponseSpec, fallbackUrl: string): Response {
  const headers = new Headers(spec.headers);
  const body = spec.body ?? '';
  const resp = new Response(body, { status: spec.status ?? 200, headers });
  Object.defineProperty(resp, 'url', {
    value: spec.url ?? fallbackUrl,
    enumerable: true,
  });
  Object.defineProperty(resp, 'redirected', {
    value: spec.redirected ?? false,
    enumerable: true,
  });
  return resp;
}

/**
 * A `fetch` stub keyed by request URL. Throws for un-mocked URLs so tests fail
 * loudly instead of silently hanging against the network.
 */
export function mockFetch(
  specs: Record<string, MockResponseSpec>,
): FetchLike {
  return async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    const spec = specs[url];
    if (!spec) {
      throw new Error(`No mock response provided for ${url}`);
    }
    return makeResponse(spec, url);
  };
}

/** Build a ResolverContext backed by a mocked fetch. */
export function makeCtx(specs: Record<string, MockResponseSpec>): ResolverContext {
  const fetch = mockFetch(specs);
  return {
    options: { fetch },
    fetchPage: (url: string) => fetchWithRedirects(url, { fetch }),
  };
}
