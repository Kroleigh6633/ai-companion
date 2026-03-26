CREATE TABLE [dbo].[DocumentTypes]
(
    [id]            NVARCHAR(100)   NOT NULL,
    [name]          NVARCHAR(255)   NOT NULL,
    [description]   NVARCHAR(1000)  NOT NULL,
    [templatePath]  NVARCHAR(500)   NOT NULL,
    [chunkStrategy] NVARCHAR(50)    NOT NULL,
    [chunkSize]     INT             NOT NULL,
    [chunkOverlap]  INT             NOT NULL,
    [createdAt]     DATETIME2       NOT NULL CONSTRAINT [DF_DocumentTypes_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_DocumentTypes] PRIMARY KEY CLUSTERED ([id] ASC)
);
