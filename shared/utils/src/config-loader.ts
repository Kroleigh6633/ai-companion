import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface PortRegistry {
  mcpShell:     number;   // 8180
  companionApi: number;   // 8181
  [key: string]: number;  // extensible for future services
}

export interface McpConfig {
  ports:     PortRegistry;
  neo4j:     { url: string; user: string; password: string };
  sqlServer: { server: string; database: string; trustedConnection: boolean };
  apiServer: { baseUrl: string };
  ollama:    { baseUrl: string };
  fileStore: { basePath: string };
  github?:   { token: string };  // optional — only needed when GitHub Issues sync is built
}

let _config: McpConfig | null = null;

export function loadConfig(): McpConfig {
  if (_config) return _config;

  const configPath = process.env['CONFIG_PATH']
    ?? resolve(process.env['APPDATA'] ?? '~', 'pas', 'mcp-config.json');

  try {
    const raw = readFileSync(configPath, 'utf-8');
    _config = JSON.parse(raw) as McpConfig;
    return _config;
  } catch (err) {
    throw new Error(`Failed to load MCP config from ${configPath}: ${String(err)}`);
  }
}

export function getConfig(): McpConfig {
  return loadConfig();
}
