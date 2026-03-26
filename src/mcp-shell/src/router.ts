import type { ServerRegistry } from './registry.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '@ai-companion/utils';

const log = createLogger('router');

export class ToolRouter {
  constructor(private registry: ServerRegistry) {}

  async route(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const mod = this.registry.findModule(toolName);
    if (!mod) {
      log.error(`No handler for tool: ${toolName}`);
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    log.debug(`Routing ${toolName} to ${mod.name}`, { args });
    try {
      return await mod.handleToolCall(toolName, args);
    } catch (err) {
      log.error(`Tool ${toolName} failed`, err);
      return {
        content: [{ type: 'text', text: `Tool error: ${String(err)}` }],
        isError: true,
      };
    }
  }
}
