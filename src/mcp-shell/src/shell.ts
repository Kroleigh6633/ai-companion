import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerRegistry } from './registry.js';
import { initLoader } from './loader.js';
import { ToolRouter } from './router.js';
import { startPoller, stopPoller } from './poller.js';
import { createLogger } from '@ai-companion/utils';

const log = createLogger('mcp-shell');

const registry = new ServerRegistry();
const router = new ToolRouter(registry);

const server = new Server(
  { name: 'pas-companion', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: registry.getAllTools() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return router.route(name, (args ?? {}) as Record<string, unknown>);
});

async function main() {
  log.info('Starting MCP shell...');

  await initLoader(registry, () => {
    log.info('Tools updated, notifying client...');
    server.notification({ method: 'notifications/tools/list_changed' }).catch(() => {});
  });

  startPoller();

  process.on('SIGINT', () => { stopPoller(); process.exit(0); });
  process.on('SIGTERM', () => { stopPoller(); process.exit(0); });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('MCP shell connected via stdio');
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
