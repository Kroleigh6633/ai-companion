---
name: new-mcp-event
description: Add a new typed event to the MCP shell bus and wire handlers in affected server modules
---

Register a new event in the bus and scaffold handler registrations in the relevant servers.

## What I need from you

1. **event** — kebab-case event name (e.g., `task:validated`, `chunk:embedded`)
2. **payload** — TypeScript shape of the event payload (field names and types)
3. **emitter** — which server emits this event
4. **handlers** — which servers subscribe (can be multiple)
5. **durable** — should this event survive session restarts? (`true` = use `enqueue`, `false` = use `emit`)

## What I will do

1. Add the event and payload type to `BusEventMap` in `src/mcp-shell/src/bus.ts`
2. In the emitting server's tool handler, add the `emit()` or `enqueue()` call at the right point
3. In each subscribing server's `index.ts`, add the `subscriptions` array entry with the handler
4. If durable: add an API endpoint stub to the C# API for `POST /queue` support
5. Add a test case to the emitting server's `.node.test.ts` file verifying the event is emitted
6. Update ADR-0005 appendix with the new event entry

## Shell redeploy required?

Adding a new event to `BusEventMap` in `bus.ts` requires rebuilding and redeploying `mcp-shell`.
The shell only needs redeploying when its own source files change (ADR-0003).
Adding a handler in a server module only requires redeploying that server.

## Prompts used

```
/new-mcp-event event=chunk:embedded payload="{ chunkId: string; documentId: string; vectorDimensions: number }" emitter=fragment-server handlers=embeddings-server durable=true
```
