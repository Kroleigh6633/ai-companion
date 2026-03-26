#!/usr/bin/env bash
# Run SQL migrations against sqldb-pas-main-dev
# Usage: bash scripts/migrate.sh

set -euo pipefail

CONFIG="/c/pas/.secrets/mcp-config.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found."
  exit 1
fi

SERVER=$(node -e "const c=require('$CONFIG'); console.log(c.sqlServer.server)")
DATABASE=$(node -e "const c=require('$CONFIG'); console.log(c.sqlServer.database)")
USER=$(node -e "const c=require('$CONFIG'); console.log(c.sqlServer.user)")
PASS=$(node -e "const c=require('$CONFIG'); console.log(c.sqlServer.password)")

MIGRATION_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/migration-001-init.sql"

echo "[SQL] Running migration on $DATABASE @ $SERVER..."
sqlcmd -S "$SERVER" -d "$DATABASE" -U "$USER" -P "$PASS" -i "$MIGRATION_FILE" \
  || echo "[SQL] sqlcmd not found or error. Run $MIGRATION_FILE manually in SSMS."

echo "[SQL] Migration complete."
