#!/usr/bin/env bash
# Deploy all servers to C:\pas\tools\
# Usage: bash scripts/deploy.sh [server-name]
# If server-name is omitted, deploys all servers.

set -euo pipefail

TOOLS_DIR="/c/pas/tools"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVERS=(mcp-shell fragment-server task-server graph-server embeddings-server context-server reflection-server)

deploy_server() {
  local name="$1"
  local src="$REPO_DIR/src/$name"

  if [[ ! -d "$src" ]]; then
    echo "[SKIP] $name — directory not found at $src"
    return
  fi

  echo "[BUILD] $name..."
  (cd "$src" && node build.mjs)

  local dest="$TOOLS_DIR/$name"
  mkdir -p "$dest"

  # Copy dist output
  if [[ -f "$src/dist/index.js" ]]; then
    cp "$src/dist/index.js" "$dest/index.js"
    [[ -f "$src/dist/index.js.map" ]] && cp "$src/dist/index.js.map" "$dest/index.js.map" || true
  elif [[ -f "$src/dist/shell.js" ]]; then
    cp "$src/dist/shell.js" "$dest/shell.js"
    [[ -f "$src/dist/shell.js.map" ]] && cp "$src/dist/shell.js.map" "$dest/shell.js.map" || true
  else
    echo "[WARN] No dist output found for $name"
    return
  fi

  echo "[OK] Deployed $name -> $dest"
}

TARGET="${1:-}"

if [[ -n "$TARGET" ]]; then
  deploy_server "$TARGET"
else
  for server in "${SERVERS[@]}"; do
    deploy_server "$server"
  done
fi

echo ""
echo "Deploy complete. Tools dir: $TOOLS_DIR"
