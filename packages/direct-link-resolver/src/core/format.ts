/**
 * Human-readable byte formatting.
 *
 * Kept dependency-free and separate from `resolved.ts`: the core always
 * preserves the raw byte count (`ResolvedLink.size`), and this module is
 * purely a presentation helper that callers (CLI, consumers) can opt into.
 */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

export interface FormatBytesOptions {
  /** Number of decimal places to show. Defaults to 1 (0 for bytes). */
  decimals?: number;
  /** Use 1000-based (decimal, KB/MB/GB) instead of 1024-based (binary). Defaults to false (binary/1024). */
  decimal?: boolean;
}

/**
 * Format a byte count as a human-readable string, e.g. `2516582` → `"2.4 MB"`.
 *
 * Uses binary (1024-based) units by default, matching how most OS file
 * managers report size. Pass `{ decimal: true }` for 1000-based SI units.
 */
export function formatBytes(bytes: number, options: FormatBytesOptions = {}): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError(`formatBytes expects a non-negative finite number, got ${bytes}`);
  }

  const base = options.decimal ? 1000 : 1024;
  const decimals = options.decimals ?? (bytes < base ? 0 : 1);

  if (bytes === 0) return '0 B';
  if (bytes < base) return `${bytes} B`;

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(base, exponent);

  return `${value.toFixed(decimals)} ${UNITS[exponent]}`;
}
