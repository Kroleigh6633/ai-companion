-- SQL Server Service Broker objects for the durable event queue (ADR-0005).
-- SQL Server 2025: POISON_MESSAGE_HANDLING is supported natively.

CREATE MESSAGE TYPE [//pas/companion/Event]
    VALIDATION = NONE;
GO

CREATE CONTRACT [//pas/companion/EventContract]
    ([//pas/companion/Event] SENT BY INITIATOR);
GO

CREATE QUEUE [dbo].[CompanionEventQueue]
    WITH POISON_MESSAGE_HANDLING (STATUS = ON);
GO

CREATE SERVICE [//pas/companion/EventService]
    ON QUEUE [dbo].[CompanionEventQueue]
    ([//pas/companion/EventContract]);
GO
