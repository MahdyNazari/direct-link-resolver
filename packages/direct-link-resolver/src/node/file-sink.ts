import { open, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SinkError } from '../core/errors.js';
import type { DownloadSink } from '../core/types.js';

export interface FileSinkOptions {
  /** Overwrite an existing file. Defaults to `false` (refuse to clobber). */
  overwrite?: boolean;
  /** Create the parent directory if missing. Defaults to `false`. */
  ensureDir?: boolean;
}

/**
 * Create a {@link DownloadSink} that writes to `path` on the local filesystem.
 *
 * This is the only module that depends on a runtime (Node). It is not part of
 * the portable core; import it from the `direct-link-resolver/node` subpath or
 * wire any other sink of your own.
 */
export async function createFileSink(
  path: string,
  options: FileSinkOptions = {},
): Promise<DownloadSink> {
  if (options.ensureDir) {
    await mkdir(dirname(path), { recursive: true });
  }

  const flag = options.overwrite ? 'w' : 'wx';
  const handle = await open(path, flag);

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await handle.close();
  };

  return {
    async write(chunk: Uint8Array): Promise<void> {
      if (closed) {
        throw new SinkError(`File sink for ${path} is already closed`);
      }
      // Await each write so backpressure is respected (streaming, not buffered).
      await handle.write(chunk, 0, chunk.byteLength);
    },
    async finish(): Promise<void> {
      try {
        await handle.sync();
      } finally {
        await close();
      }
    },
    async abort(): Promise<void> {
      await close();
    },
  };
}
