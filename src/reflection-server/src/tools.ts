import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Rubric, FeedbackTrend } from '@ai-companion/types';
import { execute, query, createLogger } from '@ai-companion/utils';
import { BUILT_IN_RUBRICS } from './built-in-rubrics.js';
import { scoreOutput } from './scorer.js';

const log = createLogger('reflection-server');

let _rubricCache: Rubric[] | null = null;

async function getRubrics(): Promise<Rubric[]> {
  if (_rubricCache) return _rubricCache;
  try {
    const dbRubrics = await query<Rubric[]>('SELECT * FROM Rubrics');
    _rubricCache = dbRubrics.length > 0 ? dbRubrics : BUILT_IN_RUBRICS;
  } catch {
    _rubricCache = BUILT_IN_RUBRICS;
  }
  return _rubricCache;
}

async function scoreOutputTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const { rubricId, measurements, taskId, agentRunId, notes } = args as {
    rubricId: string;
    measurements: Record<string, number>;
    taskId?: number;
    agentRunId?: string;
    notes?: string;
  };

  const rubrics = await getRubrics();
  const rubric = rubrics.find((r) => r.id === rubricId);
  if (!rubric) {
    return { content: [{ type: 'text', text: `Rubric not found: ${rubricId}` }], isError: true };
  }

  const result = scoreOutput({ rubric, measurements, taskId, agentRunId, notes });

  await execute(
    `INSERT INTO RubricScores (id, rubricId, taskId, agentRunId, score, criteriaScores, notes, createdAt)
     VALUES (@id, @rubricId, @taskId, @agentRunId, @score, @criteriaScores, @notes, GETUTCDATE())`,
    {
      id: result.id,
      rubricId: result.rubricId,
      taskId: result.taskId ?? null,
      agentRunId: result.agentRunId ?? null,
      score: result.score,
      criteriaScores: JSON.stringify(result.criteriaScores),
      notes: result.notes,
    }
  );

  log.info(`Scored output`, { rubricId, score: result.score.toFixed(3) });
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

async function getRubric(args: Record<string, unknown>): Promise<CallToolResult> {
  const { id } = args as { id: string };
  const rubrics = await getRubrics();
  const rubric = rubrics.find((r) => r.id === id);
  if (!rubric) {
    return { content: [{ type: 'text', text: `Rubric not found: ${id}` }], isError: true };
  }
  return { content: [{ type: 'text', text: JSON.stringify(rubric) }] };
}

async function addRubric(args: Record<string, unknown>): Promise<CallToolResult> {
  const rubric = args as Rubric;
  rubric.createdAt = new Date().toISOString();

  await execute(
    `INSERT INTO Rubrics (id, name, description, criteria, createdAt)
     VALUES (@id, @name, @description, @criteria, GETUTCDATE())`,
    { id: rubric.id, name: rubric.name, description: rubric.description, criteria: JSON.stringify(rubric.criteria) }
  );

  _rubricCache = null;
  log.info(`Added rubric: ${rubric.id}`);
  return { content: [{ type: 'text', text: JSON.stringify(rubric) }] };
}

async function getFeedbackTrends(args: Record<string, unknown>): Promise<CallToolResult> {
  const { rubricId, days = 30 } = args as { rubricId?: string; days?: number };
  const filter = rubricId ? 'WHERE rubricId = @rubricId AND' : 'WHERE';
  const rows = await query<{ rubricId: string; avgScore: number; count: number }>(
    `SELECT rubricId, AVG(score) AS avgScore, COUNT(*) AS count
     FROM RubricScores
     ${filter} createdAt >= DATEADD(day, -@days, GETUTCDATE())
     GROUP BY rubricId`,
    { days, ...(rubricId ? { rubricId } : {}) }
  );

  const trends: FeedbackTrend[] = rows.map((r) => ({
    rubricId: r.rubricId,
    averageScore: r.avgScore,
    trend: r.avgScore >= 0.8 ? 'improving' : r.avgScore >= 0.6 ? 'stable' : 'degrading',
    dataPoints: r.count,
    since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
  }));

  return { content: [{ type: 'text', text: JSON.stringify(trends) }] };
}

async function suggestImprovements(args: Record<string, unknown>): Promise<CallToolResult> {
  const { rubricId } = args as { rubricId: string };
  const rows = await query<{ criteriaScores: string }>(
    `SELECT TOP 10 criteriaScores FROM RubricScores WHERE rubricId = @rubricId ORDER BY createdAt DESC`,
    { rubricId }
  );

  const aggregated: Record<string, number[]> = {};
  for (const row of rows) {
    const scores = JSON.parse(row.criteriaScores) as Record<string, number>;
    for (const [k, v] of Object.entries(scores)) {
      if (!aggregated[k]) aggregated[k] = [];
      aggregated[k].push(v);
    }
  }

  const suggestions: Array<{ criterion: string; avgScore: number; suggestion: string }> = [];
  for (const [criterion, scores] of Object.entries(aggregated)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 0.7) {
      suggestions.push({
        criterion,
        avgScore: avg,
        suggestion: `"${criterion}" consistently scores below 70%. Review definition and threshold.`,
      });
    }
  }

  return { content: [{ type: 'text', text: JSON.stringify(suggestions) }] };
}

export const TOOLS: Tool[] = [
  {
    name: 'score_output',
    description: 'Score a task or agent output against a rubric',
    inputSchema: {
      type: 'object',
      properties: {
        rubricId: { type: 'string', description: 'Rubric ID to score against' },
        measurements: { type: 'object', description: 'Map of criterion ID -> measured value (0-1)' },
        taskId: { type: 'number' },
        agentRunId: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['rubricId', 'measurements'],
    },
  },
  {
    name: 'get_rubric',
    description: 'Get a rubric definition by ID',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'add_rubric',
    description: 'Register a new rubric',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              description: { type: 'string' },
              weight: { type: 'number' },
              threshold: { type: 'number' },
            },
          },
        },
      },
      required: ['id', 'name', 'description', 'criteria'],
    },
  },
  {
    name: 'get_feedback_trends',
    description: 'Get scoring trend data to understand quality over time',
    inputSchema: {
      type: 'object',
      properties: {
        rubricId: { type: 'string', description: 'Filter to specific rubric (optional)' },
        days: { type: 'number', description: 'Lookback window in days (default 30)', default: 30 },
      },
    },
  },
  {
    name: 'suggest_improvements',
    description: 'Analyze recent scores and suggest where to focus improvement',
    inputSchema: {
      type: 'object',
      properties: { rubricId: { type: 'string' } },
      required: ['rubricId'],
    },
  },
];

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> = {
  score_output: scoreOutputTool,
  get_rubric: getRubric,
  add_rubric: addRubric,
  get_feedback_trends: getFeedbackTrends,
  suggest_improvements: suggestImprovements,
};

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(args);
}
