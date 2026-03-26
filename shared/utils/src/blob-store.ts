import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { getConfig } from './config-loader.js';

function resolvePath(relativePath: string): string {
  const basePath = getConfig().fileStore.basePath;
  return join(basePath, relativePath);
}

export function blobRead(relativePath: string): string {
  const full = resolvePath(relativePath);
  if (!existsSync(full)) throw new Error(`Blob not found: ${relativePath}`);
  return readFileSync(full, 'utf-8');
}

export function blobWrite(relativePath: string, content: string): void {
  const full = resolvePath(relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf-8');
}

export function blobDelete(relativePath: string): void {
  const full = resolvePath(relativePath);
  if (existsSync(full)) unlinkSync(full);
}

export function blobExists(relativePath: string): boolean {
  return existsSync(resolvePath(relativePath));
}

export function makeBlobPath(table: string, rowId: string, column: string, ext = 'txt'): string {
  return `pas/blobs/${table}/${rowId}/${column}.${ext}`;
}
