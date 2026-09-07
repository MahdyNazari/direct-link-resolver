# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/MahdyNazari/direct-link-resolver/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MahdyNazari/direct-link-resolver/releases/tag/v0.1.0
