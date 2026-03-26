# Pattern: Registering a Bus Event Handler in a Server Module

**Implements**: ADR-0005
**Type**: pattern

---

## When to Use

When a server module needs to react to events emitted on the MCP shell bus — either from session-lifetime emissions or from the durable queue poller.

---

## The Contract

A server module can export an optional `subscriptions` array alongside `tools`:

```typescript
import type { ApiModule } from '@ai-companion/types';
import { on } from '../../mcp-shell/src/bus.js'; // resolved at deploy time

const embeddingsServer: ApiModule = {
  name: 'embeddings-server',
  tools: TOOLS,
  subscriptions: [
    {
      event: 'document:created',
      handler: async ({ id, typeId }) => {
        await embedDocumentChunks(id);
      },
    },
    {
      event: 'document:chunked',
      handler: async ({ documentId, chunkCount }) => {
        logger.info(`${chunkCount} chunks ready for ${documentId}`);
      },
    },
  ],
  handleToolCall,
};

export default embeddingsServer;
```

---

## How the Loader Wires It

`loader.ts` checks for `subscriptions` when loading a module:

```typescript
// In loader.ts — called after module loads
if (mod.subscriptions) {
  for (const sub of mod.subscriptions) {
    on(sub.event, sub.handler);
  }
}

// On hot-reload: remove old listeners before registering new ones
bus.removeAllListeners(event); // per event, per module
```

---

## Emitting from a Tool Handler

```typescript
import { emit } from '../../../mcp-shell/src/bus.js';
import { enqueue } from '../queue-client.js'; // calls POST /queue on C# API

// Session-lifetime (fast, lost on restart):
emit('document:created', { id, typeId });

// Durable (survives restart, ~5s latency):
await enqueue('document:created', { id, typeId });
```

Use `emit` when the handler is guaranteed to be running in the same session.
Use `enqueue` when the work might outlast the session (embedding large documents, graph re-index).

---

## Typed Event Map

All event names and payload shapes are defined in `mcp-shell/src/bus.ts`:

```typescript
export type BusEventMap = {
  'document:created':  { id: string; typeId: string };
  'document:chunked':  { documentId: string; chunkCount: number };
  'task:ready':        { ghId: number };
  'task:completed':    { ghId: number; score?: number };
  'graph:reindex':     { filePath: string };
  'context:compress':  { sessionId: string };
};
```

To add a new event: update `BusEventMap` in `bus.ts`. The shell must be redeployed for the new type to be available. Individual handlers that use the new event can be deployed as normal server updates.

---

## Notes

- Handlers are async; errors are caught by `on()` and logged, they do not crash the shell
- `bus.setMaxListeners(50)` — raise if you add many handlers
- Hot-reload removes and re-registers listeners; do not hold stateful references inside handlers
