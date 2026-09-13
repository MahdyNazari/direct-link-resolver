import { describe, expect, it } from 'vitest';
import { downloadFile } from '../src/core/download.js';
import { SinkError } from '../src/core/errors.js';
import type { DownloadProgress, DownloadSink } from '../src/core/types.js';
import { mockFetch } from './helpers.js';

function memorySink() {
  const chunks: Uint8Array[] = [];
  let finished = false;
  const sink: DownloadSink = {
    write: async (chunk) => {
      chunks.push(new Uint8Array(chunk));
    },
    finish: async () => {
      finished = true;
    },
    abort: async () => {},
  };
  return { sink, chunks, isFinished: () => finished };
}

describe('downloadFile', () => {
  it('streams the resolved file into the sink and reports progress', async () => {
    const fetch = mockFetch({
      'https://example.com/download': {
        status: 200,
        headers: { 'content-type': 'text/plain' },
        url: 'https://cdn.example.com/file.txt',
      },
      'https://cdn.example.com/file.txt': {
        status: 200,
        headers: { 'content-type': 'text/plain', 'content-length': '11' },
        body: 'hello world',
        url: 'https://cdn.example.com/file.txt',
      },
    });

    const { sink, chunks, isFinished } = memorySink();
    const progress: DownloadProgress[] = [];

    const result = await downloadFile('https://example.com/download', {
      fetch,
      sink,
      onProgress: (p) => progress.push(p),
    });

    expect(result.resolvedLink.url).toBe('https://cdn.example.com/file.txt');
    expect(result.bytes).toBe(11);
    expect(result.size).toBe(11);
    expect(isFinished()).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]?.percent).toBe(100);
    expect(progress[progress.length - 1]?.totalBytes).toBe(11);
    // The whole file content must be present, but only because it was streamed
    // chunk by chunk (never buffered in the library).
    expect(Buffer.concat(chunks).toString()).toBe('hello world');
  });

  it('requires a sink', async () => {
    const fetch = mockFetch({
      'https://example.com/download': {
        status: 200,
        headers: { 'content-type': 'text/plain' },
        url: 'https://cdn.example.com/file.txt',
      },
    });
    await expect(
      downloadFile('https://example.com/download', { fetch }),
    ).rejects.toBeInstanceOf(SinkError);
  });
});
