# ADR-0005: Durable Message Queue

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

The MCP shell hosts an in-process EventEmitter for session-lifetime events (e.g., a document
is created → embeddings server embeds it immediately). But session-lifetime events are lost
when Claude Code closes. Background work that hasn't been processed yet — unembedded chunks,
pending graph re-indexes, unprocessed validation results — needs to survive session restarts.

Requirements:
- No Redis, no RabbitMQ, no additional infrastructure
- Works with existing file share (`\\MJHRGB01\file-system\`) and SQL Server
- Survives session restarts (durable)
- Configurable polling interval (not push-based)
- Simple enough to implement and operate

---

## Decision

**Two-tier event system:**

### Tier 1 — In-shell EventEmitter (fast path, session-lifetime)

```typescript
import { EventEmitter } from 'node:events';
export const bus = new EventEmitter();
```

Used for: immediate reactions within the same session (document created → embed now).
Lost on session end. That's acceptable — the slow path handles durability.

### Tier 2 — File-share queue (slow path, durable)

Events that need durability are written as files to the queue directory:

```
\\MJHRGB01\file-system\pas\queue\{event-type}\{id}.json
```

Each file is a JSON envelope:

```typescript
interface QueueMessage {
  id: string;           // UUID — also the filename
  event: string;        // 'document:created', 'task:ready', etc.
  payload: unknown;
  enqueuedAt: string;
  attempts: number;
  lastAttemptAt?: string;
}
```

**SQL row holds the pointer; file holds the payload** (consistent with ADR-0002):

```sql
CREATE TABLE MessageQueue (
  id          nvarchar(100) NOT NULL PRIMARY KEY,
  event       nvarchar(100) NOT NULL,
  payloadPath nvarchar(500) NOT NULL,  -- blob ref: pas/queue/{event}/{id}.json
  status      nvarchar(20)  NOT NULL DEFAULT 'pending',
  enqueuedAt  datetime2     NOT NULL DEFAULT GETUTCDATE(),
  attempts    int           NOT NULL DEFAULT 0,
  lastAttemptAt datetime2   NULL
);
CREATE INDEX IX_Queue_status_event ON MessageQueue(status, event);
```

**Poller**: the shell polls on a configurable interval (default 5s). On each tick:
1. `SELECT TOP 10 * FROM MessageQueue WHERE status = 'pending' ORDER BY enqueuedAt`
2. For each row: read payload from file share, emit on the in-process bus
3. On success: `UPDATE status = 'processed'`
4. On failure: `UPDATE attempts += 1, lastAttemptAt = NOW()`; retry up to 3 times, then `status = 'dead'`

### Why not SQL Server Service Broker?

Service Broker is built into SQL Server and provides reliable async messaging with
transactional delivery guarantees. It is a strong candidate for a future migration.
We start with the file-share pattern because:

1. Service Broker requires additional DDL (queues, services, contracts, message types)
2. Our existing infrastructure (file share + SQL pointer from ADR-0002) already handles
   this pattern well
3. The polling model is simpler to reason about and debug

**Migration path**: if polling latency or reliability becomes an issue, the `MessageQueue`
table schema maps cleanly to a Service Broker activation queue. The poller is replaced by
a Service Broker activation procedure.

### SQL Server 2025 consideration

SQL Server 2025 may introduce native vector + AI pipeline features. This section will be
updated when the production release is evaluated. The `MessageQueue` table structure is
intentionally generic — event payloads in files, routing by `event` column — so any future
SQL-native queuing mechanism can replace the poller without changing the event schema.

---

## Implementation

- `src/mcp-shell/src/bus.ts` — EventEmitter singleton
- `src/mcp-shell/src/queue-store.ts` — enqueue / dequeue / ack against SQL + file share
- `src/mcp-shell/src/poller.ts` — configurable poll loop wired into shell startup

Servers emit durable events via:
```typescript
await enqueue('document:created', { id, typeId });
```

The poller fires:
```typescript
bus.emit('document:created', payload);
```

Handlers are registered by server modules exactly as for session-lifetime events:
```typescript
bus.on('document:created', async (payload) => { ... });
```

---

## Consequences

- **Good**: Durable events survive session restarts with no new infrastructure
- **Good**: Consistent with ADR-0002 (SQL pointer + file payload)
- **Good**: Observable: `MessageQueue` table shows queue depth, failures, dead letters
- **Good**: Clear migration path to Service Broker if needed
- **Neutral**: Polling adds ~5s latency for cross-session events (acceptable for background work)
- **Bad**: Polling under load could be noisy; tune interval and batch size if needed
