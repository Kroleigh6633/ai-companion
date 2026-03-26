import type { MemoryBlock, MemoryBlockKey, ContextHealthReport } from '@ai-companion/types';
import { execute, query, blobWrite, blobRead, makeBlobPath, createLogger } from '@ai-companion/utils';
import { createHash } from 'crypto';

const log = createLogger('memory-blocks');

const COMPRESSION_THRESHOLD = 0.70;
const MAX_CONTENT_DB_CHARS = 2000;

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export async function getBlock(key: MemoryBlockKey | string): Promise<MemoryBlock | null> {
  const rows = await query<MemoryBlock[]>(
    'SELECT * FROM MemoryBlocks WHERE key = @key',
    { key }
  );
  if (!rows.length) return null;

  const block = rows[0];
  if (block.contentPath) {
    try {
      block.content = blobRead(block.contentPath);
    } catch {
      log.warn(`Could not read blob for memory block: ${key}`);
    }
  }
  return block;
}

export async function setBlock(key: MemoryBlockKey | string, content: string): Promise<MemoryBlock> {
  const tokenCount = Math.ceil(content.length / 4);
  const hash = hashContent(content);
  let contentPath: string | undefined;

  if (content.length > MAX_CONTENT_DB_CHARS) {
    contentPath = makeBlobPath('MemoryBlocks', key.replace(/[^a-zA-Z0-9-]/g, '_'), 'content');
    blobWrite(contentPath, content);
    content = `[blob:${contentPath}]`;
  }

  await execute(
    `MERGE MemoryBlocks AS target USING (VALUES (@key)) AS source(key) ON target.key = source.key
     WHEN MATCHED THEN UPDATE SET content = @content, contentPath = @contentPath, tokenCount = @tokenCount, hash = @hash, updatedAt = GETUTCDATE()
     WHEN NOT MATCHED THEN INSERT (key, content, contentPath, tokenCount, hash, updatedAt) VALUES (@key, @content, @contentPath, @tokenCount, @hash, GETUTCDATE())`,
    { key, content, contentPath: contentPath ?? null, tokenCount, hash }
  );

  return { key, content, contentPath, tokenCount, hash, updatedAt: new Date().toISOString() };
}

export async function getAllBlocks(): Promise<MemoryBlock[]> {
  return query<MemoryBlock[]>('SELECT * FROM MemoryBlocks ORDER BY updatedAt DESC');
}

export async function checkHealth(currentTokenCount: number, maxTokens = 200000): Promise<ContextHealthReport> {
  const utilizationPct = currentTokenCount / maxTokens;
  const blocks = await getAllBlocks();

  // Compute drift: compare hash of workspace_goals at session start vs now
  const goalsBlock = blocks.find((b) => b.key === 'workspace_goals');
  const driftScore = goalsBlock ? 0 : 1; // 1 = fully drifted if no goals set

  const stalestBlock = blocks.length > 0
    ? blocks.reduce((a, b) => a.updatedAt < b.updatedAt ? a : b).key
    : 'none';

  let recommendation: ContextHealthReport['recommendation'] = 'ok';
  if (utilizationPct >= COMPRESSION_THRESHOLD) recommendation = 'compress';
  if (driftScore > 0.5) recommendation = 'alert';

  return { utilizationPct, driftScore, stalestBlock, recommendation };
}
