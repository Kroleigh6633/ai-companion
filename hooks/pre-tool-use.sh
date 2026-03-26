#!/usr/bin/env bash
# pre-tool-use hook: enforces confidence gates and logs Bash commands
# Claude Code passes tool info via environment variables:
#   CLAUDE_TOOL_NAME, CLAUDE_TOOL_INPUT (JSON)

set -euo pipefail

TOOL="${CLAUDE_TOOL_NAME:-}"
INPUT="${CLAUDE_TOOL_INPUT:-{}}"

log() { echo "[pre-tool-use] $*" >&2; }

# --- Write/Edit: confidence + single-file gate ---
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then
  # Extract active task ghId from memory block if available
  MEMORY_BLOCK_DB="/c/pas/.secrets/mcp-config.json"

  if [[ -f "$MEMORY_BLOCK_DB" ]]; then
    ACTIVE_TASK=$(node -e "
      const cfg = require('$MEMORY_BLOCK_DB');
      const sql = require('mssql');
      sql.connect({ server: cfg.sqlServer.server, database: cfg.sqlServer.database,
                    user: cfg.sqlServer.user, password: cfg.sqlServer.password,
                    options: { encrypt: false, trustServerCertificate: true }})
        .then(pool => pool.request().query(\"SELECT content FROM MemoryBlocks WHERE key = 'active_task'\"))
        .then(r => { console.log(r.recordset[0]?.content ?? '{}'); process.exit(0); })
        .catch(() => { console.log('{}'); process.exit(0); });
    " 2>/dev/null || echo '{}')

    CONFIDENCE=$(echo "$ACTIVE_TASK" | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        try { const t = JSON.parse(d); console.log(t.confidence ?? 1); }
        catch { console.log(1); }
      });
    " 2>/dev/null || echo "1")

    if node -e "process.exit(parseFloat('$CONFIDENCE') < 0.95 ? 1 : 0)" 2>/dev/null; then
      log "BLOCKED: Task confidence $CONFIDENCE < 0.95. Decompose task before writing files."
      exit 1
    fi

    STATUS=$(echo "$ACTIVE_TASK" | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        try { const t = JSON.parse(d); console.log(t.status ?? 'open'); }
        catch { console.log('open'); }
      });
    " 2>/dev/null || echo "open")

    if [[ "$STATUS" == "blocked" ]]; then
      log "BLOCKED: Active task status is 'blocked'. Resolve blockers first."
      exit 1
    fi
  fi

  log "Write/Edit allowed for $TOOL"
fi

# --- Bash: log to stderr (SQL logging deferred to post-hook) ---
if [[ "$TOOL" == "Bash" ]]; then
  COMMAND=$(echo "$INPUT" | node -e "
    let d = ''; process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try { console.log(JSON.parse(d).command ?? ''); }
      catch { console.log(''); }
    });
  " 2>/dev/null || echo "")
  log "Bash command: ${COMMAND:0:120}"
fi

exit 0
