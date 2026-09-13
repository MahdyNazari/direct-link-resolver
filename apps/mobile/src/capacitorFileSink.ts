import { Filesystem, Directory } from '@capacitor/filesystem';
import type { DownloadSink } from 'direct-link-resolver';

export interface CapacitorFileSinkOptions {
  /** File name only (no path separators) — written under Directory.Documents. */
  filename: string;
  /** Overwrite an existing file. Defaults to false (throw if it already exists). */
  overwrite?: boolean;
}

/**
 * A DownloadSink backed by @capacitor/filesystem, writing into the app's
 * scoped Documents directory. Preserves constant-memory streaming: the first
 * chunk is written with writeFile (create/truncate), every subsequent chunk
 * is appended with appendFile. Each chunk is base64-encoded individually —
 * chunks are never accumulated in memory before being flushed to disk.
 */
export async function createCapacitorFileSink(
  options: CapacitorFileSinkOptions,
): Promise<DownloadSink> {
  const { filename, overwrite = false } = options;

  if (!overwrite) {
    try {
      await Filesystem.stat({ path: filename, directory: Directory.Documents });
      throw new Error(`File "${filename}" already exists (pass overwrite: true to replace it).`);
    } catch (err) {
      // Filesystem.stat rejects when the file does not exist — that's the
      // expected/good path here. Re-throw only our own "already exists" error.
      if (err instanceof Error && err.message.includes('already exists')) throw err;
    }
  }

  let wroteFirstChunk = false;

  return {
    async write(chunk: Uint8Array): Promise<void> {
      const base64 = uint8ArrayToBase64(chunk);
      if (!wroteFirstChunk) {
        await Filesystem.writeFile({
          path: filename,
          directory: Directory.Documents,
          data: base64,
          recursive: true,
        });
        wroteFirstChunk = true;
      } else {
        await Filesystem.appendFile({
          path: filename,
          directory: Directory.Documents,
          data: base64,
        });
      }
    },
    async finish(): Promise<void> {
      // Nothing to flush/close explicitly — each write already completed
      // before returning, per the plugin's contract.
    },
    async abort(): Promise<void> {
      try {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Documents });
      } catch {
        // best-effort cleanup; ignore if the file was never created
      }
    },
  };
}

/** Convert a Uint8Array chunk to a base64 string without building a Blob/FileReader detour. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // avoid call-stack limits from String.fromCharCode(...bytes) on large chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
