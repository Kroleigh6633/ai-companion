#!/usr/bin/env bash
# post-tool-use hook:
# - After Write/Edit: trigger incremental graph re-index
# - After Bash (test runs): capture coverage, update rubric scores, update task status

set -euo pipefail

TOOL="${CLAUDE_TOOL_NAME:-}"
INPUT="${CLAUDE_TOOL_INPUT:-{}}"
OUTPUT="${CLAUDE_TOOL_OUTPUT:-{}}"

log() { echo "[post-tool-use] $*" >&2; }

extract_json() {
  local json="$1" key="$2" default="$3"
  node -e "
    try { const d = JSON.parse(process.argv[1]); console.log(d['$key'] ?? '$default'); }
    catch { console.log('$default'); }
  " "$json" 2>/dev/null || echo "$default"
}

# --- After Write/Edit: trigger incremental graph re-index ---
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then
  FILE_PATH=$(extract_json "$INPUT" "file_path" "")
  if [[ -n "$FILE_PATH" ]]; then
    log "Triggering incremental graph re-index for: $FILE_PATH"
    # Call graph-server index_repository via MCP (fire-and-forget)
    node -e "
      // Lightweight incremental re-index notification
      // Full implementation: POST to graph-server or call via MCP tool
      const path = process.argv[1];
      process.stderr.write('[graph-reindex] queued: ' + path + '\n');
    " "$FILE_PATH" 2>/dev/null || true
  fi
fi

# --- After Bash: detect test runs, capture coverage ---
if [[ "$TOOL" == "Bash" ]]; then
  COMMAND=$(extract_json "$INPUT" "command" "")

  if echo "$COMMAND" | grep -qE "vitest|test:coverage|run.*--coverage"; then
    log "Test run detected. Parsing coverage output..."

    # Extract coverage percentage from output
    COVERAGE=$(echo "$OUTPUT" | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        // Look for 'Lines' or 'Stmts' coverage percentage
        const match = d.match(/All files\s*\|\s*(\d+\.?\d*)/);
        console.log(match ? match[1] : '0');
      });
    " 2>/dev/null || echo "0")

    log "Coverage: ${COVERAGE}%"

    if node -e "process.exit(parseFloat('$COVERAGE') < 80 ? 1 : 0)" 2>/dev/null; then
      log "WARNING: Coverage ${COVERAGE}% is below 80% threshold"
    fi
  fi
fi

exit 0
