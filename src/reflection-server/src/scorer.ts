import type { Rubric, RubricScore } from '@ai-companion/types';
import { randomUUID } from 'crypto';

export interface ScoringInput {
  rubric: Rubric;
  measurements: Record<string, number>;
  taskId?: number;
  agentRunId?: string;
  notes?: string;
}

export function scoreOutput(input: ScoringInput): RubricScore {
  const { rubric, measurements } = input;

  const criteriaScores: Record<string, number> = {};
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const criterion of rubric.criteria) {
    const measured = measurements[criterion.id] ?? 0;
    const normalized = Math.min(1, measured / criterion.threshold);
    criteriaScores[criterion.id] = normalized;
    weightedTotal += normalized * criterion.weight;
    totalWeight += criterion.weight;
  }

  const score = totalWeight > 0 ? weightedTotal / totalWeight : 0;

  return {
    id: randomUUID(),
    rubricId: rubric.id,
    taskId: input.taskId,
    agentRunId: input.agentRunId,
    score,
    criteriaScores,
    notes: input.notes ?? '',
    createdAt: new Date().toISOString(),
  };
}
