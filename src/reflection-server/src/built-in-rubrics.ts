import type { Rubric } from '@ai-companion/types';

export const BUILT_IN_RUBRICS: Rubric[] = [
  {
    id: 'code_quality',
    name: 'Code Quality',
    description: 'Evaluates test coverage, complexity, pattern adherence, and single-file rule',
    criteria: [
      { id: 'test_coverage', description: 'Test coverage >= 80%', weight: 0.35, threshold: 0.80 },
      { id: 'cyclomatic_complexity', description: 'Avg cyclomatic complexity < 10', weight: 0.20, threshold: 0.70 },
      { id: 'pattern_adherence', description: 'Follows documented patterns', weight: 0.25, threshold: 0.75 },
      { id: 'single_file_rule', description: 'Task touches at most 1 file', weight: 0.20, threshold: 1.0 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task_decomposition',
    name: 'Task Decomposition Quality',
    description: 'Evaluates decomposition confidence, atomicity, and test criteria completeness',
    criteria: [
      { id: 'confidence_achieved', description: 'All children confidence >= 0.95', weight: 0.40, threshold: 0.95 },
      { id: 'atomicity', description: 'Each task targets <= 1 file', weight: 0.30, threshold: 1.0 },
      { id: 'test_criteria', description: 'All tasks have test criteria', weight: 0.30, threshold: 1.0 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'document_quality',
    name: 'Document Quality',
    description: 'Evaluates template completeness, chunk coherence, and embedding variance',
    criteria: [
      { id: 'template_completeness', description: 'All required sections present', weight: 0.40, threshold: 0.90 },
      { id: 'chunk_coherence', description: 'Each chunk is self-contained and meaningful', weight: 0.35, threshold: 0.75 },
      { id: 'embedding_variance', description: 'Chunks have high embedding variance (not redundant)', weight: 0.25, threshold: 0.60 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'context_health',
    name: 'Context Health',
    description: 'Evaluates context drift, compression accuracy, and memory block freshness',
    criteria: [
      { id: 'drift_score', description: 'Goal block drift score < 0.3', weight: 0.35, threshold: 0.70 },
      { id: 'compression_accuracy', description: 'Compression retains critical context', weight: 0.35, threshold: 0.80 },
      { id: 'memory_freshness', description: 'All memory blocks updated in last 24h', weight: 0.30, threshold: 0.75 },
    ],
    createdAt: new Date().toISOString(),
  },
];
