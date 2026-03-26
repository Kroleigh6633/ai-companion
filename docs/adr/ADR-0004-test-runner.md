# ADR-0004: Test Runner — node:test for Server Packages

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

During platform setup, all server package tests produced a consistent OOM (4GB heap,
~28 seconds) regardless of configuration. Two hours were spent suspecting Vite's dependency
scanner, pnpm workspace symlinks, and the Azure SDK import chain. None of those were the
cause.

**Root cause**: `chunkRecursive` in `fragment-server/src/chunker.ts` had an infinite loop.
When the overlap was larger than remaining content, `start = end - overlapChars` never
advanced, spinning indefinitely and creating millions of identical chunks. Every test
runner—vitest, node:test, any runner—would OOM on this file.

**Lesson**: Before blaming the test infrastructure, check whether the code under test
can cause an infinite loop. A smoke test that imports no project code passes; a test that
imports the broken code OOMs. The test runner is innocent.

---

## Decision

Server packages (`src/*-server`) use **`node:test`** (Node.js 22 built-in).

`mcp-shell` uses vitest — it works and the SDK dependencies are well-scoped there.

`node:test` was chosen for server packages because:
- The chunker bug investigation made clear that the OOM was in application code, not Vite
- `node:test` is zero-dependency, no Vite startup, instant feedback
- It reinforces that test files should stay close to the Node.js runtime, not web tooling

---

## Test file convention

Server packages use `.node.test.ts` suffix. Run with `--experimental-strip-types`:

```json
"test": "node --experimental-strip-types --test src/**/*.node.test.ts"
```

Pure logic modules (no workspace imports) are tested directly against source.
Modules with workspace dependencies are tested against built `dist/` output.

---

## Bug fixed alongside this decision

`chunker.ts` loop guard added:
```typescript
const newStart = end - overlapChars;
if (newStart <= start) break; // prevent infinite loop at content boundary
start = newStart;
```

---

## Consequences

- **Good**: `node:test` has no Vite overhead — server package tests start in <100ms
- **Good**: The infinite loop is fixed and covered by test cases
- **Good**: No additional dependencies for testing
- **Bad**: Different assertion API (`assert.strictEqual` vs `expect().toBe()`)
- **Bad**: No vitest watch mode — use `node --watch --test` instead
