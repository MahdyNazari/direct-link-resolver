import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import http from 'node:http';
import { resolveLink } from '../src/core/resolve.js';
import { downloadFile } from '../src/core/download.js';
import type { DownloadSink } from '../src/core/types.js';

const FILE = Buffer.from('integration-test-payload-1234567890');

let server: Server;
let base: string;

async function startServer(): Promise<string> {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/file.bin') {
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': String(FILE.length),
      });
      res.end(FILE);
    } else if (url.pathname === '/download') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<a href="/file.bin" download>Download</a>');
    } else if (url.pathname === '/redirect') {
      res.writeHead(302, { location: '/file.bin' });
      res.end();
    } else {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<html>404</html>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

describe('integration (real HTTP server)', () => {
  beforeAll(async () => {
    base = await startServer();
  });

  afterAll(() => {
    server?.close();
  });

  it('resolves a direct file', async () => {
    const link = await resolveLink(`${base}/file.bin`);
    expect(link.url).toBe(`${base}/file.bin`);
    expect(link.size).toBe(FILE.length);
  });

  it('watches an HTML download page and follows a redirect', async () => {
    const link = await resolveLink(`${base}/download`);
    expect(link.url).toBe(`${base}/file.bin`);
    expect(link.via).toEqual(['redirect', 'html']);
  });

  it('downloads and streams the resolved file', async () => {
    const chunks: Uint8Array[] = [];
    const sink: DownloadSink = {
      write: async (chunk) => void chunks.push(chunk),
      finish: async () => {},
      abort: async () => {},
    };
    const result = await downloadFile(`${base}/download`, { sink });
    expect(result.bytes).toBe(FILE.length);
    expect(result.resolvedLink.url).toBe(`${base}/file.bin`);
    expect(Buffer.concat(chunks)).toEqual(FILE);
  });
});
