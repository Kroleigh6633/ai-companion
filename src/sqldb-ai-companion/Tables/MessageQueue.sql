-- Durable message queue backed by SQL Server Service Broker (ADR-0005).
-- This table is the SQL row pointer; payload lives on the file share (ADR-0002).
-- Note: Service Broker DDL (queues, services, contracts) is in ServiceBroker/ folder.
CREATE TABLE [dbo].[MessageQueue]
(
    [id]            NVARCHAR(100)   NOT NULL,
    [event]         NVARCHAR(100)   NOT NULL,
    [payloadPath]   NVARCHAR(500)   NOT NULL,
    [status]        NVARCHAR(20)    NOT NULL CONSTRAINT [DF_MessageQueue_status]    DEFAULT ('pending'),
    [enqueuedAt]    DATETIME2       NOT NULL CONSTRAINT [DF_MessageQueue_enqueuedAt] DEFAULT GETUTCDATE(),
    [attempts]      INT             NOT NULL CONSTRAINT [DF_MessageQueue_attempts]  DEFAULT (0),
    [lastAttemptAt] DATETIME2       NULL,
    CONSTRAINT [PK_MessageQueue] PRIMARY KEY CLUSTERED ([id] ASC)
);
GO
CREATE INDEX [IX_MessageQueue_status_event] ON [dbo].[MessageQueue] ([status] ASC, [event] ASC);
