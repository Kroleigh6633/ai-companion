CREATE TABLE [dbo].[Rubrics]
(
    [id]          NVARCHAR(100)   NOT NULL,
    [name]        NVARCHAR(255)   NOT NULL,
    [description] NVARCHAR(1000)  NOT NULL,
    [criteria]    NVARCHAR(500)   NOT NULL,
    [createdAt]   DATETIME2       NOT NULL CONSTRAINT [DF_Rubrics_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_Rubrics] PRIMARY KEY CLUSTERED ([id] ASC)
);
