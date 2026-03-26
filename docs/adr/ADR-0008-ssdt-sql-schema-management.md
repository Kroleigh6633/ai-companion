# ADR-0008: SSDT SDK Project for SQL Schema Management

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

SQL schemas evolve. The initial approach used a hand-written `migration-001-init.sql`
run via `sqlcmd`. This works for the first deployment but breaks down as the schema
changes: there is no drift detection, no idempotency guarantee, and no way to preview
changes before applying them.

Enterprise SQL Server projects need:
- Declarative schema definition (define what you want, not what to run)
- Automated drift detection (compare current state to desired state)
- Preview before apply (generate change script without deploying)
- CI/CD pipeline integration
- Source-controlled schema as a first-class artifact

---

## Decision

**SQL schema is managed as an SSDT SDK-style project using `MSBuild.Sdk.SqlProj`.**

Project location: `ai-companion/src/sqldb-ai-companion/`
Project file: `sqldb-ai-companion.sqlproj`

### Why MSBuild.Sdk.SqlProj over Visual Studio SSDT

| | MSBuild.Sdk.SqlProj | VS SSDT (.sqlproj legacy) |
|--|--|--|
| Cross-platform build | ✓ (`dotnet build`) | ✗ (Windows + VS only) |
| CI/CD friendly | ✓ | Limited |
| Source format | Plain `.sql` files | Plain `.sql` files |
| Output | `.dacpac` | `.dacpac` |
| Deployment | `SqlPackage` | `SqlPackage` or VS |

Both produce a `.dacpac`. The difference is how you build it. SDK-style uses standard
`dotnet build` — the same pipeline used for the C# API.

### Deployment via SqlPackage

`SqlPackage /Action:Publish` compares the `.dacpac` (desired state) against the live
database (current state) and generates and executes only the necessary T-SQL changes.

```bash
SqlPackage \
  /Action:Publish \
  /SourceFile:bin/Debug/netstandard2.0/sqldb-ai-companion.dacpac \
  /TargetServerName:localhost \
  /TargetDatabaseName:sqldb-pas-main-dev \
  /TargetTrustServerCertificate:True
```

**It is safe to run on every deploy.** If nothing changed, nothing happens.
If a table was added, only that table is created. Existing data is preserved.

### Schema as source

Each database object has its own file:

```
src/sqldb-ai-companion/
  Tables/
    DocumentTypes.sql    ← CREATE TABLE statement only
    Documents.sql
    ...
  ServiceBroker/
    CompanionEventQueue.sql  ← Service Broker DDL
```

No `IF NOT EXISTS` wrappers. No migration version numbers. SSDT handles idempotency
by diffing the dacpac against the live schema.

### Naming convention

Project and database name follow ADR-0001: `sqldb-{area}-{environment}`.
The `.sqlproj` `<DatabaseName>` property is set to `sqldb-pas-main-dev` for development.
CI/CD parameterises the target database name per environment.

---

## Enterprise Pattern

This ADR applies beyond this project. For any SQL Server database in this workspace:

1. Create an SSDT SDK project at `src/sqldb-{name}/`
2. One `.sql` file per database object (table, view, procedure, function)
3. Build produces `.dacpac` via `dotnet build`
4. Deploy via `SqlPackage /Action:Publish` — idempotent, diff-based
5. Preview changes without deploying: `SqlPackage /Action:Script` (generates T-SQL script)
6. Validate only: `SqlPackage /Action:DeployReport` (XML report of planned changes)

### Environment parameterization

```bash
SqlPackage /Action:Publish \
  /SourceFile:app.dacpac \
  /TargetServerName:$SQL_SERVER \
  /TargetDatabaseName:sqldb-pas-main-$ENVIRONMENT \
  /TargetUser:$SQL_USER \
  /TargetPassword:$SQL_PASSWORD \
  /TargetTrustServerCertificate:True \
  /p:BlockOnPossibleDataLoss=True   # Safety: fail if deploy would drop data
```

`/p:BlockOnPossibleDataLoss=True` is the enterprise safety net — it prevents accidental
column drops or type changes that would lose data. Intentional breaking changes require
explicit `/p:BlockOnPossibleDataLoss=False`.

---

## Prerequisites

| Tool | Install |
|------|---------|
| .NET SDK 8+ | `winget install Microsoft.DotNet.SDK.8` |
| SqlPackage | `dotnet tool install -g microsoft.sqlpackage` |
| SQL Server Developer Ed | Download from microsoft.com |

---

## Consequences

- **Good**: Schema is source-controlled and reviewable in PRs
- **Good**: Idempotent deploys — safe to run on every merge to main
- **Good**: `SqlPackage /Action:Script` shows exactly what will run before it runs
- **Good**: `BlockOnPossibleDataLoss` prevents accidental data loss in production
- **Good**: Standard `dotnet build` produces the artifact — no special tooling
- **Good**: Applies to every SQL Server database in the workspace (enterprise pattern)
- **Neutral**: First-time setup requires .NET SDK and SqlPackage CLI
- **Bad**: Service Broker DDL (queues, services, contracts) has limited SSDT support —
  may need a post-deploy script for Service Broker objects
