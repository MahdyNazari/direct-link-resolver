# direct-link-resolver (monorepo)

This repository is an npm workspaces monorepo with two projects:

- [`packages/direct-link-resolver`](packages/direct-link-resolver) — the
  core library and CLI (published to npm as `direct-link-resolver`). Runtime-
  agnostic (Node 18+, browsers, Cloudflare Workers), zero runtime
  dependencies aside from the CLI's use of `commander`.
- [`apps/mobile`](apps/mobile) — an Android app (Capacitor + React) providing
  a graphical front-end to the library, using a `DownloadSink` implementation
  backed by `@capacitor/filesystem`.

For installation, API reference, and CLI usage of the library itself, see
**[`packages/direct-link-resolver/README.md`](packages/direct-link-resolver/README.md)**
— that is also what's shown on the [npm package page](https://www.npmjs.com/package/direct-link-resolver).

For building/running the Android app, see
**[`apps/mobile/README.md`](apps/mobile/README.md)**.

## Development

```bash
npm install
npm run build --workspace=packages/direct-link-resolver
npm run typecheck --workspaces --if-present
npm test --workspace=packages/direct-link-resolver
```

`apps/mobile` depends on `packages/direct-link-resolver` as a local workspace
package (symlinked automatically by `npm install`, resolved from `dist/`, not
`src/`) — rebuild the library after changing it for the mobile app to see the
change.

## License

MIT — see [`LICENSE`](LICENSE). Applies to the library; the mobile app has no
separate license file at this time.
