import { watch } from 'chokidar';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { existsSync } from 'fs';
import type { ServerRegistry } from './registry.js';
import { createLogger } from '@ai-companion/utils';

const log = createLogger('loader');

const TOOLS_DIR = process.env['TOOLS_DIR'] ?? 'C:/pas/tools';

async function loadModule(serverDir: string, registry: ServerRegistry, onChange?: () => void): Promise<void> {
  const indexPath = join(serverDir, 'index.js');
  if (!existsSync(indexPath)) return;

  try {
    const url = pathToFileURL(indexPath).href + `?bust=${Date.now()}`;
    const mod = await import(url) as { default?: unknown };
    if (mod.default && typeof mod.default === 'object' && 'name' in mod.default) {
      const apiMod = mod.default as import('./registry.js').ApiModule;
      registry.unregister(apiMod.name);
      registry.register(apiMod);
      log.info(`Loaded server: ${apiMod.name}`, { tools: apiMod.tools.map((t) => t.name) });
      onChange?.();
    }
  } catch (err) {
    log.error(`Failed to load module at ${indexPath}`, err);
  }
}

export async function initLoader(registry: ServerRegistry, onToolsChanged: () => void): Promise<void> {
  // Initial load of all servers
  const { readdirSync, statSync } = await import('fs');
  if (existsSync(TOOLS_DIR)) {
    for (const entry of readdirSync(TOOLS_DIR)) {
      const dir = join(TOOLS_DIR, entry);
      if (statSync(dir).isDirectory() && entry !== 'mcp-shell') {
        await loadModule(dir, registry, undefined);
      }
    }
  }

  // Watch for changes
  const watcher = watch(`${TOOLS_DIR}/*/index.js`, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', async (filePath) => {
    log.info(`New server detected: ${filePath}`);
    await loadModule(join(filePath, '..'), registry, onToolsChanged);
  });

  watcher.on('change', async (filePath) => {
    log.info(`Server changed: ${filePath}`);
    await loadModule(join(filePath, '..'), registry, onToolsChanged);
  });

  log.info('Hot-reload loader initialized', { watchDir: TOOLS_DIR });
}
