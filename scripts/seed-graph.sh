#!/usr/bin/env bash
# Seed Neo4j graph with initial repositories
# Usage: bash scripts/seed-graph.sh

set -euo pipefail

CONFIG="/c/pas/.secrets/mcp-config.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found. Create it first."
  exit 1
fi

NEO4J_URL=$(node -e "const c=require('$CONFIG'); console.log(c.neo4j.url)")
NEO4J_USER=$(node -e "const c=require('$CONFIG'); console.log(c.neo4j.user)")
NEO4J_PASS=$(node -e "const c=require('$CONFIG'); console.log(c.neo4j.password)")

cypher_shell() {
  echo "$1" | cypher-shell -a "$NEO4J_URL" -u "$NEO4J_USER" -p "$NEO4J_PASS" 2>/dev/null \
    || echo "[WARN] cypher-shell not found. Run this Cypher manually in Neo4j Browser:"$'\n'"$1"
}

echo "[Neo4j] Creating constraints and indexes..."

cypher_shell "CREATE CONSTRAINT repo_id IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE;"
cypher_shell "CREATE CONSTRAINT file_id IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE;"
cypher_shell "CREATE CONSTRAINT symbol_id IF NOT EXISTS FOR (s:Symbol) REQUIRE s.id IS UNIQUE;"
cypher_shell "CREATE CONSTRAINT doc_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;"
cypher_shell "CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE;"

echo "[Neo4j] Seeding repositories..."

cypher_shell "MERGE (r:Repository {id: 'pas-blazor-ai'}) SET r.path = 'C:/pas/repos/kroleigh6633/pas-blazor-ai', r.url = 'https://github.com/Kroleigh6633/pas-blazor-ai', r.indexedAt = datetime();"
cypher_shell "MERGE (r:Repository {id: 'ai-companion'}) SET r.path = 'C:/pas/repos/kroleigh6633/ai-companion', r.url = 'https://github.com/Kroleigh6633/ai-companion', r.indexedAt = datetime();"

echo "[Neo4j] Seeding ai-companion server nodes..."

for server in mcp-shell fragment-server task-server graph-server embeddings-server context-server reflection-server; do
  cypher_shell "
    MATCH (r:Repository {id: 'ai-companion'})
    MERGE (f:File {id: 'ai-companion/src/$server'})
    SET f.type = 'server-package', f.name = '$server'
    MERGE (r)-[:CONTAINS]->(f)
  "
done

echo "[Neo4j] Graph seed complete."
echo "Open Neo4j Browser at http://localhost:7474 to explore."
