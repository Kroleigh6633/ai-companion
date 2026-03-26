-- Migration 001: Initial schema for sqldb-pas-main-dev
-- Convention: sqldb-{area}-[{tenant}]-{environment}
-- Large content columns (nvarchar(max), binary) are externalized to file share blobs.
-- DB columns hold nvarchar(500) relative blob paths.

USE [sqldb-pas-main-dev];
GO

-- ============================================================
-- DocumentTypes: extensible registry of document types
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'DocumentTypes' AND type = 'U')
CREATE TABLE DocumentTypes (
    id              nvarchar(100)   NOT NULL PRIMARY KEY,
    name            nvarchar(255)   NOT NULL,
    description     nvarchar(1000)  NOT NULL,
    templatePath    nvarchar(500)   NOT NULL,   -- blob ref: pas/docs/{type}/_template.md
    chunkStrategy   nvarchar(50)    NOT NULL,
    chunkSize       int             NOT NULL,
    chunkOverlap    int             NOT NULL,
    createdAt       datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- Documents: document metadata (content stored as blob)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'Documents' AND type = 'U')
CREATE TABLE Documents (
    id          nvarchar(100)   NOT NULL PRIMARY KEY,
    typeId      nvarchar(100)   NOT NULL REFERENCES DocumentTypes(id),
    title       nvarchar(500)   NOT NULL,
    contentPath nvarchar(500)   NOT NULL,   -- blob ref: pas/blobs/Documents/{id}/content.md
    filePath    nvarchar(500)   NOT NULL,   -- logical path: pas/docs/{typeId}/{id}.md
    tags        nvarchar(2000)  NOT NULL DEFAULT '[]',   -- JSON array
    createdAt   datetime2       NOT NULL DEFAULT GETUTCDATE(),
    updatedAt   datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IF NOT EXISTS IX_Documents_typeId ON Documents(typeId);
GO

-- ============================================================
-- DocumentChunks: chunk metadata + optional embedding vector
-- Embeddings stored as JSON array string (nvarchar(max) → blob if >2000 chars)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'DocumentChunks' AND type = 'U')
CREATE TABLE DocumentChunks (
    id          nvarchar(100)   NOT NULL PRIMARY KEY,
    documentId  nvarchar(100)   NOT NULL REFERENCES Documents(id) ON DELETE CASCADE,
    content     nvarchar(2000)  NOT NULL,
    chunkIndex  int             NOT NULL,
    tokenCount  int             NOT NULL,
    embedding   nvarchar(500)   NULL,   -- blob ref OR short JSON for small vectors
    createdAt   datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IF NOT EXISTS IX_Chunks_documentId ON DocumentChunks(documentId);
GO

-- ============================================================
-- Tasks: GitHub Issues mirror + internal decomposition fields
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'Tasks' AND type = 'U')
CREATE TABLE Tasks (
    ghId                int             NOT NULL PRIMARY KEY,
    type                nvarchar(50)    NOT NULL,
    status              nvarchar(50)    NOT NULL DEFAULT 'open',
    title               nvarchar(500)   NOT NULL,
    body                nvarchar(500)   NOT NULL,   -- blob ref if large
    confidence          float           NOT NULL DEFAULT 0,
    targetFile          nvarchar(500)   NULL,
    decomposedFrom      int             NULL,
    blockedBy           nvarchar(500)   NOT NULL DEFAULT '[]',   -- JSON int[]
    dependsOn           nvarchar(500)   NOT NULL DEFAULT '[]',   -- JSON int[]
    acceptanceCriteria  nvarchar(500)   NOT NULL DEFAULT '[]',   -- JSON string[]
    testCriteria        nvarchar(500)   NOT NULL DEFAULT '[]',   -- JSON string[]
    complexity          float           NULL,
    risk                float           NULL,
    assignedModel       nvarchar(50)    NULL,
    createdAt           datetime2       NOT NULL DEFAULT GETUTCDATE(),
    updatedAt           datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IF NOT EXISTS IX_Tasks_status ON Tasks(status);
CREATE INDEX IF NOT EXISTS IX_Tasks_type ON Tasks(type);
GO

-- ============================================================
-- AgentRuns: per-run record (model, tokens, duration, score)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'AgentRuns' AND type = 'U')
CREATE TABLE AgentRuns (
    id          nvarchar(100)   NOT NULL PRIMARY KEY,
    taskId      int             NULL REFERENCES Tasks(ghId),
    model       nvarchar(50)    NOT NULL,
    inputTokens int             NOT NULL DEFAULT 0,
    outputTokens int            NOT NULL DEFAULT 0,
    durationMs  int             NOT NULL DEFAULT 0,
    score       float           NULL,
    createdAt   datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- Rubrics: rubric definitions (criteria stored as JSON blob ref)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'Rubrics' AND type = 'U')
