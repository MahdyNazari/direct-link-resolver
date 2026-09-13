import { describe, expect, it } from 'vitest';
import {
  assertHttpUrl,
  extractFilename,
  filenameFromUrl,
  headersToRecord,
  resolveLocation,
} from '../src/core/url.js';
import { UnsupportedUrlError } from '../src/core/errors.js';

describe('url helpers', () => {
  it('asserts http(s) URLs and rejects the rest', () => {
    expect(assertHttpUrl('https://example.com/a').toString()).toBe(
      'https://example.com/a',
    );
    expect(() => assertHttpUrl('ftp://example.com/a')).toThrow(UnsupportedUrlError);
    expect(() => assertHttpUrl('not a url')).toThrow(UnsupportedUrlError);
  });

  it('resolves a relative location against a base', () => {
    expect(resolveLocation('/files/a.zip', 'https://example.com/page')).toBe(
      'https://example.com/files/a.zip',
    );
    expect(resolveLocation('https://cdn.x.test/b.zip', 'https://example.com/page')).toBe(
      'https://cdn.x.test/b.zip',
    );
  });

  it('normalizes headers to lower-case, comma-joined keys', () => {
    const headers = new Headers({ 'Content-Type': 'text/html' });
    headers.append('Set-Cookie', 'a=1');
    headers.append('Set-Cookie', 'b=2');
    const record = headersToRecord(headers);
    expect(record['content-type']).toBe('text/html');
    expect(record['set-cookie']).toBe('a=1, b=2');
  });

  it('prefers RFC 5987 filename* in Content-Disposition', () => {
    expect(
      extractFilename(
        { 'content-disposition': "attachment; filename*=UTF-8''caf%C3%A9.txt" },
        'https://example.com/fallback.bin',
      ),
    ).toBe('café.txt');
  });

  it('falls back to plain filename then the URL path', () => {
    expect(
      extractFilename({ 'content-disposition': 'attachment; filename="doc.pdf"' }, 'https://x.test/a.bin'),
    ).toBe('doc.pdf');
    expect(extractFilename({}, 'https://cdn.example.com/path/my%20photo.jpg')).toBe(
      'my photo.jpg',
    );
  });

  it('returns undefined for a URL with no usable path segment', () => {
    expect(filenameFromUrl('https://example.com/')).toBeUndefined();
  });
});
