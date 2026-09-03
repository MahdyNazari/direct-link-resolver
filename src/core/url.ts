import { UnsupportedUrlError } from './errors.js';
import type { NormalizedHeaders } from './types.js';

/** Returns true when the value is a well-formed http(s) URL string. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse and validate an input string as an http(s) URL. Throws
 * {@link UnsupportedUrlError} for malformed or non-http(s) input.
 */
export function assertHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsupportedUrlError(`Invalid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsupportedUrlError(
      `Unsupported protocol "${url.protocol}" (only http/https are allowed).`,
    );
  }
  return url;
}

/** Resolve a (possibly relative) redirect/game location against a base URL. */
export function resolveLocation(location: string, base: string): string {
  try {
    return new URL(location, base).toString();
  } catch {
    throw new UnsupportedUrlError(`Could not resolve redirect location "${location}".`);
  }
}

/** Lower-case keys and join repeated headers with a comma, like WHATWG Headers. */
export function headersToRecord(headers: Headers): NormalizedHeaders {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    record[k] = k in record ? `${record[k]}, ${value}` : value;
  });
  return record;
}

/**
 * Derive a best-effort file name from the final URL path. Returns undefined when
 * the path has no usable final segment.
 */
export function filenameFromUrl(urlValue: string): string | undefined {
  try {
    const url = new URL(urlValue);
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (!last) return undefined;
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  } catch {
    return undefined;
  }
}

/**
 * Choose a file name from Content-Disposition when present, otherwise fall back
 * to the final URL path. Prefers the RFC 5987 `filename*`.
 */
export function extractFilename(
  headers: NormalizedHeaders,
  urlValue: string,
): string | undefined {
  const disposition = headers['content-disposition'];
  if (disposition) {
    const fromHeader = parseContentDisposition(disposition);
    if (fromHeader) return fromHeader;
  }
  return filenameFromUrl(urlValue);
}

function parseContentDisposition(disposition: string): string | undefined {
  // RFC 5987: filename*=UTF-8''percent-encoded
  const star = /filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;]+)/i.exec(disposition);
  if (star && star[1]) {
    try {
      const decoded = decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ''));
      if (decoded) return decoded;
    } catch {
      // fall through to the plain filename
    }
  }
  // Plain: filename="foo.bar" or filename=foo.bar
  const plain = /filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;]+))/i.exec(disposition);
  if (plain) {
    const value = plain[1] ?? plain[2] ?? plain[3];
    if (value) return value.trim();
  }
  return undefined;
}