CREATE TABLE Rubrics (
    id          nvarchar(100)   NOT NULL PRIMARY KEY,
    name        nvarchar(255)   NOT NULL,
    description nvarchar(1000)  NOT NULL,
    criteria    nvarchar(500)   NOT NULL,   -- blob ref: pas/blobs/Rubrics/{id}/criteria.json
    createdAt   datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- RubricScores: feedback history
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'RubricScores' AND type = 'U')
CREATE TABLE RubricScores (
    id              nvarchar(100)   NOT NULL PRIMARY KEY,
    rubricId        nvarchar(100)   NOT NULL,
    taskId          int             NULL REFERENCES Tasks(ghId),
    agentRunId      nvarchar(100)   NULL REFERENCES AgentRuns(id),
    score           float           NOT NULL,
    criteriaScores  nvarchar(2000)  NOT NULL,   -- JSON object
    notes           nvarchar(1000)  NOT NULL DEFAULT '',
    createdAt       datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IF NOT EXISTS IX_RubricScores_rubricId ON RubricScores(rubricId);
CREATE INDEX IF NOT EXISTS IX_RubricScores_taskId ON RubricScores(taskId);
GO

-- ============================================================
-- MemoryBlocks: persistent Letta-style context blocks
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'MemoryBlocks' AND type = 'U')
CREATE TABLE MemoryBlocks (
    key         nvarchar(100)   NOT NULL PRIMARY KEY,
    content     nvarchar(2000)  NOT NULL,
    contentPath nvarchar(500)   NULL,   -- blob ref if content > 2000 chars
    tokenCount  int             NOT NULL DEFAULT 0,
    hash        nvarchar(32)    NOT NULL DEFAULT '',
    updatedAt   datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- ContextSnapshots: compressed context history
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'ContextSnapshots' AND type = 'U')
CREATE TABLE ContextSnapshots (
    id                  nvarchar(100)   NOT NULL PRIMARY KEY,
    sessionId           nvarchar(100)   NOT NULL,
    compressionRatio    float           NOT NULL,
    contentPath         nvarchar(500)   NOT NULL,   -- blob ref
    createdAt           datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- CompressionLog: audit of what was compressed/discarded
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'CompressionLog' AND type = 'U')
CREATE TABLE CompressionLog (
    id              nvarchar(100)   NOT NULL PRIMARY KEY,
    snapshotId      nvarchar(100)   NOT NULL REFERENCES ContextSnapshots(id),
    retained        nvarchar(2000)  NOT NULL DEFAULT '[]',
    discarded       nvarchar(2000)  NOT NULL DEFAULT '[]',
    ratioAchieved   float           NOT NULL,
    notes           nvarchar(1000)  NOT NULL DEFAULT '',
    createdAt       datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- BlobReferences: reverse index blob path → table/row/column
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'BlobReferences' AND type = 'U')
CREATE TABLE BlobReferences (
    blobPath    nvarchar(500)   NOT NULL PRIMARY KEY,
    tableName   nvarchar(100)   NOT NULL,
    rowId       nvarchar(100)   NOT NULL,
    columnName  nvarchar(100)   NOT NULL,
    createdAt   datetime2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================
-- MessageQueue: durable cross-session event queue (ADR-0005)
-- SQL holds the pointer; file share holds the payload (ADR-0002)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'MessageQueue' AND type = 'U')
CREATE TABLE MessageQueue (
    id              nvarchar(100)   NOT NULL PRIMARY KEY,
    event           nvarchar(100)   NOT NULL,
    payloadPath     nvarchar(500)   NOT NULL,   -- blob ref: pas/queue/{event}/{id}.json
    status          nvarchar(20)    NOT NULL DEFAULT 'pending',  -- pending|processed|dead
    enqueuedAt      datetime2       NOT NULL DEFAULT GETUTCDATE(),
    attempts        int             NOT NULL DEFAULT 0,
    lastAttemptAt   datetime2       NULL
);
GO

CREATE INDEX IF NOT EXISTS IX_Queue_status_event ON MessageQueue(status, event);
GO

PRINT 'Migration 001 complete: sqldb-pas-main-dev schema created.';
GO
