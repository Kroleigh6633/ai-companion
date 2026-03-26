# ADR-0007: C# REST API as Data Layer

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

The TypeScript MCP servers need to read and write data: tasks, documents, chunks,
memory blocks, queue messages. The initial implementation used `mssql` — a Node.js
package for SQL Server. That package depends on the full Azure SDK (~63 packages,
~400MB of transitive dependencies).

During platform setup, this dependency caused:
- Test runner OOM: Vite/vitest scanned the Azure SDK dependency tree and exceeded 4GB heap
- Slow installs: 385 packages instead of ~320
- Wrong abstraction: a JavaScript package pretending to be a SQL Server client,
  when a real SQL Server client is Microsoft.Data.SqlClient in C#

---

## Decision

**All data access lives in a C# ASP.NET Core API hosted by Kestrel.**

TypeScript MCP servers are thin HTTP clients. They call the C# API via `apiGet`,
`apiPost`, `apiPatch`, `apiDelete` from `shared/utils/api-client.ts`.

```
TypeScript MCP server  →  HTTP  →  C# Kestrel API  →  SQL Server
                                         ↓
                                    File share (blobs)
                                         ↓
                                    Neo4j (graph)
```

### TypeScript side

`shared/utils/src/api-client.ts` — four functions, no SQL, no drivers:

```typescript
export async function apiGet<T>(path: string): Promise<T>
export async function apiPost<T>(path: string, body: unknown): Promise<T>
export async function apiPatch<T>(path: string, body: unknown): Promise<T>
export async function apiDelete(path: string): Promise<void>
```

Base URL: `config.apiServer.baseUrl` (default `http://localhost:5000`).

### C# side

- **Framework**: ASP.NET Core minimal API, hosted by Kestrel
- **SQL**: `Microsoft.Data.SqlClient` — the authoritative SQL Server client
- **ORM**: Dapper for lightweight query mapping (no EF Core overhead for this use case)
- **File share**: `System.IO` — native, no abstraction needed
- **Service Broker**: ADO.NET direct (RECEIVE/SEND)

### Endpoint convention

```
GET    /tasks                    → task list
POST   /tasks                    → create task
PATCH  /tasks/{ghId}/status      → update status
GET    /memory/{key}             → memory block
POST   /memory/{key}             → upsert memory block
GET    /documents/{id}           → document + content
POST   /documents                → create document
GET    /queue/pending?limit=10   → Service Broker RECEIVE
POST   /queue                    → Service Broker SEND
POST   /queue/{id}/ack           → END CONVERSATION
```

---

## Why not tedious (Node.js TDS driver)?

`tedious` is the underlying driver that `mssql` wraps. It avoids the Azure SDK but:
- Still the wrong layer: TDS protocol in JavaScript for a Microsoft database
- No connection pooling built-in without `@tediousjs/connection-pool`
- Weaker type safety than C# with SqlClient
- C# is already in the project (Blazor app in `src/`) — no new language

---

## Consequences

- **Good**: mssql and ~63 Azure SDK packages removed from the TypeScript monorepo
- **Good**: SQL Server has a first-class C# client — use the right tool for the right language
- **Good**: C# API is independently deployable and testable with standard .NET tooling
- **Good**: Service Broker, stored procedures, and SQL features are natural from C#
- **Good**: TypeScript servers have zero SQL knowledge — clean separation
- **Neutral**: One more process to run locally (Kestrel API alongside Neo4j, Ollama)
- **Bad**: API must be running for MCP tools to work — the `session-start.sh` hook
  verifies and starts it if not running
