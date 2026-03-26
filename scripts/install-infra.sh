#!/usr/bin/env bash
# Install infrastructure: SQL Server Dev Ed, Neo4j Community, Ollama + nomic-embed-text
# Run as Administrator on Windows 11.
# Usage: bash scripts/install-infra.sh [--skip-sql] [--skip-neo4j] [--skip-ollama]

set -euo pipefail

SKIP_SQL=false
SKIP_NEO4J=false
SKIP_OLLAMA=false

for arg in "$@"; do
  case $arg in
    --skip-sql) SKIP_SQL=true ;;
    --skip-neo4j) SKIP_NEO4J=true ;;
    --skip-ollama) SKIP_OLLAMA=true ;;
  esac
done

echo "=== AI Companion Infrastructure Setup ==="
echo "Platform: Windows 11"
echo ""

# --- SQL Server Developer Edition ---
if [[ "$SKIP_SQL" == "false" ]]; then
  echo "[SQL] Checking SQL Server..."
  if powershell.exe -Command "Get-Service -Name MSSQLSERVER -ErrorAction SilentlyContinue" 2>/dev/null | grep -q "Running"; then
    echo "[SQL] SQL Server already running."
  else
    echo "[SQL] Downloading SQL Server Developer Edition installer..."
    INSTALLER="/tmp/sql-server-dev.exe"
    curl -L "https://go.microsoft.com/fwlink/?linkid=853016" -o "$INSTALLER"
    echo "[SQL] Running SQL Server installer (GUI will open)..."
    powershell.exe -Command "Start-Process '$INSTALLER' -ArgumentList '/ACTION=Install /FEATURES=SQLEngine /INSTANCENAME=MSSQLSERVER /SQLSYSADMINACCOUNTS=BUILTIN\\Administrators /TCPENABLED=1 /NPENABLED=0 /IACCEPTSQLSERVERLICENSETERMS /QUIET' -Wait -Verb RunAs" || {
      echo "[SQL] Silent install failed. Launching GUI installer..."
      powershell.exe -Command "Start-Process '$INSTALLER' -Verb RunAs"
      echo "[SQL] Complete the GUI installer, then re-run this script."
      exit 1
    }
  fi

  echo "[SQL] Creating database sqldb-pas-main-dev..."
  sqlcmd -S localhost -Q "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'sqldb-pas-main-dev') CREATE DATABASE [sqldb-pas-main-dev]" 2>/dev/null \
    || echo "[SQL] Could not auto-create DB. Run manually: CREATE DATABASE [sqldb-pas-main-dev]"
fi

# --- Neo4j Community ---
if [[ "$SKIP_NEO4J" == "false" ]]; then
  echo "[Neo4j] Checking Neo4j..."
  if powershell.exe -Command "Get-Service -Name neo4j -ErrorAction SilentlyContinue" 2>/dev/null | grep -q "Running"; then
    echo "[Neo4j] Neo4j already running."
  else
    echo "[Neo4j] Download Neo4j Community from: https://neo4j.com/download-center/"
    echo "[Neo4j] Install as Windows service, then start with: neo4j.bat install-service && net start neo4j"
    echo "[Neo4j] Default: bolt://localhost:7687, user: neo4j, set password in .secrets/mcp-config.json"
    echo ""
    echo "[Neo4j] After install, run the seed script: bash scripts/seed-graph.sh"
  fi
fi

# --- Ollama ---
if [[ "$SKIP_OLLAMA" == "false" ]]; then
  echo "[Ollama] Checking Ollama..."
  if command -v ollama &>/dev/null; then
    echo "[Ollama] Ollama already installed."
  else
    echo "[Ollama] Downloading Ollama for Windows..."
    OLLAMA_INSTALLER="/tmp/ollama-setup.exe"
    curl -L "https://ollama.ai/download/windows" -o "$OLLAMA_INSTALLER"
    powershell.exe -Command "Start-Process '$OLLAMA_INSTALLER' -Wait -Verb RunAs"
  fi

  echo "[Ollama] Pulling nomic-embed-text model..."
  ollama pull nomic-embed-text || echo "[Ollama] Pull failed. Run manually: ollama pull nomic-embed-text"
  echo "[Ollama] Model ready: nomic-embed-text (768d, 8192 token context)"
fi

echo ""
echo "=== Infrastructure setup complete ==="
echo ""
echo "Next steps:"
echo "1. Update C:\\pas\\.secrets\\mcp-config.json with passwords"
echo "2. Run: bash scripts/migrate.sh  (creates DB schema)"
echo "3. Run: bash scripts/seed-graph.sh  (seeds Neo4j)"
echo "4. Run: bash scripts/deploy.sh  (deploys all servers)"
