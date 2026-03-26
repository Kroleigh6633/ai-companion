---
name: new-mcp-server
description: Scaffold a new MCP API server module in ai-companion following ADR-0003
---

Create a new API server module that integrates with the `mcp-shell` hot-reload architecture (ADR-0003).

## What I need from you

1. **name** — kebab-case server name (e.g., `notification-server`, `audit-server`)
2. **description** — one sentence: what domain does this server own?
3. **tools** — list of tool names + one-line descriptions (at least 1)

## What I will do

1. Create `src/{name}/` with:
   - `package.json` (workspace dep on `@ai-companion/types` and `@ai-companion/utils`)
   - `tsconfig.json` extending `../../tsconfig.base.json`
   - `build.mjs` using esbuild
   - `src/tools.ts` — tool definitions + handlers
   - `src/index.ts` — exports `ApiModule` default
   - `src/{name}.test.ts` — unit tests (≥80% coverage target)
   - `vitest.config.ts`
2. Add the server to `pnpm-workspace.yaml` (already covers `src/*`)
3. Add the server name to `scripts/deploy.sh` SERVERS array
4. Add a `MERGE` node in `scripts/seed-graph.sh` for the new server package
5. Create a `docs/adr/ADR-{next}-{name}-design.md` documenting the server's purpose

## ApiModule contract

Every server must export:

```typescript
import type { ApiModule } from '@ai-companion/mcp-shell';

const myServer: ApiModule = {
  name: '{name}',        // matches directory name
  tools: TOOLS,
  handleToolCall,
};

export default myServer;
```

## Prompts used

```
/new-mcp-server name=notification-server description="Sends alerts via email and Slack" tools="send_alert,list_channels"
```
