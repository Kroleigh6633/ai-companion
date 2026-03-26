#!/usr/bin/env bash
# /deploy-mcp — CD pipeline for the AI companion platform
#
# Sequence:
#   1. Pull latest from main
#   2. Install dependencies
#   3. Build TypeScript packages
#   4. Build SQL dacpac
#   5. Deploy dacpac via SqlPackage
#   6. Deploy TypeScript dist to C:\pas\tools\
#
# Usage:
#   bash scripts/deploy-mcp.sh [--skip-sql] [--skip-ts] [--dry-run]
#
# Environment / config:
#   CONFIG_PATH  → C:/pas/.secrets/mcp-config.json (default)
#   ENVIRONMENT  → dev (default), staging, prod

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${CONFIG_PATH:-/c/pas/.secrets/mcp-config.json}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
SKIP_SQL=false
SKIP_TS=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-sql) SKIP_SQL=true ;;
    --skip-ts)  SKIP_TS=true ;;
    --dry-run)  DRY_RUN=true ;;
  esac
done

log()  { echo "[deploy-mcp] $*"; }
step() { echo ""; echo "══════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════"; }
die()  { echo "[deploy-mcp] ERROR: $*" >&2; exit 1; }

# ── Load config ───────────────────────────────────────────────────────────────
[[ -f "$CONFIG_PATH" ]] || die "Config not found: $CONFIG_PATH. Copy .secrets/mcp-config.json.example → mcp-config.json and fill in values."

SQL_SERVER=$(node -e "const c=require('$CONFIG_PATH');console.log(c.sqlServer?.server??'localhost')" 2>/dev/null || echo "localhost")
SQL_USER=$(node -e "const c=require('$CONFIG_PATH');console.log(c.sqlServer?.user??'sa')" 2>/dev/null || echo "sa")
SQL_PASS=$(node -e "const c=require('$CONFIG_PATH');console.log(c.sqlServer?.password??'')" 2>/dev/null || echo "")
DB_NAME="sqldb-pas-main-${ENVIRONMENT}"

# ── Step 1: Pull ──────────────────────────────────────────────────────────────
step "1/6  Pull latest from main"
if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] git pull origin main"
else
  git -C "$REPO_DIR" pull origin main 2>&1 | tail -3
fi

# ── Step 2: Install ───────────────────────────────────────────────────────────
step "2/6  Install dependencies"
if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] pnpm install"
else
  pnpm --dir "$REPO_DIR" install 2>&1 | tail -5
fi

# ── Step 3: Build TypeScript ──────────────────────────────────────────────────
if [[ "$SKIP_TS" == "true" ]]; then
  log "Skipping TypeScript build"
else
  step "3/6  Build TypeScript packages"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] pnpm -r build"
  else
    (cd "$REPO_DIR/shared/types" && node build.mjs) && log "  ✓ @ai-companion/types"
    (cd "$REPO_DIR/shared/utils" && node build.mjs) && log "  ✓ @ai-companion/utils"
    for server in mcp-shell fragment-server task-server graph-server embeddings-server context-server reflection-server; do
      src="$REPO_DIR/src/$server"
      [[ -d "$src" ]] && (cd "$src" && node build.mjs) && log "  ✓ $server" || log "  – $server (skipped, no directory)"
    done
  fi
fi

# ── Step 4: Build SQL dacpac ──────────────────────────────────────────────────
DACPAC="$REPO_DIR/src/sqldb-ai-companion/bin/Debug/netstandard2.0/sqldb-ai-companion.dacpac"

if [[ "$SKIP_SQL" == "true" ]]; then
  log "Skipping SQL build"
else
  step "4/6  Build SQL dacpac"
  if ! command -v dotnet &>/dev/null; then
    log "WARNING: dotnet not found — skipping SQL build. Install .NET SDK 8+."
    SKIP_SQL=true
  else
    if [[ "$DRY_RUN" == "true" ]]; then
      log "[dry-run] dotnet build src/sqldb-ai-companion/"
    else
      dotnet build "$REPO_DIR/src/sqldb-ai-companion/" --configuration Debug 2>&1 | tail -5
      log "  ✓ dacpac built: $DACPAC"
    fi
  fi
fi

# ── Step 5: Deploy SQL ────────────────────────────────────────────────────────
if [[ "$SKIP_SQL" == "true" ]]; then
  log "Skipping SQL deploy"
else
  step "5/6  Deploy SQL schema ($DB_NAME @ $SQL_SERVER)"
  if ! command -v sqlpackage &>/dev/null; then
    log "WARNING: sqlpackage not found — skipping SQL deploy."
    log "Install: dotnet tool install -g microsoft.sqlpackage"
  else
    SQLPACKAGE_ARGS=(
      "/Action:Publish"
      "/SourceFile:$DACPAC"
      "/TargetServerName:$SQL_SERVER"
      "/TargetDatabaseName:$DB_NAME"
      "/TargetTrustServerCertificate:True"
      "/p:BlockOnPossibleDataLoss=True"
    )
    [[ -n "$SQL_USER" ]] && SQLPACKAGE_ARGS+=("/TargetUser:$SQL_USER")
    [[ -n "$SQL_PASS" ]] && SQLPACKAGE_ARGS+=("/TargetPassword:$SQL_PASS")

    if [[ "$DRY_RUN" == "true" ]]; then
      log "[dry-run] sqlpackage ${SQLPACKAGE_ARGS[*]}"
    else
      sqlpackage "${SQLPACKAGE_ARGS[@]}" 2>&1 | tail -10
      log "  ✓ SQL schema deployed to $DB_NAME"
    fi
  fi
fi

# ── Step 6: Deploy dist ───────────────────────────────────────────────────────
if [[ "$SKIP_TS" == "true" ]]; then
  log "Skipping dist deploy"
else
  step "6/6  Deploy dist to C:/pas/tools/"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] bash scripts/deploy.sh"
  else
    bash "$REPO_DIR/scripts/deploy.sh" 2>&1
  fi
fi

echo ""
step "Deploy complete"
log "Environment : $ENVIRONMENT"
log "Database    : $DB_NAME @ $SQL_SERVER"
log "Tools dir   : /c/pas/tools/"
log ""
log "If this is the first deploy:"
log "  1. Verify SQL Server is running"
log "  2. Verify Ollama is running: ollama list"
log "  3. Restart Claude Code to connect the MCP shell"
