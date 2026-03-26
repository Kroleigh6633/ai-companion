import type { Task, DecompositionResult } from '@ai-companion/types';
import { scoreConfidence } from './confidence.js';
import { createLogger } from '@ai-companion/utils';

const log = createLogger('decomposer');

export interface DecompositionInput {
  title: string;
  body: string;
  ghId: number;
}

function splitIntoAtomicTasks(input: DecompositionInput): Omit<Task, 'ghId'>[] {
  // Simple heuristic decomposition: split by acceptance criteria lines
  // In production, this would call an LLM. Here we produce a structured decomposition.
  const lines = input.body.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'));

  if (lines.length <= 1) {
    return [{
      type: 'chore',
      status: 'open',
      title: input.title,
      body: input.body,
      confidence: 0.95,
      blockedBy: [],
      dependsOn: [],
      acceptanceCriteria: [input.body],
      testCriteria: [`Test: ${input.title}`],
      decomposedFrom: input.ghId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }

  return lines.map((line, i) => ({
    type: 'chore' as const,
    status: 'open' as const,
    title: `${input.title} [${i + 1}/${lines.length}]: ${line.replace(/^[-*]\s*/, '').slice(0, 60)}`,
    body: line.replace(/^[-*]\s*/, ''),
    confidence: 0.95,
    blockedBy: [],
    dependsOn: i > 0 ? [] : [],
    acceptanceCriteria: [line.replace(/^[-*]\s*/, '')],
    testCriteria: [`Verify: ${line.replace(/^[-*]\s*/, '').slice(0, 40)}`],
    decomposedFrom: input.ghId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function decompose(input: DecompositionInput, maxDepth = 3): DecompositionResult {
  let children = splitIntoAtomicTasks(input);
  let depth = 0;

  // Recurse on any child that doesn't meet confidence threshold
  while (depth < maxDepth) {
    const needsFurtherDecomposition = children.filter((c) => c.confidence < 0.95);
    if (needsFurtherDecomposition.length === 0) break;

    const decomposed: Omit<Task, 'ghId'>[] = [];
    for (const child of children) {
      if (child.confidence < 0.95) {
        const subChildren = splitIntoAtomicTasks({
          title: child.title,
          body: child.body,
          ghId: input.ghId,
        });
        decomposed.push(...subChildren);
      } else {
        decomposed.push(child);
      }
    }
    children = decomposed;
    depth++;
  }

  const result = scoreConfidence({
    taskDescription: input.body,
    isAtomicChange: children.length <= 1,
  });

  log.info(`Decomposed task ${input.ghId} into ${children.length} children`, { confidence: result.score });

  return {
    parentId: input.ghId,
    children,
    confidence: result.score,
  };
}
