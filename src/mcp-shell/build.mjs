import { build } from 'esbuild';

await build({
  entryPoints: ['src/shell.ts'],
  outfile: 'dist/shell.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
});

console.log('Built mcp-shell');
