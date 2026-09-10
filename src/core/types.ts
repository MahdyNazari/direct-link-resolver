import type { FetchLike } from './runtime.js';

/**
 * Normalized response headers. Keys are lower-cased; repeated headers are
 * joined with a comma, matching the WHATWG `Headers` iteration contract.
 */
export type NormalizedHeaders = Readonly<Record<string, string>>;

/**
 * The result of resolving a URL to its terminal, directly downloadable link.
 * `filename`, `size` and `contentType` are present only when the server told
 * us (via Content-Disposition / Content-Length / Content-Type) or when we could
 * derive them from the URL.
 */
export interface ResolvedLink {
  /** Final URL that should be fetched to download the file. */
  url: string;
  /** Best-effort file name, e.g. from Content-Disposition or the URL path. */
  filename?: string;
  /** Total size in bytes, when the server declares Content-Length. */
  size?: number;
  /** Human-readable size (e.g. "2.4 MB"), derived from `size` when present. */
  sizeFormatted?: string;
  /** MIME type of the final resource, when declared via Content-Type. */
  contentType?: string;
  /** Normalized headers from the final response. */
  headers: NormalizedHeaders;
  /** Name of the resolver that produced this terminal result. */
  resolvedBy: string;
  /** Ordered names of resolvers visited along the way (HTTP redirects, HTML…). */
  via: string[];
  /** Number of HTTP redirects followed to reach the terminal URL. */
  redirects: number;
}

/** Options accepted by both resolving and downloading. */
export interface CoreOptions {
  /** Fetch implementation to use. Defaults to `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Abort the operation after this many milliseconds. */
  timeoutMs?: number;
  /** Maximum number of redirects / re-resolution hops. Defaults to 10. */
  maxRedirects?: number;
  /** External cancellation signal. */
  signal?: AbortSignal;
}

/** Options for {@link resolveLink}. */
export type ResolveOptions = CoreOptions;

/** Result of a download operation. */
export interface DownloadResult {
  /** Bytes written to the sink. */
  bytes: number;
  /** Number of bytes streamed is always known; total is only known when declared. */
  size?: number;
  /** Resolved metadata, including the final direct URL. */
  resolvedLink: ResolvedLink;
}

/** Progress reported while streaming a download. */
export interface DownloadProgress {
  /** Bytes received so far. */
  receivedBytes: number;
  /** Total bytes when the server declared Content-Length, otherwise undefined. */
  totalBytes?: number;
  /** Percentage 0–100 when a total is known, otherwise undefined. */
  percent?: number;
  /** The URL currently being downloaded (the resolved direct URL). */
  url: string;
}

/**
 * A streaming sink the downloader writes chunks into. This abstraction is what
 * keeps the core runtime-agnostic: the core only knows about `write`/`finish`/
 * `abort`, never about a filesystem. The CLI and Node callers provide an
 * implementation backed by `node:fs`; browser callers can back it with a
 * `Blob` or a stream to a `WritableStream`.
 */
export interface DownloadSink {
  /** Persist a chunk. Resolves once the chunk is durably stored. */
  write(chunk: Uint8Array): Promise<void>;
  /** Flush / close the sink. Called exactly once on success. */
  finish(): Promise<void>;
  /** Abort the sink, releasing any resources. Called on failure or cancel. */
  abort(error?: unknown): Promise<void>;
}

/** Options for {@link downloadFile}. */
export interface DownloadOptions extends CoreOptions {
  /** The sink to stream the body into. Required for writes you keep (see `direct-link-resolver/node`). */
  sink?: DownloadSink;
  /** Called after each chunk is written to the sink. */
  onProgress?: (progress: DownloadProgress) => void;
}
