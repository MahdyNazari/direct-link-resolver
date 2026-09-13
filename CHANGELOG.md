# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Android app (`apps/mobile`) built with Capacitor + React, providing a
  graphical interface to `resolveLink`/`downloadFile`.
- `createCapacitorFileSink` — a `DownloadSink` implementation backed by
  `@capacitor/filesystem`, streaming chunks via `writeFile` (first chunk) +
  `appendFile` (subsequent chunks) to preserve constant-memory downloads on
  Android, writing into the app-scoped `Directory.Documents` (no runtime
  storage permission required).

## [0.2.0] - 2026-09-10
### Added
- Human-readable file size formatting (`formatBytes`) exported from the public API.
- `ResolvedLink.sizeFormatted` field.
- CLI now shows human-readable size alongside raw byte count.

## [0.1.1] - 2026-09-07
### Added
- Add CHANGELOG.md following the Keep a Changelog format.
- Add GitHub Actions CI workflow to run typecheck and tests on push/PR.
- Add .gitattributes to normalize line endings.

## [0.1.0] - 2026-09-03
### Added
- Initial implementation of `resolveLink` and `downloadFile` core functions.
- Plugin-based resolver architecture (`src/core/resolvers/`) for handling
  different link/service types.
- Two built-in resolvers: simple HTTP redirect resolution and direct-link
  extraction from HTML pages.
- CLI with `resolve` and `download` commands (`commander`-based).
- Dual CJS/ESM build output via `tsup`, with generated `.d.ts` type declarations.
- Full unit test suite (Vitest) covering core logic and both resolvers.
- README with library usage, CLI usage, architecture notes, and a disclaimer
  restricting the tool to public/legal content.

[Unreleased]: https://github.com/MahdyNazari/direct-link-resolver/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/MahdyNazari/direct-link-resolver/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/MahdyNazari/direct-link-resolver/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MahdyNazari/direct-link-resolver/releases/tag/v0.1.0