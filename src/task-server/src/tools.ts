import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Task } from '@ai-companion/types';
import { execute, query, getConfig, createLogger } from '@ai-companion/utils';
import { scoreConfidence, routeToModel } from './confidence.js';
import { decompose } from './decomposer.js';

const log = createLogger('task-server');

async function getTasks(args: Record<string, unknown>): Promise<CallToolResult> {
  const { status, type, limit = 20 } = args as { status?: string; type?: string; limit?: number };
  const conditions: string[] = [];
  const params: Record<string, unknown> = { limit };
  if (status) { conditions.push('status = @status'); params['status'] = status; }
  if (type) { conditions.push('type = @type'); params['type'] = type; }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query<Task[]>(`SELECT TOP (@limit) * FROM Tasks ${where} ORDER BY updatedAt DESC`, params);
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

async function createTask(args: Record<string, unknown>): Promise<CallToolResult> {
  const task = args as Partial<Task> & { title: string; body: string };
  const cfg = getConfig();

  // Create GitHub issue
  const ghRes = await fetch(`https://api.github.com/repos/Kroleigh6633/pas-blazor-ai/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${cfg.github.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: task.title, body: task.body, labels: [task.type ?? 'chore'] }),
  });

  if (!ghRes.ok) {
    const err = await ghRes.text();
    return { content: [{ type: 'text', text: `GitHub API error: ${err}` }], isError: true };
  }

  const ghIssue = await ghRes.json() as { number: number };

  await execute(
    `INSERT INTO Tasks (ghId, type, status, title, body, confidence, blockedBy, dependsOn, acceptanceCriteria, testCriteria, createdAt, updatedAt)
     VALUES (@ghId, @type, 'open', @title, @body, @confidence, '[]', '[]', @acceptanceCriteria, @testCriteria, GETUTCDATE(), GETUTCDATE())`,
    {
      ghId: ghIssue.number,
      type: task.type ?? 'chore',
      title: task.title,
      body: task.body,
      confidence: task.confidence ?? 0,
      acceptanceCriteria: JSON.stringify(task.acceptanceCriteria ?? []),
      testCriteria: JSON.stringify(task.testCriteria ?? []),
    }
  );

  log.info(`Created task #${ghIssue.number}: ${task.title}`);
  return { content: [{ type: 'text', text: JSON.stringify({ ghId: ghIssue.number, ...task }) }] };
}

async function decomposeTask(args: Record<string, unknown>): Promise<CallToolResult> {
  const { ghId } = args as { ghId: number };
  const rows = await query<Task[]>('SELECT * FROM Tasks WHERE ghId = @ghId', { ghId });
  if (!rows.length) {
    return { content: [{ type: 'text', text: `Task #${ghId} not found` }], isError: true };
  }
  const task = rows[0];
  const result = decompose({ title: task.title, body: task.body, ghId: task.ghId });
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

async function scoreTask(args: Record<string, unknown>): Promise<CallToolResult> {
  const signals = args as Parameters<typeof scoreConfidence>[0];
  const result = scoreConfidence(signals);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

async function routeTask(args: Record<string, unknown>): Promise<CallToolResult> {
  const { complexity, risk, ghId } = args as { complexity: number; risk: number; ghId?: number };
  const model = routeToModel(complexity, risk);
  const result = { model, complexity, risk, ghId };
  if (ghId) {
    await execute('UPDATE Tasks SET assignedModel = @model WHERE ghId = @ghId', { model, ghId });
  }
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

async function updateTaskStatus(args: Record<string, unknown>): Promise<CallToolResult> {
  const { ghId, status } = args as { ghId: number; status: string };
  await execute('UPDATE Tasks SET status = @status, updatedAt = GETUTCDATE() WHERE ghId = @ghId', { ghId, status });
  log.info(`Task #${ghId} status -> ${status}`);
  return { content: [{ type: 'text', text: JSON.stringify({ ghId, status }) }] };
}

async function getDependencyChain(args: Record<string, unknown>): Promise<CallToolResult> {
  const { ghId } = args as { ghId: number };
  const rows = await query(
    `WITH deps AS (
      SELECT ghId, title, dependsOn, blockedBy, 0 as depth FROM Tasks WHERE ghId = @ghId
      UNION ALL
      SELECT t.ghId, t.title, t.dependsOn, t.blockedBy, d.depth + 1
      FROM Tasks t JOIN deps d ON JSON_VALUE(d.dependsOn, '$[0]') = CAST(t.ghId AS nvarchar(20))
      WHERE d.depth < 10
    )
    SELECT * FROM deps`,
    { ghId }
  );
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

export const TOOLS: Tool[] = [
  {
    name: 'get_tasks',
    description: 'List tasks, optionally filtered by status or type',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'in_progress', 'blocked', 'done'] },
        type: { type: 'string', enum: ['epic', 'feature', 'bug', 'chore', 'blocker'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task as a GitHub issue and mirror to local DB',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        type: { type: 'string', enum: ['epic', 'feature', 'bug', 'chore', 'blocker'] },
        acceptanceCriteria: { type: 'array', items: { type: 'string' } },
        testCriteria: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'decompose_task',
    description: 'Recursively decompose a task until all children have confidence >= 0.95',
    inputSchema: {
      type: 'object',
      properties: { ghId: { type: 'number', description: 'GitHub issue number' } },
      required: ['ghId'],
    },
  },
  {
    name: 'score_task_confidence',
    description: 'Score a task for confidence, complexity, and risk',
    inputSchema: {
      type: 'object',
      properties: {
        taskDescription: { type: 'string' },
        targetFile: { type: 'string' },
        blastRadiusDepth: { type: 'number' },
        callDepth: { type: 'number' },
        priorSimilarTaskScore: { type: 'number' },
        isAtomicChange: { type: 'boolean' },
      },
      required: ['taskDescription'],
    },
  },
  {
    name: 'route_task',
    description: 'Determine which AI model to use based on complexity and risk',
    inputSchema: {
      type: 'object',
      properties: {
        complexity: { type: 'number', description: '0-1 complexity score' },
        risk: { type: 'number', description: '0-1 risk score' },
        ghId: { type: 'number', description: 'Optional: update task record with routing decision' },
      },
      required: ['complexity', 'risk'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    inputSchema: {
      type: 'object',
      properties: {
        ghId: { type: 'number' },
        status: { type: 'string', enum: ['open', 'in_progress', 'blocked', 'done'] },
      },
      required: ['ghId', 'status'],
    },
  },
  {
    name: 'get_dependency_chain',
    description: 'Get the full dependency chain for a task',
    inputSchema: {
      type: 'object',
      properties: { ghId: { type: 'number' } },
      required: ['ghId'],
    },
  },
];

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> = {
  get_tasks: getTasks,
  create_task: createTask,
  decompose_task: decomposeTask,
  score_task_confidence: scoreTask,
  route_task: routeTask,
  update_task_status: updateTaskStatus,
  get_dependency_chain: getDependencyChain,
};

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(args);
}
