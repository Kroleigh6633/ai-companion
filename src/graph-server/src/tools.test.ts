import { describe, it, expect, vi } from 'vitest';

// Mock neo4j-client to avoid DB dependency
vi.mock('./neo4j-client.js', () => ({
  runQuery: vi.fn().mockResolvedValue([]),
}));

// Mock utils
vi.mock('@ai-companion/utils', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getConfig: vi.fn().mockReturnValue({ neo4j: { url: 'bolt://localhost', user: 'neo4j', password: 'test' } }),
}));

import { handleToolCall, TOOLS } from './tools.js';

describe('graph-server tools', () => {
  it('exports expected tool names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toContain('get_blast_radius');
    expect(names).toContain('find_dependencies');
    expect(names).toContain('get_coupled_files');
    expect(names).toContain('search_symbols');
    expect(names).toContain('index_repository');
  });

  it('returns error for unknown tool', async () => {
    const result = await handleToolCall('nonexistent', {});
    expect(result.isError).toBe(true);
  });

  it('get_blast_radius returns result', async () => {
    const result = await handleToolCall('get_blast_radius', { nodeId: 'src/foo.ts' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toHaveProperty('rootNode');
  });

  it('index_repository returns status', async () => {
    const result = await handleToolCall('index_repository', { repoPath: '/c/pas/repos/test', repoName: 'test' });
    expect(result.isError).toBeFalsy();
  });
});
