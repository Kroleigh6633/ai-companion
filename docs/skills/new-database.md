---
name: new-database
description: Scaffold a new SQL Server database following ADR-0001 naming convention
---

Create a new SQL Server database following the `sqldb-{area}-[{tenant}]-{environment}` convention from ADR-0001.

## What I need from you

1. **area** — project/company scope (e.g., `pas`, `crm`, `billing`)
2. **tenant** (optional) — multi-tenant discriminator (e.g., `tenant1`, `client-a`)
3. **environment** — `dev`, `staging`, or `prod`
4. **purpose** — one-sentence description of what this database is for

## What I will do

1. Construct the database name: `sqldb-{area}-[{tenant}-]{environment}`
2. Generate SQL to create the database with appropriate collation and settings
3. Create a baseline migration file at `scripts/migration-001-init.sql`
4. Add a connection string entry to `C:\pas\.secrets\mcp-config.json.example`
5. Update `shared/utils/sql-client.ts` if a new named connection is needed
6. Register the new database in the fragment-server as a document (type: `runbook`)
   documenting its purpose and schema decisions

## Output

- SQL: `CREATE DATABASE [sqldb-{name}]`
- Migration baseline: `scripts/migration-{area}-001-init.sql`
- Connection string template added to `.secrets/mcp-config.json.example`
- Runbook document created in fragment-server: "Setting up sqldb-{name}"

## Prompts used

```
/new-database area=pas environment=dev purpose="Main operational database for PAS workspace tooling"
```
