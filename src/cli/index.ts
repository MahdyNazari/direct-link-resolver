#!/usr/bin/env node
import { Command as Program } from 'commander';
import { downloadFile, resolveLink } from '../index.js';
import { createFileSink } from '../node/file-sink.js';
import type { DownloadProgress, ResolvedLink } from '../index.js';

/**
 * Commander v12 calls an action handler as `(operands…, options, command)`.
 * We only ever have a single operand (`url`), and we read the flags from the
 * `options` object. This is the library's only Node/TTY-facing layer: every
 * flag is mapped straight onto a core call, and output is printed to the
 * terminal — no business logic here.
 */

const program = new Program();

program
  .name('direct-link-resolver')
  .description(
    'Resolve and download the direct file link from any public, legal URL. ' +
      'For public/legal content only — it does not bypass payment or protected content.',
  )
  .version('0.1.0')
  .option('--timeout <ms>', 'abort requests after this many ms', parseNumber)
  .option('--max-redirects <n>', 'maximum redirects/hops to follow', parseNumber)
  .argument('[url]')
  .action((url: string | undefined, options: NumericFlags) =>
    url ? resolveToString(url, options) : printHelp(),
  );

program
  .command('resolve <url>')
  .description('Resolve a URL to its terminal direct link and print metadata')
  .option('--timeout <ms>', 'abort requests after this many ms', parseNumber)
  .option('--max-redirects <n>', 'maximum redirects/hops to follow', parseNumber)
  .option('--json', 'print the resolved link as JSON')
  .action((url: string, options: ResolveFlags) => resolveToString(url, options));

program
  .command('download <url>')
  .description('Resolve a URL and stream the file to disk')
  .requiredOption('-o, --output <path>', 'destination file path')
  .option('--overwrite', 'overwrite an existing file (default: refuse)')
  .option('--ensure-dir', 'create the parent directory if it does not exist')
  .option('--progress', 'print download progress to stderr')
  .option('--timeout <ms>', 'abort requests after this many ms', parseNumber)
  .option('--max-redirects <n>', 'maximum redirects/hops to follow', parseNumber)
  .action((url: string, options: DownloadFlags) => downloadToString(url, options));

void program.parseAsync(process.argv).catch((error: unknown) => fail(error));

interface NumericFlags {
  timeout?: number;
  maxRedirects?: number;
}

interface ResolveFlags extends NumericFlags {
  json?: boolean;
}

interface DownloadFlags extends NumericFlags {
  output: string;
  overwrite?: boolean;
  ensureDir?: boolean;
  progress?: boolean;
}

function resolveToString(url: string, flags: ResolveFlags): Promise<void> {
  return resolveLink(url, {
    maxRedirects: flags.maxRedirects,
    timeoutMs: flags.timeout,
  }).then((resolved) => {
    if (flags.json) process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    else printHuman(resolved);
  });
}

async function downloadToString(url: string, flags: DownloadFlags): Promise<void> {
  const sink = await createFileSink(flags.output, {
    overwrite: flags.overwrite,
    ensureDir: flags.ensureDir,
  });
  const result = await downloadFile(url, {
    sink,
    maxRedirects: flags.maxRedirects,
    timeoutMs: flags.timeout,
    onProgress: flags.progress ? humanProgress : undefined,
  });
  process.stdout.write(
    `Downloaded ${result.bytes} bytes to ${flags.output}` +
      (result.size !== undefined ? ` (of ${result.size} bytes)` : '') +
      '\n',
  );
  process.stdout.write(`Direct URL: ${result.resolvedLink.url}\n`);
}

function printHuman(link: ResolvedLink): void {
  writeLine(`URL:         ${link.url}`);
  if (link.filename !== undefined) writeLine(`Filename:    ${link.filename}`);
  if (link.size !== undefined) writeLine(`Size:        ${link.size} bytes`);
  if (link.contentType !== undefined) writeLine(`Content-Type: ${link.contentType}`);
  writeLine(`Resolved by: ${link.resolvedBy}`);
  if (link.via.length > 0) writeLine(`Via:         ${link.via.join(' -> ')}`);
  writeLine(`Redirects:   ${link.redirects}`);
}

function humanProgress(progress: DownloadProgress): void {
  const { receivedBytes, totalBytes, percent, url } = progress;
  const pct = percent !== undefined ? `${percent.toFixed(1)}% ` : '';
  const total = totalBytes !== undefined ? `/${totalBytes}` : '';
  process.stderr.write(`\r${pct}${receivedBytes}${total} B  ${url}`.padEnd(96) + '  ');
  if (percent !== undefined) process.stderr.write('\r\x1b[K');
}

function printHelp(): Promise<void> {
  program.outputHelp();
  return Promise.resolve();
}

function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

function parseNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Expected a non-negative number, got "${value}"`);
  }
  return n;
}

function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}
