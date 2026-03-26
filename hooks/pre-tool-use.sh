#!/usr/bin/env bash
# pre-tool-use hook
# Enforces:
#   1. Confidence gate: active task must have confidence >= 0.95 before Write/Edit
#   2. Ollama validation gate: local model must confirm the task is atomic and unambiguous
#   3. Status gate: blocked tasks cannot write
# Logs Bash commands to stderr for audit.

set -euo pipefail

TOOL="${CLAUDE_TOOL_NAME:-}"
INPUT="${CLAUDE_TOOL_INPUT:-{}}"
CONFIG="/c/pas/.secrets/mcp-config.json"

log() { echo "[pre-tool-use] $*" >&2; }

# ── Bash: just log ────────────────────────────────────────────────────────────
if [[ "$TOOL" == "Bash" ]]; then
  CMD=$(node -e "try{const d=JSON.parse(process.argv[1]);console.log(d.command??'')}catch{console.log('')}" "$INPUT" 2>/dev/null || echo "")
  log "Bash: ${CMD:0:120}"
  exit 0
fi

# ── Only gate Write and Edit ──────────────────────────────────────────────────
[[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]] || exit 0

# ── Load config ───────────────────────────────────────────────────────────────
if [[ ! -f "$CONFIG" ]]; then
  log "No config at $CONFIG — skipping gates"
  exit 0
fi

API_BASE=$(node -e "const c=require('$CONFIG');console.log(c.apiServer?.baseUrl??'')" 2>/dev/null || echo "")
OLLAMA_URL=$(node -e "const c=require('$CONFIG');console.log(c.ollama?.baseUrl??'http://localhost:11434')" 2>/dev/null || echo "http://localhost:11434")

if [[ -z "$API_BASE" ]]; then
  log "No apiServer.baseUrl in config — skipping gates"
  exit 0
fi

# ── Fetch active task ─────────────────────────────────────────────────────────
ACTIVE_TASK=$(curl -sf "${API_BASE}/memory/active_task" 2>/dev/null || echo "{}")
TASK_BODY=$(echo "$ACTIVE_TASK" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const t=JSON.parse(d);console.log(t.content??'{}')}catch{console.log('{}')}})" 2>/dev/null || echo "{}")

# No active task → allow
TITLE=$(echo "$TASK_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const t=JSON.parse(d);console.log(t.title??'')}catch{console.log('')}})" 2>/dev/null || echo "")
if [[ -z "$TITLE" ]]; then
  log "No active task — allowing"
  exit 0
fi

# ── Gate 1: Confidence ────────────────────────────────────────────────────────
CONFIDENCE=$(echo "$TASK_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const t=JSON.parse(d);console.log(t.confidence??0)}catch{console.log(0)}})" 2>/dev/null || echo "0")
if node -e "process.exit(parseFloat('$CONFIDENCE')<0.95?1:0)" 2>/dev/null; then
  log "BLOCKED: Confidence $CONFIDENCE < 0.95 for task: $TITLE"
  log "Run: decompose_task to split further, then score_task_confidence"
  exit 1
fi

# ── Gate 2: Status ────────────────────────────────────────────────────────────
STATUS=$(echo "$TASK_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const t=JSON.parse(d);console.log(t.status??'open')}catch{console.log('open')}})" 2>/dev/null || echo "open")
if [[ "$STATUS" == "blocked" ]]; then
  log "BLOCKED: Task '$TITLE' is in 'blocked' status"
  exit 1
fi

# ── Gate 3: Ollama validation ─────────────────────────────────────────────────
BODY=$(echo "$TASK_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const t=JSON.parse(d);console.log(t.body??t.title??'')}catch{console.log('')}})" 2>/dev/null || echo "")

SYSTEM_PROMPT='You are a task validation assistant. Determine whether this software task is atomic and unambiguous enough for a junior developer to implement without asking questions. Respond ONLY with valid JSON: {"understood":bool,"canImplement":bool,"targetFile":string|null,"ambiguities":string[],"reason":string}'

OLLAMA_REQUEST=$(node -e "
const body = process.argv[1];
const system = process.argv[2];
console.log(JSON.stringify({
  model: 'llama3.2',
  prompt: body,
  system: system,
  stream: false,
  format: 'json'
}));
" "$BODY" "$SYSTEM_PROMPT" 2>/dev/null)

OLLAMA_RESPONSE=$(curl -sf \
  --connect-timeout 5 \
  --max-time 15 \
  -X POST "${OLLAMA_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d "$OLLAMA_REQUEST" 2>/dev/null || echo "")

if [[ -z "$OLLAMA_RESPONSE" ]]; then
  log "WARNING: Ollama unavailable — confidence gate passed, proceeding without LLM validation"
  exit 0
fi

VALIDATION=$(echo "$OLLAMA_RESPONSE" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try {
    const r = JSON.parse(d);
    const v = JSON.parse(r.response ?? '{}');
    console.log(JSON.stringify(v));
  } catch {
    console.log('{}');
  }
})" 2>/dev/null || echo "{}")

CAN_IMPLEMENT=$(echo "$VALIDATION" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const v=JSON.parse(d);console.log(v.canImplement===true?'true':'false')}catch{console.log('true')}})" 2>/dev/null || echo "true")
AMBIGUITIES=$(echo "$VALIDATION" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const v=JSON.parse(d);const a=v.ambiguities??[];console.log(a.length)}catch{console.log(0)}})" 2>/dev/null || echo "0")
REASON=$(echo "$VALIDATION" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const v=JSON.parse(d);console.log(v.reason??'')}catch{console.log('')}})" 2>/dev/null || echo "")

if [[ "$CAN_IMPLEMENT" != "true" ]] || [[ "$AMBIGUITIES" -gt 0 ]]; then
  log "BLOCKED: Ollama says task '$TITLE' is not ready to implement"
  log "Reason: $REASON"
  log "Ambiguities ($AMBIGUITIES): use decompose_task or clarify the task body"

  # Write ambiguities back to active_task so Claude can see them
  UPDATED_BODY=$(echo "$TASK_BODY" | node -e "
    const validation = $VALIDATION;
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try {
        const t = JSON.parse(d);
        t.ambiguities = validation.ambiguities ?? [];
        t.validationReason = validation.reason ?? '';
        console.log(JSON.stringify(t));
      } catch {
        console.log('{}');
      }
    })" 2>/dev/null || echo "")

  if [[ -n "$UPDATED_BODY" ]]; then
    curl -sf -X POST "${API_BASE}/memory/active_task" \
      -H "Content-Type: application/json" \
      -d "{\"content\":$(echo "$UPDATED_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(d)))" 2>/dev/null || echo '""')}" \
      >/dev/null 2>&1 || true
  fi

  exit 1
fi

log "ALLOWED: Task '$TITLE' validated by Ollama (confidence: $CONFIDENCE)"
exit 0
