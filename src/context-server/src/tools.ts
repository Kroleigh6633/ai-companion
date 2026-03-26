import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MemoryBlockKey } from '@ai-companion/types';
import { query, createLogger } from '@ai-companion/utils';
import { getBlock, setBlock, getAllBlocks, checkHealth } from './memory-blocks.js';
import { compressContext } from './compressor.js';

const log = createLogger('context-server');

async function getMemoryBlock(args: Record<string, unknown>): Promise<CallToolResult> {
  const { key } = args as { key: string };
  const block = await getBlock(key as MemoryBlockKey);
  if (!block) {
    return { content: [{ type: 'text', text: `Memory block not found: ${key}` }], isError: true };
  }
  return { content: [{ type: 'text', text: JSON.stringify(block) }] };
}

async function updateMemoryBlock(args: Record<string, unknown>): Promise<CallToolResult> {
  const { key, content } = args as { key: string; content: string };
  const block = await setBlock(key as MemoryBlockKey, content);
  log.info(`Updated memory block: ${key}`);
  return { content: [{ type: 'text', text: JSON.stringify(block) }] };
}

async function compress(args: Record<string, unknown>): Promise<CallToolResult> {
  const { sessionId, targetRatio = 4 } = args as { sessionId: string; targetRatio?: number };
  const snapshot = await compressContext(sessionId, targetRatio);
  return { content: [{ type: 'text', text: JSON.stringify(snapshot) }] };
}

async function getArchival(args: Record<string, unknown>): Promise<CallToolResult> {
  const { limit = 5 } = args as { limit?: number };
  const rows = await query(
    'SELECT TOP (@limit) * FROM ContextSnapshots ORDER BY createdAt DESC',
    { limit }
  );
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

async function contextHealth(args: Record<string, unknown>): Promise<CallToolResult> {
  const { currentTokenCount = 0, maxTokens = 200000 } = args as { currentTokenCount?: number; maxTokens?: number };
  const report = await checkHealth(currentTokenCount, maxTokens);
  return { content: [{ type: 'text', text: JSON.stringify(report) }] };
}

export const TOOLS: Tool[] = [
  {
    name: 'get_memory_block',
    description: 'Retrieve a persistent memory block by key',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['workspace_goals', 'active_task', 'recent_decisions', 'active_blockers', 'knowledge_state'] },
      },
      required: ['key'],
    },
  },
  {
    name: 'update_memory_block',
    description: 'Update or create a persistent memory block',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        content: { type: 'string', description: 'New content for the memory block' },
      },
      required: ['key', 'content'],
    },
  },
  {
    name: 'compress_context',
    description: 'Compress context when approaching token limits (trigger at 70% utilization)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        targetRatio: { type: 'number', description: 'Compression ratio target (default 4 = 4:1)', default: 4 },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_archival_context',
    description: 'Retrieve recent compressed context snapshots',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', default: 5 } },
    },
  },
  {
    name: 'check_context_health',
    description: 'Check context utilization, drift, and compression recommendation',
    inputSchema: {
      type: 'object',
      properties: {
        currentTokenCount: { type: 'number', description: 'Current context token count' },
        maxTokens: { type: 'number', description: 'Max context window (default 200000)', default: 200000 },
      },
    },
  },
];

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> = {
  get_memory_block: getMemoryBlock,
  update_memory_block: updateMemoryBlock,
  compress_context: compress,
  get_archival_context: getArchival,
  check_context_health: contextHealth,
};

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(args);
}
