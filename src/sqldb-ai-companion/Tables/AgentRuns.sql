CREATE TABLE [dbo].[AgentRuns]
(
    [id]           NVARCHAR(100)   NOT NULL,
    [taskId]       INT             NULL,
    [model]        NVARCHAR(50)    NOT NULL,
    [inputTokens]  INT             NOT NULL CONSTRAINT [DF_AgentRuns_inputTokens]  DEFAULT (0),
    [outputTokens] INT             NOT NULL CONSTRAINT [DF_AgentRuns_outputTokens] DEFAULT (0),
    [durationMs]   INT             NOT NULL CONSTRAINT [DF_AgentRuns_durationMs]   DEFAULT (0),
    [score]        FLOAT           NULL,
    [createdAt]    DATETIME2       NOT NULL CONSTRAINT [DF_AgentRuns_createdAt] DEFAULT GETUTCDATE(),
    CONSTRAINT [PK_AgentRuns] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_AgentRuns_Tasks] FOREIGN KEY ([taskId]) REFERENCES [dbo].[Tasks] ([ghId])
);
