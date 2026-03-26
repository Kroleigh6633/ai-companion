# ADR-0005: Durable Message Queue

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

The MCP shell hosts an in-process EventEmitter for session-lifetime events (fast path).
Events that need to survive session restarts — unembedded chunks, pending re-indexes,
unprocessed validation results — require a durable queue.

Requirements:
- No Redis, no RabbitMQ, no additional infrastructure
- Survives session restarts
- Configurable polling interval
- Simple to operate

---

## Decision

**Two-tier event system:**

### Tier 1 — In-shell EventEmitter (fast path, session-lifetime)

```typescript
import { EventEmitter } from 'node:events';
export const bus = new EventEmitter();
```

Immediate reactions within the same session. Lost on session end — that's acceptable,
the slow path handles anything that must survive.

### Tier 2 — SQL Server Service Broker (slow path, durable)

Service Broker is built into SQL Server (no additional infrastructure). It provides
transactional, ordered, at-least-once delivery backed by the same database we already use.

**SQL Server 2025 improvements make this the right choice:**

| Feature | Benefit |
|---------|---------|
| `message_enqueue_time` column | Built-in queue depth and latency monitoring |
| `POISON_MESSAGE_HANDLING (STATUS = ON)` | Automatic dead-lettering after repeated failures — no custom retry counter needed |

### Architecture

```
TypeScript shell
  │
  ├─ poller (every 5s)  →  GET /queue/pending  →  C# Kestrel API
  │                                                     │
  └─ enqueue event      →  POST /queue          →  Service Broker SEND
                                                     │
                                              SQL Server 2025
                                          MessageQueue (Service Broker)
                                                     │
                                         RECEIVE → C# processes, returns pending list
```

The TypeScript shell knows nothing about Service Broker. It calls two C# endpoints:
- `GET /queue/pending?limit=10` — C# does `RECEIVE TOP(10) FROM MessageQueue`
- `POST /queue/{id}/ack` — C# ends the conversation (commits dequeue)
- `POST /queue` — C# does `SEND ON CONVERSATION`

**All Service Broker DDL and logic lives in the C# API.** Hot-reloadable without
restarting the shell (ADR-0003 principle).

### Payload storage

Message envelopes are in Service Broker (transactional, small).
Large payloads follow ADR-0002: stored as files on the share, path in the message.

```sql
-- Message body (JSON, stored by Service Broker)
{
  "id": "uuid",
  "event": "document:created",
  "payloadPath": "pas/queue/document:created/{id}.json",  -- optional, for large payloads
  "payload": { ... },  -- inline for small payloads (< ~1KB)
  "enqueuedAt": "2026-03-26T..."
}
```

### Service Broker DDL (in C# migration)

```sql
CREATE MESSAGE TYPE [//pas/companion/Event] VALIDATION = NONE;
CREATE CONTRACT [//pas/companion/EventContract]
  ([//pas/companion/Event] SENT BY INITIATOR);

CREATE QUEUE CompanionEventQueue
  WITH POISON_MESSAGE_HANDLING (STATUS = ON);  -- SQL Server 2025

CREATE SERVICE [//pas/companion/EventService]
  ON QUEUE CompanionEventQueue ([//pas/companion/EventContract]);
```

### Monitoring

```sql
-- Queue depth and latency (SQL Server 2025)
SELECT message_type_name, message_enqueue_time,
       DATEDIFF(second, message_enqueue_time, GETUTCDATE()) AS age_seconds
FROM CompanionEventQueue WITH (NOLOCK);
```

---

## What was NOT chosen

| Option | Reason |
|--------|--------|
| Redis | External infrastructure, not on the machine |
| RabbitMQ | Same |
| File-share polling (original plan) | Service Broker is already in SQL Server 2025, transactional, and handles poison messages natively — file scanning is redundant |
| Change Event Streaming (CES, SQL 2025) | Publishes to Azure Event Hubs — external dependency, wrong direction |
| Service Broker INTERNAL ACTIVATION | Auto-starts T-SQL procedures, not useful for TypeScript/C# callers; the HTTP poll pattern is cleaner |

---

## Consequences

- **Good**: Zero new infrastructure — Service Broker is in the SQL Server we already use
- **Good**: Transactional — enqueue inside a C# transaction means message appears only if the write succeeds
- **Good**: Poison message handling built into SQL Server 2025 — no custom retry counter
- **Good**: `message_enqueue_time` gives free monitoring
- **Good**: Queue logic in C# API — hot-reloadable without shell restart
- **Neutral**: 5s polling latency for cross-session events (acceptable for background work)
- **Bad**: Service Broker requires upfront DDL — one migration, paid once
