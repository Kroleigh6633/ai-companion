CREATE TABLE [dbo].[BlobReferences]
(
    [blobPath]   NVARCHAR(500)   NOT NULL,
    [tableName]  NVARCHAR(100)   NOT NULL,
    [rowId]      NVARCHAR(100)   NOT NULL,
    [columnName] NVARCHAR(100)   NOT NULL,
    [createdAt]  DATETIME2       NOT NULL CONSTRAINT [DF_BlobReferences_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_BlobReferences] PRIMARY KEY CLUSTERED ([blobPath] ASC)
);
