import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BlastRadiusResult, CoupledFile, SymbolRef } from '@ai-companion/types';
import { createLogger } from '@ai-companion/utils';
import { runQuery } from './neo4j-client.js';

const log = createLogger('graph-server');

async function getBlastRadius(args: Record<string, unknown>): Promise<CallToolResult> {
  const { nodeId, nodeType = 'File', maxDepth = 5 } = args as {
    nodeId: string; nodeType?: string; maxDepth?: number;
  };

  const result = await runQuery<{ nodeId: string; nodeType: string; depth: number; confidence: number; path: string[] }>(
    `MATCH path = (root {id: $nodeId})-[:CALLS*1..${maxDepth}]->(affected)
     RETURN affected.id AS nodeId, labels(affected)[0] AS nodeType,
            length(path) AS depth,
            reduce(conf = 1.0, r IN relationships(path) | conf * coalesce(r.confidence, 1.0)) AS confidence,
            [n IN nodes(path) | n.id] AS path
     ORDER BY depth`,
    { nodeId }
  );

  const blastRadius: BlastRadiusResult = {
    rootNode: nodeId,
    affected: result,
    totalAffected: result.length,
  };

  log.debug(`Blast radius for ${nodeId}: ${result.length} affected nodes`);
  return { content: [{ type: 'text', text: JSON.stringify(blastRadius) }] };
}

async function findDependencies(args: Record<string, unknown>): Promise<CallToolResult> {
  const { nodeId, direction = 'both', maxDepth = 3 } = args as {
    nodeId: string; direction?: 'inbound' | 'outbound' | 'both'; maxDepth?: number;
  };

  let pattern: string;
  switch (direction) {
    case 'inbound': pattern = `(n)-[:CALLS*1..${maxDepth}]->(root {id: $nodeId})`; break;
    case 'outbound': pattern = `(root {id: $nodeId})-[:CALLS*1..${maxDepth}]->(n)`; break;
    default: pattern = `(root {id: $nodeId})-[:CALLS*0..${maxDepth}]-(n)`;
  }

  const rows = await runQuery(
    `MATCH path = ${pattern} WHERE n.id <> $nodeId RETURN DISTINCT n.id AS id, labels(n)[0] AS type, length(path) AS depth ORDER BY depth`,
    { nodeId }
  );

  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

async function getCoupledFiles(args: Record<string, unknown>): Promise<CallToolResult> {
  const { filePath, minStrength = 0.3, limit = 10 } = args as {
    filePath: string; minStrength?: number; limit?: number;
  };

  const rows = await runQuery<CoupledFile>(
    `MATCH (f:File {id: $filePath})-[r:COUPLED_WITH]->(other:File)
     WHERE r.strength >= $minStrength
     RETURN other.id AS filePath, r.strength AS strength, r.commitCount AS commitCount
     ORDER BY r.strength DESC LIMIT $limit`,
    { filePath, minStrength, limit }
  );

  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

async function searchSymbols(args: Record<string, unknown>): Promise<CallToolResult> {
  const { name, kind, filePath, limit = 20 } = args as {
    name?: string; kind?: string; filePath?: string; limit?: number;
  };

  const conditions: string[] = [];
  const params: Record<string, unknown> = { limit };
  if (name) { conditions.push('s.name =~ $namePattern'); params['namePattern'] = `(?i).*${name}.*`; }
  if (kind) { conditions.push('s.kind = $kind'); params['kind'] = kind; }
  if (filePath) { conditions.push('(s)-[:DEFINED_IN]->(:File {id: $filePath})'); params['filePath'] = filePath; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await runQuery<SymbolRef>(
    `MATCH (s:Symbol) ${where} RETURN s.name AS name, s.filePath AS filePath, s.line AS line, s.kind AS kind LIMIT $limit`,
    params
  );

  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

async function indexRepository(args: Record<string, unknown>): Promise<CallToolResult> {
  const { repoPath, repoName } = args as { repoPath: string; repoName: string };

  await runQuery(
    'MERGE (r:Repository {id: $repoName}) SET r.path = $repoPath, r.indexedAt = datetime()',
    { repoName, repoPath }
  );

  log.info(`Repository node created/updated: ${repoName}`);
  return { content: [{ type: 'text', text: JSON.stringify({ repoName, repoPath, status: 'indexed' }) }] };
}

export const TOOLS: Tool[] = [
  {
    name: 'get_blast_radius',
    description: 'Get all nodes transitively affected by a change to a file or symbol',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'File path or symbol ID' },
        nodeType: { type: 'string', enum: ['File', 'Symbol'], default: 'File' },
        maxDepth: { type: 'number', default: 5 },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'find_dependencies',
    description: 'Find what a node depends on or what depends on it',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        direction: { type: 'string', enum: ['inbound', 'outbound', 'both'], default: 'both' },
        maxDepth: { type: 'number', default: 3 },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'get_coupled_files',
    description: 'Find files historically coupled with a given file (from git commit co-change)',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        minStrength: { type: 'number', default: 0.3 },
        limit: { type: 'number', default: 10 },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'search_symbols',
    description: 'Search code symbols by name, kind, or file',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        kind: { type: 'string', enum: ['function', 'class', 'interface', 'variable', 'type'] },
        filePath: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'index_repository',
    description: 'Register or re-index a repository in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Local filesystem path to the repo' },
        repoName: { type: 'string', description: 'Repository name (e.g., pas-blazor-ai)' },
      },
      required: ['repoPath', 'repoName'],
    },
  },
];

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> = {
  get_blast_radius: getBlastRadius,
  find_dependencies: findDependencies,
  get_coupled_files: getCoupledFiles,
  search_symbols: searchSymbols,
  index_repository: indexRepository,
};

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(args);
}
