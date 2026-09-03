import { defineConfig } from 'tsup';

/**
 * Three independent builds share `dist/`:
 *  1. `index`      — the portable core, dual ESM+CJS with types (platform-neutral).
 *  2. `cli/index`  — the CLI binary, CJS only, bundled, with a shebang (Node).
 *  3. `node/file-sink` — the Node filesystem sink, dual ESM+CJS (Node).
 *
 * Only the first config cleans `dist`; the others append to it.
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    platform: 'neutral',
  },
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    clean: false,
    target: 'node18',
    platform: 'node',
    external: ['commander'],
    // esbuild preserves the shebang from the source entry automatically.
  },
  {
    entry: { 'node/file-sink': 'src/node/file-sink.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'node18',
    platform: 'node',
  },
]);
