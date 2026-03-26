export type RubricId = 'code_quality' | 'task_decomposition' | 'document_quality' | 'context_health' | string;

export interface Rubric {
  id: RubricId;
  name: string;
  description: string;
  criteria: RubricCriterion[];
  createdAt: string;
}

export interface RubricCriterion {
  id: string;
  description: string;
  weight: number;
  threshold: number;
}

export interface RubricScore {
  id: string;
  rubricId: RubricId;
  taskId?: number;
  agentRunId?: string;
  score: number;
  criteriaScores: Record<string, number>;
  notes: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  taskId?: number;
  model: 'haiku' | 'sonnet' | 'opus';
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  score?: number;
  createdAt: string;
}

export interface FeedbackTrend {
  rubricId: RubricId;
  averageScore: number;
  trend: 'improving' | 'degrading' | 'stable';
  dataPoints: number;
  since: string;
}
