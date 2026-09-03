import { fetchWithRedirects } from './fetch.js';
import { resolveLink } from './resolve.js';
import {
  DownloadError,
  HttpStatusError,
  SinkError,
} from './errors.js';
import type {
  DownloadOptions,
  DownloadProgress,
  DownloadResult,
} from './types.js';

/**
 * Resolve a URL to its terminal link and stream the file into `options.sink`.
 *
 * This never buffers the whole file in memory: each chunk read from the
 * response body is written to the sink (and reported via `onProgress`) before
 * the next chunk is read. The core stays runtime-agnostic by writing only
 * through the {@link DownloadSink} abstraction — see
 * `direct-link-resolver/node`'s `createFileSink` for a Node implementation, or
 * back a sink with any writable target (Blob, S3, …).
 */
export async function downloadFile(
  url: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const sink = options.sink;
  if (!sink) {
    throw new SinkError(
      'downloadFile requires options.sink. Use createFileSink() (from "direct-link-resolver/node") for a Node filesystem sink, or provide your own DownloadSink.',
    );
  }

  const resolved = await resolveLink(url, options);
  const { response } = await fetchWithRedirects(resolved.url, options);
  const body = response.body;

  if (response.status >= 400) {
    await sink.abort(new HttpStatusError(response.status, resolved.url));
    throw new HttpStatusError(response.status, resolved.url);
  }
  if (!body) {
    await sink.abort();
    throw new DownloadError(`Response from ${resolved.url} had no body to download`);
  }

  const total = parseContentLength(response.headers.get('content-length'));
  const onProgress = options.onProgress;
  const reader = body.getReader();
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      received += value.byteLength;
      // Wait for each chunk to be persisted before reading more, so we hold at
      // most one chunk in memory and never buffer the whole file.
      await sink.write(value);
      if (onProgress) {
        onProgress(buildProgress(received, total, resolved.url));
      }
    }
    await sink.finish();
  } catch (err) {
    await sink.abort(err);
    await reader.cancel().catch(() => {});
    throw new DownloadError(`Download failed for ${resolved.url}`, { cause: err });
  }

  return { bytes: received, size: total, resolvedLink: resolved };
}

function buildProgress(
  receivedBytes: number,
  totalBytes: number | undefined,
  url: string,
): DownloadProgress {
  const progress: DownloadProgress = { receivedBytes, url };
  if (totalBytes !== undefined) {
    progress.totalBytes = totalBytes;
    progress.percent =
      totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 100;
  }
  return progress;
}

function parseContentLength(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
