CREATE TABLE [dbo].[RubricScores]
(
    [id]             NVARCHAR(100)   NOT NULL,
    [rubricId]       NVARCHAR(100)   NOT NULL,
    [taskId]         INT             NULL,
    [agentRunId]     NVARCHAR(100)   NULL,
    [score]          FLOAT           NOT NULL,
    [criteriaScores] NVARCHAR(2000)  NOT NULL,
    [notes]          NVARCHAR(1000)  NOT NULL CONSTRAINT [DF_RubricScores_notes] DEFAULT (''),
    [createdAt]      DATETIME2       NOT NULL CONSTRAINT [DF_RubricScores_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_RubricScores] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_RubricScores_Tasks]     FOREIGN KEY ([taskId])     REFERENCES [dbo].[Tasks] ([ghId]),
    CONSTRAINT [FK_RubricScores_AgentRuns] FOREIGN KEY ([agentRunId]) REFERENCES [dbo].[AgentRuns] ([id])
);
GO
CREATE INDEX [IX_RubricScores_rubricId] ON [dbo].[RubricScores] ([rubricId] ASC);
CREATE INDEX [IX_RubricScores_taskId]   ON [dbo].[RubricScores] ([taskId] ASC);
