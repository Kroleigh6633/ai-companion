CREATE TABLE [dbo].[ContextSnapshots]
(
    [id]               NVARCHAR(100)   NOT NULL,
    [sessionId]        NVARCHAR(100)   NOT NULL,
    [compressionRatio] FLOAT           NOT NULL,
    [contentPath]      NVARCHAR(500)   NOT NULL,
    [createdAt]        DATETIME2       NOT NULL CONSTRAINT [DF_ContextSnapshots_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_ContextSnapshots] PRIMARY KEY CLUSTERED ([id] ASC)
);
