import { extractFilename } from './url.js';
import type { NormalizedHeaders, ResolvedLink } from './types.js';

/**
 * Strip `;charset=…` and friends from a Content-Type value, returning the bare
 * media type (e.g. `text/html` from `text/html; charset=utf-8`).
 */
export function normalizeContentType(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.split(';', 1)[0]?.trim().toLowerCase() || undefined;
}

export function isHtml(contentType?: string): boolean {
  return contentType === 'text/html';
}

interface DirectLinkInput {
  url: string;
  headers: NormalizedHeaders;
  resolvedBy: string;
  via: string[];
  redirects: number;
}

/**
 * Build a {@link ResolvedLink} for a directly downloadable resource, deriving
 * filename / size / contentType from the response headers and URL when present.
 * Optional fields are omitted (not set to `undefined`) so consumers can rely on
 * `'key' in link`.
 */
export function makeDirectLink(input: DirectLinkInput): ResolvedLink {
  const contentType = normalizeContentType(input.headers['content-type']);
  const size = parseContentLength(input.headers['content-length']);
  const filename = extractFilename(input.headers, input.url);

  const link: ResolvedLink = {
    url: input.url,
    headers: input.headers,
    resolvedBy: input.resolvedBy,
    via: input.via,
    redirects: input.redirects,
  };
  if (contentType !== undefined) link.contentType = contentType;
  if (size !== undefined) link.size = size;
  if (filename !== undefined) link.filename = filename;
  return link;
}

function parseContentLength(raw?: string): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
