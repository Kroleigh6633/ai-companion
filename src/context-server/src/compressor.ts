import type { ContextSnapshot, CompressionLogEntry } from '@ai-companion/types';
import { execute, blobWrite, makeBlobPath, createLogger } from '@ai-companion/utils';
import { getAllBlocks } from './memory-blocks.js';
import { randomUUID } from 'crypto';

const log = createLogger('compressor');

export async function compressContext(sessionId: string, targetRatio = 4): Promise<ContextSnapshot> {
  const blocks = await getAllBlocks();
  const snapshotId = randomUUID();

  const retained: string[] = [];
  const discarded: string[] = [];

  // Always retain the last 5-turn equivalent: workspace_goals, active_task, active_blockers
  const ALWAYS_RETAIN = new Set(['workspace_goals', 'active_task', 'active_blockers']);

  const compressedBlocks = blocks.map((block) => {
    if (ALWAYS_RETAIN.has(block.key)) {
      retained.push(block.key);
      return block;
    }

    // Compress by truncating to 1/targetRatio
    const maxLen = Math.floor(block.content.length / targetRatio);
    if (block.content.length > maxLen * 2) {
      discarded.push(block.key);
      return {
        ...block,
        content: block.content.slice(0, maxLen) + `\n[compressed: ${targetRatio}:1 ratio applied]`,
      };
    }
    retained.push(block.key);
    return block;
  });

  const snapshotContent = JSON.stringify(compressedBlocks);
  const contentPath = makeBlobPath('ContextSnapshots', snapshotId, 'content');
  blobWrite(contentPath, snapshotContent);

  const originalTokens = blocks.reduce((s, b) => s + b.tokenCount, 0);
  const compressedTokens = compressedBlocks.reduce((s, b) => s + Math.ceil(b.content.length / 4), 0);
  const ratioAchieved = originalTokens > 0 ? originalTokens / compressedTokens : 1;

  await execute(
    `INSERT INTO ContextSnapshots (id, sessionId, compressionRatio, contentPath, createdAt)
     VALUES (@id, @sessionId, @compressionRatio, @contentPath, GETUTCDATE())`,
    { id: snapshotId, sessionId, compressionRatio: ratioAchieved, contentPath }
  );

  const logEntry: CompressionLogEntry = {
    id: randomUUID(),
    snapshotId,
    retained,
    discarded,
    ratioAchieved,
    notes: `Session: ${sessionId}, target ratio: ${targetRatio}:1`,
    createdAt: new Date().toISOString(),
  };

  await execute(
    `INSERT INTO CompressionLog (id, snapshotId, retained, discarded, ratioAchieved, notes, createdAt)
     VALUES (@id, @snapshotId, @retained, @discarded, @ratioAchieved, @notes, GETUTCDATE())`,
    {
      id: logEntry.id,
      snapshotId,
      retained: JSON.stringify(retained),
      discarded: JSON.stringify(discarded),
      ratioAchieved,
      notes: logEntry.notes,
    }
  );

  log.info(`Compressed context`, { snapshotId, ratioAchieved: ratioAchieved.toFixed(2), discarded: discarded.length });

  return {
    id: snapshotId,
    sessionId,
    blocks: compressedBlocks,
    compressionRatio: ratioAchieved,
    contentPath,
    createdAt: new Date().toISOString(),
  };
}
