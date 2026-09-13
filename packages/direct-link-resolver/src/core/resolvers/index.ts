import { HtmlPageResolver } from './html.js';
import { RedirectResolver } from './redirect.js';
import type { Resolver } from './resolver.js';

/**
 * The registry of resolvers, in priority order. Resolvers are tried in array
 * order; the first one that can handle a URL and returns a non-`unhandled`
 * result wins.
 *
 * To support a new kind of link/service, create one new file implementing
 * {@link Resolver} and append it to this array. No other code changes.
 */
export const resolvers: readonly Resolver[] = [
  new RedirectResolver(),
  new HtmlPageResolver(),
];

/** Look up a resolver by its stable name (used for `page` routing). */
export function getResolver(name: string): Resolver | undefined {
  return resolvers.find((resolver) => resolver.name === name);
}

export { RedirectResolver } from './redirect.js';
export { HtmlPageResolver } from './html.js';
export type { Resolver, ResolverContext, ResolveResult, PageDocument } from './resolver.js';
