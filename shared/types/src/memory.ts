export type MemoryBlockKey =
  | 'workspace_goals'
  | 'active_task'
  | 'recent_decisions'
  | 'active_blockers'
  | 'knowledge_state';

export interface MemoryBlock {
  key: MemoryBlockKey | string;
  content: string;
  contentPath?: string;
  tokenCount: number;
  hash: string;
  updatedAt: string;
}

export interface ContextSnapshot {
  id: string;
  sessionId: string;
  blocks: MemoryBlock[];
  compressionRatio: number;
  contentPath: string;
  createdAt: string;
}

export interface CompressionLogEntry {
  id: string;
  snapshotId: string;
  retained: string[];
  discarded: string[];
  ratioAchieved: number;
  notes: string;
  createdAt: string;
}

export interface ContextHealthReport {
  utilizationPct: number;
  driftScore: number;
  stalestBlock: string;
  recommendation: 'ok' | 'compress' | 'alert';
}
