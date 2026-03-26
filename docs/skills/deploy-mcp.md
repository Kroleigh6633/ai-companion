---
name: deploy-mcp
description: CD pipeline — pull latest, build TypeScript, build SQL dacpac, deploy schema, deploy dist to C:\pas\tools\
---

Run the full AI companion CD pipeline.

## What this does

1. `git pull origin main` — pulls latest from the ai-companion repo
2. `pnpm install` — installs/updates dependencies
3. Builds all TypeScript packages (shared/types, shared/utils, all servers)
4. Builds the SQL dacpac from `src/sqldb-ai-companion/`
5. Deploys the schema via `SqlPackage /Action:Publish` (idempotent diff-deploy)
6. Deploys TypeScript dist files to `C:\pas\tools\`

## Usage

```
/deploy-mcp
```

Options (append to the prompt):
- `--skip-sql` — skip SQL build and deploy (TypeScript only)
- `--skip-ts` — skip TypeScript build and deploy (SQL only)
- `--dry-run` — print what would run, execute nothing

## What I will do

Run this bash command:
```bash
bash /c/pas/repos/kroleigh6633/ai-companion/scripts/deploy-mcp.sh
```

## Prerequisites (first time only)

| Prerequisite | Install command |
|-------------|-----------------|
| .NET SDK 8+ | `winget install Microsoft.DotNet.SDK.8` |
| SqlPackage CLI | `dotnet tool install -g microsoft.sqlpackage` |
| SQL Server Developer Ed | Download from microsoft.com/sql-server |
| `mcp-config.json` | Copy `.secrets/mcp-config.json.example`, fill in passwords |

## Port registry

All services run on named ports (defined in `mcp-config.json`):

| Service | Port |
|---------|------|
| MCP shell | 8180 |
| Companion API (C# Kestrel) | 8181 |
| Companion API 2 (future) | 8182 |

## After first deploy

1. Restart Claude Code — the MCP shell on port 8180 will be picked up from `claude.json`
2. The shell starts, connects to Claude, and begins watching `C:\pas\tools\` for servers
3. Run `/deploy-mcp --skip-sql` on subsequent changes to TypeScript servers only
