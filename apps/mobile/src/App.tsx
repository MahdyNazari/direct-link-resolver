import { useState } from 'react';
import {
  DirectLinkResolverError,
  HttpStatusError,
  ResolutionError,
  UnsupportedUrlError,
  downloadFile,
  formatBytes,
  resolveLink,
} from 'direct-link-resolver';
import type { DownloadProgress, ResolvedLink } from 'direct-link-resolver';
import { createCapacitorFileSink } from './capacitorFileSink.ts';
import './App.css';

/** Must stay in sync with `appId` in capacitor.config.ts. */
const APP_ID = 'com.mahdynazari.directlinkresolver';

type Phase = 'idle' | 'resolving' | 'resolved' | 'downloading' | 'done';

/**
 * The sink expects a bare file name (no path separators) — strip anything
 * that looks like a directory component, defensively.
 */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() ?? '';
  return base === '' ? 'download' : base;
}

function toFriendlyMessage(err: unknown): string {
  if (err instanceof HttpStatusError) {
    return `The server responded with HTTP ${err.status}. The file may be gone or the link may have expired.`;
  }
  if (err instanceof UnsupportedUrlError) {
    return 'This URL is not supported. Paste a direct file link (http/https).';
  }
  if (err instanceof ResolutionError) {
    return `Could not resolve this link: ${err.message}`;
  }
  if (err instanceof DirectLinkResolverError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

export default function App() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [resolved, setResolved] = useState<ResolvedLink | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === 'resolving' || phase === 'downloading';

  function handleUrlChange(value: string) {
    setUrl(value);
    // The previous result belongs to the previous URL — clear it as soon as
    // the user starts typing a new one.
    setResolved(null);
    setProgress(null);
    setSavedFilename(null);
    setError(null);
    setPhase('idle');
  }

  async function handleResolve() {
    const trimmed = url.trim();
    if (trimmed === '' || busy) return;
    setPhase('resolving');
    setError(null);
    setResolved(null);
    setProgress(null);
    setSavedFilename(null);
    try {
      const link = await resolveLink(trimmed);
      setResolved(link);
      setPhase('resolved');
    } catch (err) {
      setError(toFriendlyMessage(err));
      setPhase('idle');
    }
  }

  async function handleDownload() {
    const trimmed = url.trim();
    if (resolved == null || trimmed === '' || busy) return;
    const filename = sanitizeFilename(resolved.filename ?? 'download');
    setPhase('downloading');
    setError(null);
    setProgress({ receivedBytes: 0, url: trimmed  });
    setSavedFilename(null);
    try {
      const sink = await createCapacitorFileSink({ filename, overwrite: false });
      await downloadFile(trimmed, {
        sink,
        onProgress: (p) => setProgress(p),
      });
      setSavedFilename(filename);
      setPhase('done');
    } catch (err) {
      // Leave the resolved info (and how far the download got) on screen
      // instead of resetting — the user can retry or resolve a new URL.
      setError(toFriendlyMessage(err));
      setPhase('resolved');
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Direct Link Resolver</h1>
        <p className="subtitle">Resolve a link, then download it to this device.</p>
      </header>

      <main className="card">
        <label className="field-label" htmlFor="url-input">
          File URL
        </label>
        <div className="url-row">
          <input
            id="url-input"
            type="url"
            inputMode="url"
            placeholder="https://example.com/file.zip"
            value={url}
            disabled={busy}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleResolve();
            }}
          />
          <button type="button" onClick={() => void handleResolve()} disabled={busy || url.trim() === ''}>
            {phase === 'resolving' ? 'Resolving…' : 'Resolve'}
          </button>
        </div>

        {error != null && (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        )}

        {resolved != null && (
          <section className="resolved" aria-live="polite">
            <h2>Resolved</h2>
            <dl>
              <div>
                <dt>File name</dt>
                <dd>{resolved.filename ?? '—'}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{resolved.sizeFormatted ?? 'unknown size'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{resolved.contentType ?? 'unknown'}</dd>
              </div>
              <div>
                <dt>Resolved by</dt>
                <dd>{resolved.resolvedBy}</dd>
              </div>
              <div>
                <dt>Via</dt>
                <dd>{resolved.via.join(' → ')}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => void handleDownload()} disabled={phase !== 'resolved'}>
              {phase === 'downloading' ? 'Downloading…' : 'Download'}
            </button>
          </section>
        )}

        {(phase === 'downloading' || phase === 'done') && progress != null && (
          <section className="progress-section" aria-live="polite">
            <h2>{phase === 'done' ? 'Download complete' : 'Downloading…'}</h2>
            {progress.percent != null ? (
              <>
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress.percent)}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                  />
                </div>
                <p>
                  {progress.percent.toFixed(1)}% · {formatBytes(progress.receivedBytes)} received
                </p>
              </>
            ) : (
              <p className="bytes-counter">
                {formatBytes(progress.receivedBytes)} received (
                {progress.receivedBytes.toLocaleString()} bytes)
              </p>
            )}
          </section>
        )}

        {phase === 'done' && savedFilename != null && (
          <div className="banner banner-success" role="status">
            <p>
              <strong>Saved to this device:</strong>
            </p>
            <code>
              Android/data/{APP_ID}/files/Documents/{savedFilename}
            </code>
            <p className="hint">
              Open it with a file manager that can browse app storage (or Android Studio&apos;s
              Device Explorer).
            </p>
          </div>
        )}
      </main>

      <footer className="storage-note">
        <strong>Where do files go?</strong> On Android 10+, apps cannot write directly to the
        public Downloads folder, so files are saved in this app&apos;s private Documents folder
        (the exact path is shown above after each download). A “move to Downloads / share” option
        is planned for a future version.
      </footer>
    </div>
  );
}
