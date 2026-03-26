#!/usr/bin/env bash
# session-start hook: load memory blocks, surface blockers, verify mcp-shell is running

set -euo pipefail

log() { echo "[session-start] $*" >&2; }

TOOLS_DIR="/c/pas/tools"
SHELL_JS="$TOOLS_DIR/mcp-shell/shell.js"
CONFIG="/c/pas/.secrets/mcp-config.json"

# --- 1. Verify/start mcp-shell ---
if [[ ! -f "$SHELL_JS" ]]; then
  log "WARNING: mcp-shell not deployed. Run: bash /c/pas/repos/kroleigh6633/ai-companion/scripts/deploy.sh mcp-shell"
else
  log "mcp-shell deployed at $SHELL_JS"
fi

# --- 2. Load and surface memory blocks ---
if [[ -f "$CONFIG" ]]; then
  log "Loading memory blocks from sqldb-pas-main-dev..."

  node -e "
    const cfg = require('$CONFIG');
    const sql = require('mssql');
    sql.connect({
      server: cfg.sqlServer.server, database: cfg.sqlServer.database,
      user: cfg.sqlServer.user, password: cfg.sqlServer.password,
      options: { encrypt: false, trustServerCertificate: true }
    }).then(pool =>
      pool.request().query(\"SELECT key, content, tokenCount, updatedAt FROM MemoryBlocks ORDER BY key\")
    ).then(r => {
      const blocks = r.recordset;
      if (blocks.length === 0) {
        process.stderr.write('[session-start] No memory blocks found. Fresh session.\n');
      } else {
        process.stderr.write('[session-start] Memory blocks loaded:\n');
        blocks.forEach(b => {
          process.stderr.write('  ' + b.key + ' (' + b.tokenCount + ' tokens, updated: ' + b.updatedAt + ')\n');
        });
      }
    }).catch(err => {
      process.stderr.write('[session-start] Could not load memory blocks: ' + err.message + '\n');
    }).finally(() => process.exit(0));
  " 2>/dev/null || log "Could not connect to SQL. Continuing without memory blocks."

  # --- 3. Surface blocked tasks ---
  log "Checking for blocked tasks..."
  node -e "
    const cfg = require('$CONFIG');
    const sql = require('mssql');
    sql.connect({
      server: cfg.sqlServer.server, database: cfg.sqlServer.database,
      user: cfg.sqlServer.user, password: cfg.sqlServer.password,
      options: { encrypt: false, trustServerCertificate: true }
    }).then(pool =>
      pool.request().query(\"SELECT TOP 5 ghId, title, status FROM Tasks WHERE status IN ('blocked', 'in_progress') ORDER BY updatedAt DESC\")
    ).then(r => {
      const tasks = r.recordset;
      if (tasks.length > 0) {
        process.stderr.write('[session-start] Active/blocked tasks:\n');
        tasks.forEach(t => process.stderr.write('  #' + t.ghId + ' [' + t.status + '] ' + t.title + '\n'));
      }
    }).catch(() => {}).finally(() => process.exit(0));
  " 2>/dev/null || true
else
  log "WARNING: $CONFIG not found. Set up secrets before using MCP tools."
fi

log "Session ready."
exit 0
