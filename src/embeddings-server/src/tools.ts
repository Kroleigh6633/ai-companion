import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { execute, query, createLogger } from '@ai-companion/utils';
import { embed, cosineSimilarity } from './ollama-client.js';
import { randomUUID } from 'crypto';

const log = createLogger('embeddings-server');

async function embedAndIndex(args: Record<string, unknown>): Promise<CallToolResult> {
  const { chunkId, text, documentId } = args as { chunkId?: string; text: string; documentId?: string };
  const id = chunkId ?? randomUUID();

  const { embedding } = await embed(text);
  const vectorJson = JSON.stringify(embedding);

  await execute(
    `MERGE INTO DocumentChunks (id) VALUES (@id)
     WHEN MATCHED THEN UPDATE SET embedding = @embedding
     WHEN NOT MATCHED THEN INSERT (id, documentId, content, chunkIndex, tokenCount, embedding, createdAt)
       VALUES (@id, @documentId, @text, 0, @tokenCount, @embedding, GETUTCDATE())`,
    {
      id,
      documentId: documentId ?? 'standalone',
      text,
      tokenCount: Math.ceil(text.length / 4),
      embedding: vectorJson,
    }
  );

  log.info(`Indexed chunk ${id}`);
  return { content: [{ type: 'text', text: JSON.stringify({ id, dimensions: embedding.length }) }] };
}

async function semanticSearch(args: Record<string, unknown>): Promise<CallToolResult> {
  const { query: searchQuery, k = 5, documentTypeId } = args as {
    query: string; k?: number; documentTypeId?: string;
  };

  const { embedding: queryVec } = await embed(searchQuery);

  const typeFilter = documentTypeId ? 'AND d.typeId = @documentTypeId' : '';
  const rows = await query<{ id: string; documentId: string; content: string; embedding: string; title: string; typeId: string }>(
    `SELECT TOP 100 dc.id, dc.documentId, dc.content, dc.embedding, d.title, d.typeId
     FROM DocumentChunks dc
     JOIN Documents d ON dc.documentId = d.id
     WHERE dc.embedding IS NOT NULL ${typeFilter}`,
    documentTypeId ? { documentTypeId } : {}
  );

  const scored = rows
    .map((row) => {
      try {
        const vec = JSON.parse(row.embedding) as number[];
        return { ...row, score: cosineSimilarity(queryVec, vec) };
      } catch {
        return { ...row, score: 0 };
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ embedding: _e, ...rest }) => rest);

  return { content: [{ type: 'text', text: JSON.stringify(scored) }] };
}

async function findSimilar(args: Record<string, unknown>): Promise<CallToolResult> {
  const { chunkId, k = 5 } = args as { chunkId: string; k?: number };

  const rows = await query<{ embedding: string }>(
    'SELECT embedding FROM DocumentChunks WHERE id = @chunkId',
    { chunkId }
  );

  if (!rows.length || !rows[0].embedding) {
    return { content: [{ type: 'text', text: 'Chunk not found or not embedded' }], isError: true };
  }

  const sourceVec = JSON.parse(rows[0].embedding) as number[];
  return semanticSearch({ query: '', k, _sourceVec: sourceVec } as Record<string, unknown>);
}

export const TOOLS: Tool[] = [
  {
    name: 'embed_and_index',
    description: 'Embed text with nomic-embed-text and store the vector',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to embed (max ~8192 tokens)' },
        chunkId: { type: 'string', description: 'Optional: existing chunk ID to update' },
        documentId: { type: 'string', description: 'Optional: parent document ID' },
      },
      required: ['text'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Find document chunks semantically similar to a query using cosine similarity',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        k: { type: 'number', description: 'Number of results (default 5, use 7-10 for analytical)' },
        documentTypeId: { type: 'string', description: 'Filter by document type' },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_similar',
    description: 'Find chunks similar to a given chunk by ID',
    inputSchema: {
      type: 'object',
      properties: {
        chunkId: { type: 'string', description: 'Source chunk ID' },
        k: { type: 'number', default: 5 },
      },
      required: ['chunkId'],
    },
  },
];

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> = {
  embed_and_index: embedAndIndex,
  semantic_search: semanticSearch,
  find_similar: findSimilar,
};

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(args);
}
