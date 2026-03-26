# ADR-0006: Ollama Task Validation Gate

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

The confidence scoring in `task-server` produces a numeric score, but scores can be
gamed or ignored. The real question before generating any code is: **would a junior
developer, given only this task description, know exactly what one file to touch and
what to write?**

If the answer is no, the task is not ready. Code must not be generated until the task
passes this gate.

The constraint: **this must be mechanically enforced**. It cannot rely on Claude
"remembering" to call a validation tool. It cannot be advisory.

---

## Decision

The `pre-tool-use` hook calls a local Ollama model to validate the active task before
any `Write` or `Edit` tool call is allowed to proceed.

### Validation model

`llama3.2` (3B) or `mistral` (7B) — fast local inference, structured JSON output.
`nomic-embed-text` is NOT used here (embedding only, no reasoning).

### Validation prompt (system)

```
You are a task validation assistant. Your job is to determine whether a software task
is atomic and unambiguous enough for a junior developer to implement without asking questions.

Evaluate the task and respond ONLY with valid JSON matching this schema:
{
  "understood": boolean,        // do you understand what is being asked?
  "canImplement": boolean,      // would a junior dev know exactly what to do?
  "targetFile": string | null,  // the single file this task should touch, or null
  "ambiguities": string[],      // list of questions a junior dev would need to ask
  "reason": string              // one sentence explaining your decision
}
```

### Enforcement mechanism

`hooks/pre-tool-use.sh` — runs before every `Write` and `Edit` tool call:

1. Read `active_task` from `MemoryBlocks` SQL table
2. If no active task → allow (task-free editing is permitted)
3. POST to `http://localhost:11434/api/generate` with the validation prompt + task body
4. Parse JSON response
5. If `canImplement: false` or `ambiguities.length > 0`:
   - Write ambiguities back to `active_task` memory block
   - Exit with code 1 (blocks the tool call)
   - Claude sees the ambiguities and must resolve them before proceeding
6. If `canImplement: true` and `ambiguities` is empty → exit 0 (allow)

### Why a hook, not a tool

A tool is advisory — Claude can choose not to call it, or call it and ignore the result.
A hook is structural — no Write or Edit happens without passing through it, ever.
This is non-negotiable enforcement, not a recommendation.

### Failure modes

| Ollama unavailable | Allow (don't block on infrastructure failure) + log warning |
| JSON parse error   | Allow + log warning (model gave bad output) |
| Active task has confidence < 0.95 | Block regardless of Ollama response |

Allowing on infrastructure failure is intentional: the gate should stop ambiguous tasks,
not block all work when Ollama is down.

---

## Schema added to sqldb-pas-main-dev

```sql
-- Add to migration-002
ALTER TABLE MemoryBlocks ADD ambiguities nvarchar(2000) NULL; -- JSON string[]
```

---

## Example interaction

Task: "Update the login component"
→ Ollama returns: `{ canImplement: false, ambiguities: ["Which login component?", "What update — add field, fix bug, style change?"] }`
→ Hook blocks Write
→ Claude sees the ambiguities and decomposes the task further

Task: "Add `isAdmin` boolean field to `src/auth/User.cs` and update the DTO"
→ Ollama: `{ canImplement: true, targetFile: "src/auth/User.cs", ambiguities: [] }`
→ Hook allows Write
→ Wait — task touches TWO files (`User.cs` and the DTO). The single-file rule from
   confidence scoring catches this before Ollama even runs.

---

## Consequences

- **Good**: No code is generated on an ambiguous task, ever, without Claude's intervention
- **Good**: Local inference — no API cost, no latency to external services
- **Good**: The ambiguities are written back to context, making them visible and actionable
- **Good**: Works even if Claude forgets to validate — the hook doesn't forget
- **Neutral**: ~1-3 second latency per Write/Edit while Ollama responds
- **Bad**: Requires Ollama running locally with a suitable model pulled
