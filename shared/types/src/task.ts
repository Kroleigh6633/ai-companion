export type TaskType = 'epic' | 'feature' | 'bug' | 'chore' | 'blocker';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

export interface Task {
  ghId: number;
  type: TaskType;
  status: TaskStatus;
  title: string;
  body: string;
  confidence: number;
  targetFile?: string;
  decomposedFrom?: number;
  blockedBy: number[];
  dependsOn: number[];
  acceptanceCriteria: string[];
  testCriteria: string[];
  complexity?: number;
  risk?: number;
  assignedModel?: 'haiku' | 'sonnet' | 'opus';
  createdAt: string;
  updatedAt: string;
}

export interface DecompositionResult {
  parentId: number;
  children: Omit<Task, 'ghId'>[];
  confidence: number;
}

export interface AgentRoutingDecision {
  taskId: number;
  model: 'haiku' | 'sonnet' | 'opus';
  reason: string;
  complexity: number;
  risk: number;
}
