CREATE TABLE [dbo].[MemoryBlocks]
(
    [key]         NVARCHAR(100)   NOT NULL,
    [content]     NVARCHAR(2000)  NOT NULL,
    [contentPath] NVARCHAR(500)   NULL,
    [tokenCount]  INT             NOT NULL CONSTRAINT [DF_MemoryBlocks_tokenCount] DEFAULT (0),
    [hash]        NVARCHAR(32)    NOT NULL CONSTRAINT [DF_MemoryBlocks_hash]       DEFAULT (''),
    [updatedAt]   DATETIME2       NOT NULL CONSTRAINT [DF_MemoryBlocks_updatedAt]  DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_MemoryBlocks] PRIMARY KEY CLUSTERED ([key] ASC)
);
