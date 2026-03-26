CREATE TABLE [dbo].[Tasks]
(
    [ghId]               INT             NOT NULL,
    [type]               NVARCHAR(50)    NOT NULL,
    [status]             NVARCHAR(50)    NOT NULL CONSTRAINT [DF_Tasks_status] DEFAULT ('open'),
    [title]              NVARCHAR(500)   NOT NULL,
    [body]               NVARCHAR(500)   NOT NULL,
    [confidence]         FLOAT           NOT NULL CONSTRAINT [DF_Tasks_confidence] DEFAULT (0),
    [targetFile]         NVARCHAR(500)   NULL,
    [decomposedFrom]     INT             NULL,
    [blockedBy]          NVARCHAR(500)   NOT NULL CONSTRAINT [DF_Tasks_blockedBy] DEFAULT ('[]'),
    [dependsOn]          NVARCHAR(500)   NOT NULL CONSTRAINT [DF_Tasks_dependsOn] DEFAULT ('[]'),
    [acceptanceCriteria] NVARCHAR(500)   NOT NULL CONSTRAINT [DF_Tasks_acceptanceCriteria] DEFAULT ('[]'),
    [testCriteria]       NVARCHAR(500)   NOT NULL CONSTRAINT [DF_Tasks_testCriteria] DEFAULT ('[]'),
    [complexity]         FLOAT           NULL,
    [risk]               FLOAT           NULL,
    [assignedModel]      NVARCHAR(50)    NULL,
    [createdAt]          DATETIME2       NOT NULL CONSTRAINT [DF_Tasks_createdAt] DEFAULT GETUTCDATE(),
    [updatedAt]          DATETIME2       NOT NULL CONSTRAINT [DF_Tasks_updatedAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_Tasks] PRIMARY KEY CLUSTERED ([ghId] ASC)
);
GO
CREATE INDEX [IX_Tasks_status] ON [dbo].[Tasks] ([status] ASC);
CREATE INDEX [IX_Tasks_type]   ON [dbo].[Tasks] ([type] ASC);
