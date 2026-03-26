---
name: new-blob-column
description: Add a blob-backed column to an existing SQL table following ADR-0002
---

Add a large-content column to a SQL table using the file-share externalization pattern from ADR-0002.
The database stores an `nvarchar(500)` path; content lives on `\\MJHRGB01\file-system\`.

## What I need from you

1. **table** — target SQL table name (e.g., `Documents`)
2. **column** — logical column name (e.g., `content`, `body`, `payload`)
3. **extension** — file extension for the blob (`md`, `txt`, `json`, `bin`)
4. **description** — what this column holds

## What I will do

1. Generate an ALTER TABLE migration adding `{column}Path nvarchar(500) NULL`
2. Add a read helper in the relevant server's tools file:
   ```typescript
   const content = blobRead(row.{column}Path);
   ```
3. Add a write helper using `makeBlobPath(table, rowId, column, ext)`
4. Register the blob path format in `BlobReferences` table
5. Update the server's tool `inputSchema` to accept `{column}` as a string parameter
   (never as a path — the server builds the path internally)

## Generated migration

```sql
ALTER TABLE {Table} ADD {column}Path nvarchar(500) NULL;
-- Existing rows: set to NULL until content is migrated
```

## Prompts used

```
/new-blob-column table=Documents column=content extension=md description="Full markdown document body"
```
