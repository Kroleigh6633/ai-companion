CREATE TABLE [dbo].[DocumentChunks]
(
    [id]          NVARCHAR(100)   NOT NULL,
    [documentId]  NVARCHAR(100)   NOT NULL,
    [content]     NVARCHAR(2000)  NOT NULL,
    [chunkIndex]  INT             NOT NULL,
    [tokenCount]  INT             NOT NULL,
    [embedding]   NVARCHAR(500)   NULL,
    [createdAt]   DATETIME2       NOT NULL CONSTRAINT [DF_DocumentChunks_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_DocumentChunks] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_DocumentChunks_Documents] FOREIGN KEY ([documentId]) REFERENCES [dbo].[Documents] ([id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_DocumentChunks_documentId] ON [dbo].[DocumentChunks] ([documentId] ASC);
