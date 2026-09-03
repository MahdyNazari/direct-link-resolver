# direct-link-resolver

Resolve **any public, legal URL** to its terminal, directly downloadable file link, and optionally stream that file to disk. It follows multi-step HTTP redirects, peeks through plain intermediary "download" pages that embed the real link, and extracts a direct file link from a page's HTML — then, if you ask it to, downloads the file by **streaming** it (it never buffers the whole file in memory).

- **Runtime-agnostic core** — built on the standard WHATWG `fetch` API, so it runs on Node 18+, browsers, and Cloudflare Workers.
- **Small and dependency-light** — the core has *zero* runtime dependencies. The only runtime dependency is `commander`, used by the CLI.
- **Extensible** — each URL "service type" (plain redirect, HTML page, a vendor page, …) is one small resolver module. Adding support for a new kind of URL means adding **one new file** and registering it; no existing code changes.
- **Dual ESM + CJS**, with generated `.d.ts` types. Both `import { resolveLink }` and `require('direct-link-resolver')` work.

---

## ⚠️ Disclaimer

**This tool is intended exclusively for publicly accessible, legal content that its owner has made available for download.** It is designed to make legitimate workflows (following redirects, downloading public files, extracting links from a page you are allowed to read) more convenient — not to circumvent payments, access controls, authentication, geo-restrictions, or any form of protection (paywalls, DRM, login-gated, or otherwise protected material).

By using it you agree that:

- You will only resolve and download content you are **authorized** to access.
- You are responsible for complying with the laws, terms of service, and copyright rules that apply to the content and to your jurisdiction.
- The maintainers provide this software **as-is**, without guarantee, and accept no liability for any misuse.

If a URL requires a login, a payment, or any other authorization you do not already hold, this tool is **not** for that purpose — and it cannot help you anyway, since it only uses the anonymous `fetch` API.

---

## Installation

```bash
npm install direct-link-resolver
# or
pnpm add direct-link-resolver
# or
yarn add direct-link-resolver
```

Requires **Node 18+** (which ships the global `fetch`). In a browser a bundler that supports `fetch`/streams works too (see "Browser use" below).

---

## Usage as a library

Import it in your ESM project:

```ts
import { resolveLink, downloadFile } from 'direct-link-resolver';
import { createFileSink } from 'direct-link-resolver/node';
```

### `resolveLink(url, options?): Promise<ResolvedLink>`

Resolves a URL to its final direct link. It never writes to disk.

```ts
import { resolveLink } from 'direct-link-resolver';

const link = await resolveLink('https://example.com/download');
// {
//   url:          'https://cdn.example.com/archive.zip',  // direct download URL
//   filename:     'archive.zip',                          // best-effort
//   size:         250937,                                 // bytes, if declared
//   contentType:  'application/zip',
//   headers:      { 'content-type': 'application/zip', ... },
//   resolvedBy:   'redirect',                             // which resolver found it
//   via:          ['redirect', 'html'],                   // hops taken
//   redirects:    1
// }
```

`ResolvedLink` fields:

| field | type | notes |
| --- | --- | --- |
| `url` | `string` | the terminal, directly-downloadable URL |
| `filename` | `string?` | from `Content-Disposition` (RFC 5987 aware) or the URL path |
| `size` | `number?` | from `Content-Length`, if the server declares it |
| `contentType` | `string?` | the MIME type, if declared |
| `headers` | `Record<string,string>` | normalized, lower-cased headers of the final response |
| `resolvedBy` | `string` | name of the resolver that produced the terminal result |
| `via` | `string[]` | ordered names of resolvers that changed the URL along the way |
| `redirects` | `number` | number of hops (HTTP redirects and embedded-link re-routes) |

### `downloadFile(url, options?): Promise<DownloadResult>`

Uses `resolveLink` internally, then **streams** the file into a sink. It holds at most one chunk in memory — it never buffers the whole file.

