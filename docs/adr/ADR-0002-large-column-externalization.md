# ADR-0002: Large Column Externalization to File Share

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

SQL Server tables risk becoming bloated and slow when `nvarchar(max)`, `nvarchar(2000+)`,
`text`, `binary`, or `varbinary` columns store large payloads inline. Row sizes grow,
index fragmentation accelerates, and backup/restore times increase disproportionately.

## Decision

**Rule**: Any column of type `nvarchar(max)`, `nvarchar` wider than 2000 characters,
`text`, `binary`, or `varbinary` is stored as a file on the network share.
The database column holds an `nvarchar(500)` relative path to that file.

### Path Convention

```
pas/blobs/{table}/{row-id}/{column}.{ext}
```

Base path: `\\MJHRGB01\file-system\`
Full path example: `\\MJHRGB01\file-system\pas\blobs\Documents\{uuid}\content.md`

### DB Column Definition

```sql
contentPath nvarchar(500) NOT NULL  -- relative blob path, never the content itself
```

### Access Pattern

All blob read/write goes through `shared/utils/blob-store.ts`:

```typescript
import { blobRead, blobWrite, makeBlobPath } from '@ai-companion/utils';

// Write
const path = makeBlobPath('Documents', documentId, 'content', 'md');
blobWrite(path, markdownContent);

// Read
const content = blobRead(document.contentPath);
```

### Exception Challenge

Full-text search is the only legitimate reason to keep large text in the database.
Before using SQL Server FTS, evaluate:

1. Is semantic search via Ollama embeddings (`embeddings-server`) a better fit?
2. Is the search frequency high enough to justify the index maintenance cost?
3. Would a keyword index on a summary/title column be sufficient?

If all three answers are "no", SQL FTS is acceptable as an exception.

## Consequences

- **Good**: DB stays lean, fast-scanning, and index-friendly.
- **Good**: Large content benefits from file system caching and compression.
- **Good**: Blob content can be versioned, diff'd, and audited independently.
- **Bad**: Queries that need content must do a file read — no inline SQL string ops.
- **Bad**: Blob store must be available for full data access.

## Implementation

See `/skill: new-blob-column` — adds a blob-backed column with migration + wiring.

---

*This ADR is stored in the fragment-server as document type `adr`, ID `ADR-0002`.*
