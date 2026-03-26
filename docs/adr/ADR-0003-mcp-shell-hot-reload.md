# ADR-0003: MCP Shell Hot-Reload Architecture

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

Claude Code connects to a single MCP server endpoint. When server-side tool implementations
change, the naive approach requires restarting the entire Claude session to pick up new tools.
This breaks the development workflow during the teaching curriculum — learners and the AI
companion both need live tool changes without session interruption.

## Decision

A **thin MCP shell** (`mcp-shell`) acts as the single endpoint registered in Claude Code.
Behind it, **independent API server modules** are dynamically loaded and hot-reloaded.

```
Claude Code  ──MCP──►  mcp-shell (shell.js)
                           │
                    ┌──────┴───────────────────────┐
                    │  registry.ts                 │
                    │  ┌─────────────────────────┐ │
                    │  │ fragment-server/index.js │ │
                    │  │ task-server/index.js     │ │
                    │  │ graph-server/index.js    │ │
                    │  │ embeddings-server/...    │ │
                    │  │ context-server/...       │ │
                    │  │ reflection-server/...    │ │
                    │  └─────────────────────────┘ │
                    │  loader.ts (chokidar watch)  │
                    └──────────────────────────────┘
```

### Hot-Reload Mechanism

1. `loader.ts` uses **chokidar** to watch `C:\pas\tools\*/index.js`
2. On file change: cache-bust the module URL, `dynamic import()` the new version
3. Re-register in `registry.ts` under the same server name (overwrites old)
4. Send `notifications/tools/list_changed` to Claude via `server.notification()`
5. Claude re-fetches the tool list — no session restart needed

### Shell Restart Cases

`shell.js` itself only needs restarting if:
- The MCP protocol version changes
- `registry.ts` or `loader.ts` core logic changes
- Node.js version changes

### Module Contract

Each API server must export a default object matching `ApiModule`:

```typescript
interface ApiModule {
  name: string;
  tools: Tool[];
  handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
}
```

## Consequences

- **Good**: Server implementations can be iterated without Claude session restarts.
- **Good**: New servers are picked up automatically by dropping `index.js` in `C:\pas\tools\`.
- **Good**: Clear separation between MCP protocol (shell) and business logic (servers).
- **Neutral**: Dynamic imports require careful cache-busting (`?bust=timestamp`).
- **Bad**: Module-level state in a server is lost on hot-reload — servers must be stateless
  or persist state externally (SQL/Neo4j).

## Implementation

See `/skill: new-mcp-server` — scaffolds a new server module with correct `ApiModule` shape.

---

*This ADR is stored in the fragment-server as document type `adr`, ID `ADR-0003`.*
