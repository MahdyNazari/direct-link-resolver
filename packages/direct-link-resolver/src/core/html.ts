/**
 * Lightweight, dependency-free HTML link extraction.
 *
 * We deliberately avoid a full DOM parser: it would drag Node-specific or
 * heavy parts into the core. Instead we scan for `href`/`src`/`download`
 * attributes and `<meta http-equiv="refresh">` redirections, then score the
 * candidates. This handles the overwhelming majority of server-rendered
 * "download page" and embedded-media cases.
 *
 * Known limitation (documented in the README): countdown pages that only
 * reveal the real link via client-side JavaScript cannot be resolved by a
 * pure-fetch tool — we do not execute scripts.
 */

export interface CandidateLink {
  url: string;
  /** Higher is more likely to be the file the user wants. */
  score: number;
  /** Whether the anchor had a `download` attribute. */
  download: boolean;
  /** The tag name the link came from (`a`, `video`, `source`, …). */
  tag: string;
}

const TAG_ATTR_RE = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)\/?>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const META_REFRESH_RE =
  /<meta\s+[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']([^"']*?)["']/gi;

const MEDIA_TAGS = new Set(['video', 'audio', 'source', 'img', 'picture', 'iframe']);
const UNLIKELY_TAGS = new Set(['script', 'link', 'style']);

const FILE_EXT_RE =
  /\.(zip|rar|7z|tar|gz|bz2|xz|pdf|epub|mp4|webm|mov|mkv|mp3|m4a|ogg|flac|wav|jpg|jpeg|png|gif|webp|svg|doc|docx|xls|xlsx|ppt|pptx|csv|json|txt|exe|apk|dmg|iso)$/i;

/** Read a `ReadableStream<Uint8Array>` to a string via streaming TextDecoder. */
export async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let output = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  return output;
}

/** Extract absolute candidate URLs from an HTML document and score them. */
export function extractCandidateUrls(html: string, pageUrl: string): CandidateLink[] {
  const candidates: CandidateLink[] = [];
  const seen = new Set<string>();

  const push = (
    raw: string,
    tag: string,
    download: boolean,
    nearText: string,
  ): void => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    let abs: string;
    try {
      abs = new URL(trimmed, pageUrl).toString();
    } catch {
      return;
    }
    if (seen.has(abs)) return;
    seen.add(abs);
    candidates.push({
      url: abs,
      score: scoreCandidate(abs, tag, download, nearText),
      download,
      tag,
    });
  };

  // Walk tags.
  TAG_ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_ATTR_RE.exec(html))) {
    const tag = match[1]!.toLowerCase();
    const body = match[2] ?? '';
    const index = match.index;
    attrs(body).forEach(({ name, value }) => {
      if (!value) return;
      const isDownloading = name === 'download';
      const linkName = name.toLowerCase();
      if (isDownloading || linkName === 'href' || linkName === 'src' || linkName === 'data-src') {
        push(value, tag, isDownloading, nearText(html, index, value));
      }
    });
  }

  // Meta refresh (server-side countdown / redirect).
  META_REFRESH_RE.lastIndex = 0;
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = META_REFRESH_RE.exec(html))) {
    const content = metaMatch[1];
    if (!content) continue;
    const afterEquals = content.split(/\s*[;,]?\s*url\s*=\s*/i)[1];
    if (afterEquals) push(afterEquals.trim(), 'meta', false, '');
  }

  return candidates;
}

/** Pick the best candidate from {@link extractCandidateUrls}. */
export function bestLink(urls: CandidateLink[]): string | undefined {
  if (urls.length === 0) return undefined;
  const sorted = [...urls].sort((a, b) => b.score - a.score);
  return sorted[0]?.url;
}

function attrs(body: string): Array<{ name: string; value: string }> {
  const found: Array<{ name: string; value: string }> = [];
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(body))) {
    const value = m[2] ?? m[3] ?? m[4];
    found.push({ name: m[1]!, value: value ?? '' });
  }
  return found;
}

/** Cheap look-behind window to pick up "Download" text near the link. */
function nearText(html: string, index: number, value: string): string {
  const start = Math.max(0, index - 120);
  const end = Math.min(html.length, index + value.length + 120);
  return html.slice(start, end);
}

function scoreCandidate(url: string, tag: string, download: boolean, nearText: string): number {
  let score = 0;

  if (download) score += 100;
  if (MEDIA_TAGS.has(tag)) score += 30;
  if (UNLIKELY_TAGS.has(tag)) score -= 40;

  const lower = url.toLowerCase();
  const near = nearText.toLowerCase();

  if (/download|télécharg|descargar|herunterladen/.test(near)) score += 40;
  if (FILE_EXT_RE.test(lower)) score += 30;
  // The plain URL text like "here" is common for download links.
  if (/\bhere\b|\bnow\b|\bclick\b/.test(near)) score += 10;
  // Prefer https over http by a hair.
  if (lower.startsWith('https:')) score += 2;

  return score;
}
