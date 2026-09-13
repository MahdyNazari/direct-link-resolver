import { describe, expect, it } from 'vitest';
import { HtmlPageResolver } from '../../src/core/resolvers/html.js';
import { bestLink, extractCandidateUrls, readStreamText } from '../../src/core/html.js';
import { ResolutionError } from '../../src/core/errors.js';
import type { PageDocument } from '../../src/core/resolvers/resolver.js';
import { makeCtx } from '../helpers.js';

const resolver = new HtmlPageResolver();

function pageDoc(html: string, url = 'https://example.com/page'): PageDocument {
  return {
    url,
    headers: { 'content-type': 'text/html' },
    body: new Response(html).body ?? new ReadableStream(),
    contentType: 'text/html',
  };
}

describe('HtmlPageResolver', () => {
  it('extracts a link with a download attribute', async () => {
    const result = await resolver.resolvePage(
      pageDoc(
        '<html><body><a href="/files/archive.zip" download>download</a></body></html>',
      ),
    );
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') {
      expect(result.to).toBe('https://example.com/files/archive.zip');
    }
  });

  it('extracts a link from a meta refresh', async () => {
    const result = await resolver.resolvePage(
      pageDoc('<meta http-equiv="refresh" content="3; url=https://cdn.example.com/movie.mp4" />'),
    );
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') {
      expect(result.to).toBe('https://cdn.example.com/movie.mp4');
    }
  });

  it('prefers the download link over a random one', async () => {
    const links = extractCandidateUrls(
      '<a href="https://x.test/about.html">about</a>' +
        '<a href="https://cdn.example.com/report.pdf" download>Download report</a>',
      'https://example.com/page',
    );
    expect(bestLink(links)).toBe('https://cdn.example.com/report.pdf');
  });

  it('throws when no direct link can be extracted', async () => {
    await expect(
      resolver.resolvePage(pageDoc('<html><body>Nothing here</body></html>')),
    ).rejects.toBeInstanceOf(ResolutionError);
  });

  it('returns unhandled for a non-HTML response', async () => {
    const ctx = makeCtx({
      'https://example.com/file': {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
        body: 'junk',
      },
    });
    const result = await resolver.resolve(new URL('https://example.com/file'), ctx);
    expect(result.kind).toBe('unhandled');
  });
});

describe('readStreamText', () => {
  it('decodes a stream to a string', async () => {
    const stream = new Response('héllo wörld').body!;
    await expect(readStreamText(stream)).resolves.toBe('héllo wörld');
  });
});