```ts
import { downloadFile } from 'direct-link-resolver';
import { createFileSink } from 'direct-link-resolver/node';

const sink = await createFileSink('./archive.zip', { overwrite: false, ensureDir: true });

const result = await downloadFile('https://example.com/download', {
  sink,
  onProgress: (progress) => {
    if (progress.totalBytes !== undefined) {
      process.stdout.write(`\r${progress.percent!.toFixed(1)}%`);
    }
  },
});

// result = {
//   bytes: 250937,
//   size: 250937,
//   resolvedLink: { url: 'https://cdn.example.com/archive.zip', ... }
// }
```

Because the downloader writes through a **`DownloadSink`** abstraction, you can target anything: a file (`createFileSink`), a `WritableStream` in a browser, an S3 stream, etc. That keeps the core free of any Node-only code.

#### `DownloadSink`

```ts
export interface DownloadSink {
  write(chunk: Uint8Array): Promise<void>;
  finish(): Promise<void>;
  abort(error?: unknown): Promise<void>;
}
```

### Options

The same options are accepted by `resolveLink` and `downloadFile`:

```ts
interface CoreOptions {
  fetch?: /// inject a fetch implementation (in Node 18+ defaults to globalThis.fetch)
  timeoutMs?: number;      // abort after N ms
  maxRedirects?: number;   // default 10
  signal?: AbortSignal;    // external cancellation
}
```

### Module system support

```ts
// ESM
import { resolveLink } from 'direct-link-resolver';

// CJS
const { resolveLink } = require('direct-link-resolver');
```

The filesystem sink lives behind the `direct-link-resolver/node` subpath so the core stays portable:

```ts
import { createFileSink } from 'direct-link-resolver/node'; // Node only
```

### Typed errors

All errors extend `DirectLinkResolverError`:

```ts
import {
  DirectLinkResolverError,
  ResolutionError,
  RedirectError,
  HttpStatusError,
  UnsupportedUrlError,
  SinkError,
  DownloadError,
} from 'direct-link-resolver';

try {
  await resolveLink(url);
} catch (err) {
  if (err instanceof HttpStatusError) console.error(`HTTP ${err.status}`);
  if (err instanceof ResolutionError) console.error('No direct link could be extracted');
}
```

### Browser use

The core (everything from `direct-link-resolver`) only relies on `fetch`, `Response`, `Headers` and web `ReadableStream`, so it bundles cleanly for the browser. Do **not** import `direct-link-resolver/node` in a browser. To save a download in a browser, provide a `DownloadSink` backed by a `WritableStream` or a `Blob` builder.

---

## Usage as CLI

The CLI is a thin wrapper over the core (`bin: direct-link-resolver`).

```bash
# Resolve and print the direct link (human-readable)
direct-link-resolver resolve https://example.com/download

# As JSON, for scripting
direct-link-resolver resolve https://example.com/download --json

# Follow a bare URL (shorthand for resolve)
direct-link-resolver https://example.com/download

# Resolve, then stream the file to disk, showing progress
direct-link-resolver download https://example.com/download -o ./archive.zip --progress

# Overwrite an existing file / create the parent directory
direct-link-resolver download https://example.com/download -o ./x/archive.zip --overwrite --ensure-dir

# Set timeouts / limits
direct-link-resolver resolve https://example.com/download --timeout 5000 --max-redirects 20
```

### CLI commands

| command | description |
| --- | --- |
| `resolve <url>` | print metadata for the terminal direct link (`--json` for JSON) |
| `download <url>` | resolve and stream the file to disk (`-o <path>` required) |

### CLI flags

| flag | applies to | description |
| --- | --- | --- |
| `--json` | `resolve` | print the `ResolvedLink` as JSON |
| `-o, --output <path>` | `download` | destination file (required) |
| `--overwrite` | `download` | allow overwriting an existing file |
| `--ensure-dir` | `download` | create the parent directory if missing |
| `--progress` | `download` | print live progress to stderr |
| `--timeout <ms>` | both | abort after N ms |
| `--max-redirects <n>` | both | cap redirect/hop count |

