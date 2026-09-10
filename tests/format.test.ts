import { describe, expect, it } from 'vitest';
import { formatBytes } from '../src/core/format.js';

describe('formatBytes', () => {
  it('formats bytes below 1024 with no decimals', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes, megabytes and gigabytes (binary units)', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2516582)).toBe('2.4 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
  });

  it('respects a custom decimals option', () => {
    expect(formatBytes(2516582, { decimals: 2 })).toBe('2.40 MB');
    expect(formatBytes(2516582, { decimals: 0 })).toBe('2 MB');
  });

  it('supports decimal (1000-based) units', () => {
    expect(formatBytes(1000, { decimal: true })).toBe('1.0 KB');
    expect(formatBytes(1_000_000, { decimal: true })).toBe('1.0 MB');
  });

  it('throws for negative or non-finite input', () => {
    expect(() => formatBytes(-1)).toThrow(RangeError);
    expect(() => formatBytes(Number.NaN)).toThrow(RangeError);
    expect(() => formatBytes(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
