import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { getConfig } from './config-loader.js';

export function fsRead(relativePath: string): string {
  const full = join(getConfig().fileStore.basePath, relativePath);
  return readFileSync(full, 'utf-8');
}

export function fsWrite(relativePath: string, content: string): void {
  const full = join(getConfig().fileStore.basePath, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf-8');
}

export function fsList(relativePath: string): string[] {
  const full = join(getConfig().fileStore.basePath, relativePath);
  if (!existsSync(full)) return [];
  return readdirSync(full);
}
