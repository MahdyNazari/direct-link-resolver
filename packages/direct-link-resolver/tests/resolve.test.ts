import { describe, expect, it } from 'vitest';
import { resolveLink } from '../src/core/resolve.js';
import { HttpStatusError, RedirectError } from '../src/core/errors.js';
import type { FetchLike } from '../src/core/runtime.js';
import { makeResponse, mockFetch } from './helpers.js';

describe('resolveLink', () => {
  it('resolves a direct file URL (no hops)', async () => {
    const fetch = mockFetch({
      'https://example.com/download': {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-length': '2500',
        },
        url: 'https://cdn.example.com/report.zip',
      },
    });

    const link = await resolveLink('https://example.com/download', { fetch });

    expect(link.url).toBe('https://cdn.example.com/report.zip');
    expect(link.contentType).toBe('application/zip');
    expect(link.size).toBe(2500);
    expect(link.resolvedBy).toBe('redirect');
    expect(link.via).toEqual([]);
    expect(link.redirects).toBe(0);
  });

  it('follows an HTML page to the embedded direct link', async () => {
    const fetch = mockFetch({
      'https://example.com/download': {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<html><body><a href="https://cdn.example.com/file.zip" download>Download</a></body></html>',
        url: 'https://example.com/download',
      },
      'https://cdn.example.com/file.zip': {
        status: 200,
        headers: { 'content-type': 'application/zip', 'content-length': '900' },
        url: 'https://cdn.example.com/file.zip',
      },
    });

    const link = await resolveLink('https://example.com/download', { fetch });

    expect(link.url).toBe('https://cdn.example.com/file.zip');
    expect(link.resolvedBy).toBe('redirect');
    expect(link.via).toEqual(['redirect', 'html']);
    expect(link.redirects).toBe(1);
  });

  it('rejects non-http(s) or malformed URLs', async () => {
    await expect(resolveLink('ftp://example.com/a')).rejects.toThrow();
    await expect(resolveLink('not a url')).rejects.toThrow();
  });

  it('propagates HTTP errors', async () => {
    const fetch = mockFetch({
      'https://example.com/missing': {
        status: 404,
        headers: { 'content-type': 'text/html' },
      },
    });
    await expect(
      resolveLink('https://example.com/missing', { fetch }),
    ).rejects.toBeInstanceOf(HttpStatusError);
  });

  it('detects circular resolution', async () => {
    const fetch = mockFetch({
      'https://example.com/a': {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<a href="https://example.com/a" download>Download</a>',
        url: 'https://example.com/a',
      },
    });
    await expect(
      resolveLink('https://example.com/a', { fetch }),
    ).rejects.toBeInstanceOf(RedirectError);
  });

  it('forwards an external AbortSignal to fetch during resolution', async () => {
    const external = new AbortController();
    let seenSignal: AbortSignal | null = null;
    const fetch: FetchLike = async (input, init) => {
      seenSignal = init?.signal ?? null;
      return makeResponse(
        {
          status: 200,
          headers: {
            'content-type': 'application/zip',
            'content-length': '100',
          },
          url: 'https://cdn.example.com/file.zip',
        },
        typeof input === 'string' ? input : input.toString(),
      );
    };

    await resolveLink('https://example.com/download', {
      fetch,
      signal: external.signal,
    });

    expect(seenSignal).toBeInstanceOf(AbortSignal);
    // The request signal must stay linked to the external one.
    expect(seenSignal!.aborted).toBe(false);
    external.abort();
    expect(seenSignal!.aborted).toBe(true);
  });
});
