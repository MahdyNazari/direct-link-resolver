/**
 * Runtime abstraction.
 *
 * The *only* `fetch`-like shape the core relies on is the standard global
 * `fetch` that exists on Node 18+, browsers and Cloudflare Workers. We declare
 * it as a structural interface so the core never touches Node-only globals and
 * can be injected with a mock in unit tests.
 */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/**
 * The default fetch implementation. On Node 18+ this is the global fetch.
 * It is *read* lazily so the module can be imported in environments that do
 * not define it at import time.
 *
 * Note: `globalThis.fetch` is already typed as `typeof fetch`, so this
 * assignment is safe without a Node `@types` dependency.
 */
export const defaultFetch: FetchLike = (...args) => globalThis.fetch(...args);
