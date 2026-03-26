import { build } from 'esbuild';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const tsc = resolve(dir, '../../node_modules/typescript/bin/tsc');

execSync(`node "${tsc}" --project tsconfig.json --emitDeclarationOnly`, { stdio: 'inherit', cwd: dir });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
});

console.log('Built @ai-companion/utils');
