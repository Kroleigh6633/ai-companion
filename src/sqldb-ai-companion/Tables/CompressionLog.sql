CREATE TABLE [dbo].[CompressionLog]
(
    [id]            NVARCHAR(100)   NOT NULL,
    [snapshotId]    NVARCHAR(100)   NOT NULL,
    [retained]      NVARCHAR(2000)  NOT NULL CONSTRAINT [DF_CompressionLog_retained]  DEFAULT ('[]'),
    [discarded]     NVARCHAR(2000)  NOT NULL CONSTRAINT [DF_CompressionLog_discarded] DEFAULT ('[]'),
    [ratioAchieved] FLOAT           NOT NULL,
    [notes]         NVARCHAR(1000)  NOT NULL CONSTRAINT [DF_CompressionLog_notes] DEFAULT (''),
    [createdAt]     DATETIME2       NOT NULL CONSTRAINT [DF_CompressionLog_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_CompressionLog] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_CompressionLog_ContextSnapshots] FOREIGN KEY ([snapshotId]) REFERENCES [dbo].[ContextSnapshots] ([id])
);
