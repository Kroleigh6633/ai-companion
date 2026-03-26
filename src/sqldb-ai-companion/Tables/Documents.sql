CREATE TABLE [dbo].[Documents]
(
    [id]          NVARCHAR(100)   NOT NULL,
    [typeId]      NVARCHAR(100)   NOT NULL,
    [title]       NVARCHAR(500)   NOT NULL,
    [contentPath] NVARCHAR(500)   NOT NULL,
    [filePath]    NVARCHAR(500)   NOT NULL,
    [tags]        NVARCHAR(2000)  NOT NULL CONSTRAINT [DF_Documents_tags] DEFAULT ('[]'),
    [createdAt]   DATETIME2       NOT NULL CONSTRAINT [DF_Documents_createdAt] DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2       NOT NULL CONSTRAINT [DF_Documents_updatedAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_Documents] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_Documents_DocumentTypes] FOREIGN KEY ([typeId]) REFERENCES [dbo].[DocumentTypes] ([id])
);
GO
CREATE INDEX [IX_Documents_typeId] ON [dbo].[Documents] ([typeId] ASC);