Example output:

```bash
$ direct-link-resolver resolve https://example.com/download
URL:         https://cdn.example.com/archive.zip
Filename:    archive.zip
Size:        250937 bytes
Content-Type: application/zip
Resolved by: redirect
Via:         redirect -> html
Redirects:   1
```

---

## How it works & architecture

The project is split into a strictly-runtime-agnostic **core** and a thin **CLI**.

```
src/
  core/          ← pure logic. No console.log, no Node-only APIs.
    types.ts        All public interfaces (ResolvedLink, DownloadSink, …).
    errors.ts       Typed errors.
    runtime.ts      `FetchLike` + default `fetch`.
    fetch.ts        Redirect-following fetch (uses redirect:'follow').
    url.ts          URL/headers/file-name helpers.
    html.ts         Dependency-free HTML link extraction & scoring.
    resolved.ts     Builds a ResolvedLink from a response.
    resolve.ts      Orchestrates the resolver pipeline (redirects + loops).
    download.ts     Streams a resolved link into a DownloadSink.
    resolvers/
      resolver.ts   The plugin contract (`Resolver` / `ResolveResult`).
      redirect.ts   Network + direct-file resolver (example #1).
      html.ts       HTML "download page" resolver (example #2).
      index.ts      Registry array + lookup.
  node/          ← the only Node-specific code.
    file-sink.ts    `createFileSink` (imports node:fs).
  cli/           ← argument parsing + printing. No business logic.
    index.ts
  index.ts       ← public API (core only, runtime-agnostic).
```

**The resolver pipeline.** A `Resolver` is a tiny plugin:

```ts
export interface Resolver {
  readonly name: string;
  canHandle(url: URL): boolean;
  resolve(url: URL, ctx: ResolverContext): Promise<ResolveResult>;
  resolvePage?(page: PageDocument, ctx: ResolverContext): Promise<ResolveResult>;
}
```

`resolveLink` walks the registry in order. The first resolver that `canHandle`s a URL and does **not** return `unhandled` wins. The result is a discriminated union that lets any resolver route to a *new* URL (`redirect`), hand an already-fetched HTML document to the HTML resolver (`page`), or declare success (`handled`). Because the pipeline re-runs on any new URL, a chain like `redirect → HTML page → embedded link → another redirect` is handled automatically, with loop detection and a hop limit.

**Why `redirect: 'follow'`?** Browsers cannot read a redirect's `Location` header when using `redirect: 'manual'` (they get an opaque redirect), so manual redirect-following would break in browsers. We use `redirect: 'follow'` to stay cross-runtime; the Fetch API doesn't expose an exact redirect count, so `redirects` reflects the number of hops/resolutions we observed rather than the internal HTTP 3xx count.

**Extending it.** Add a new file under `src/core/resolvers/` implementing `Resolver`, then append it to the `resolvers` array in `resolvers/index.ts`. You never touch the pipeline, the CLI, or existing resolvers.

---

## Limitations

- **Client-side JavaScript** (for example, countdown pages that reveal the URL only after a script runs) cannot be resolved — the tool executes no JavaScript. If it finds an HTML page it can't get a link from, it throws `ResolutionError` with an explanatory message. Server-side meta-refresh countdowns **are** handled.
- The HTML extractor is regex-based and targets common server-rendered patterns (`<a href download>`, media `src`, `<meta http-equiv="refresh">`). Heavily obfuscated or unusual pages may need a custom resolver.
- It only uses anonymous `fetch` — no cookies, sessions, or headers beyond defaults — which is exactly why it cannot (and will not) bypass protected content.
- Node's global `fetch` follows up to 20 redirects; the tool's own `maxRedirects` guard applies to resolver hops.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest run
npm run build       # tsup → dist (ESM + CJS + d.ts)
node dist/cli/index.cjs --help   # try the built CLI
```

License: MIT. See `LICENSE`.
