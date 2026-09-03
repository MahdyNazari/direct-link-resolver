import { describe, expect, it } from 'vitest';
import { RedirectResolver } from '../../src/core/resolvers/redirect.js';
import { HttpStatusError } from '../../src/core/errors.js';
import { makeCtx } from '../helpers.js';

const resolver = new RedirectResolver();

describe('RedirectResolver', () => {
  it('resolves a directly downloadable resource with metadata', async () => {
    const ctx = makeCtx({
      'https://example.com/download': {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': '1024',
          'content-disposition': 'attachment; filename="photo.jpg"',
        },
        url: 'https://cdn.example.com/photo.jpg',
      },
    });

    const result = await resolver.resolve(
      new URL('https://example.com/download'),
      ctx,
    );

    expect(result.kind).toBe('handled');
    if (result.kind !== 'handled') return;
    expect(result.link.url).toBe('https://cdn.example.com/photo.jpg');
    expect(result.link.filename).toBe('photo.jpg');
    expect(result.link.size).toBe(1024);
    expect(result.link.contentType).toBe('application/octet-stream');
    expect(result.link.resolvedBy).toBe('redirect');
  });

  it('returns a page when the final response is HTML', async () => {
    const ctx = makeCtx({
      'https://example.com/download': {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<html><body>Download <a href="file.zip">here</a></body></html>',
        url: 'https://example.com/download',
      },
    });

    const result = await resolver.resolve(
      new URL('https://example.com/download'),
      ctx,
    );

    expect(result.kind).toBe('page');
    if (result.kind !== 'page') return;
    expect(result.page.url).toBe('https://example.com/download');
    expect(result.page.contentType).toBe('text/html');
    expect(result.page.body).toBeDefined();
  });

  it('throws HttpStatusError on a non-success status', async () => {
    const ctx = makeCtx({
      'https://example.com/missing': {
        status: 404,
        headers: { 'content-type': 'text/html' },
      },
    });

    await expect(
      resolver.resolve(new URL('https://example.com/missing'), ctx),
    ).rejects.toBeInstanceOf(HttpStatusError);
  });

  it('canHandle only http(s) URLs', () => {
    expect(resolver.canHandle(new URL('https://x.test/a'))).toBe(true);
    expect(resolver.canHandle(new URL('http://x.test/a'))).toBe(true);
    expect(resolver.canHandle(new URL('ftp://x.test/a'))).toBe(false);
  });
});
