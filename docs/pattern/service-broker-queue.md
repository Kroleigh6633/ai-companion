# Pattern: Service Broker Queue Setup in C#

**Implements**: ADR-0005
**Type**: pattern

---

## When to Use

When you need a durable, transactional message queue backed by SQL Server Service Broker. Use this for any event that must survive session restarts — document embedding, graph re-indexing, task sync.

---

## SQL DDL (run once in migration)

```sql
-- Message type: no validation, payload is JSON
CREATE MESSAGE TYPE [//pas/companion/Event]
    VALIDATION = NONE;

-- Contract: initiator sends events
CREATE CONTRACT [//pas/companion/EventContract]
    ([//pas/companion/Event] SENT BY INITIATOR);

-- Queue with SQL Server 2025 poison message handling
CREATE QUEUE CompanionEventQueue
    WITH POISON_MESSAGE_HANDLING (STATUS = ON);

-- Service bound to queue
CREATE SERVICE [//pas/companion/EventService]
    ON QUEUE CompanionEventQueue
    ([//pas/companion/EventContract]);
```

---

## C# Enqueue (SEND)

```csharp
public async Task EnqueueAsync(string eventName, object payload, SqlConnection conn, SqlTransaction tx)
{
    var message = JsonSerializer.Serialize(new
    {
        id = Guid.NewGuid(),
        @event = eventName,
        payload,
        enqueuedAt = DateTime.UtcNow
    });

    var cmd = new SqlCommand(@"
        DECLARE @handle UNIQUEIDENTIFIER;
        BEGIN DIALOG CONVERSATION @handle
            FROM SERVICE [//pas/companion/EventService]
            TO SERVICE '//pas/companion/EventService'
            ON CONTRACT [//pas/companion/EventContract]
            WITH ENCRYPTION = OFF;
        SEND ON CONVERSATION @handle
            MESSAGE TYPE [//pas/companion/Event]
            (@body);
        END CONVERSATION @handle WITH CLEANUP;
    ", conn, tx);

    cmd.Parameters.Add("@body", SqlDbType.NVarChar, -1).Value = message;
    await cmd.ExecuteNonQueryAsync();
}
```

---

## C# Dequeue (RECEIVE) — called by GET /queue/pending

```csharp
public async Task<List<QueueMessage>> ReceivePendingAsync(int limit, SqlConnection conn)
{
    var cmd = new SqlCommand($@"
        WAITFOR (
            RECEIVE TOP(@limit)
                conversation_handle,
                message_body,
                message_enqueue_time
            FROM CompanionEventQueue
        ), TIMEOUT 0;
    ", conn);
    cmd.Parameters.AddWithValue("@limit", limit);

    var messages = new List<QueueMessage>();
    using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var body = reader.GetString(1);
        var msg = JsonSerializer.Deserialize<QueueMessage>(body)!;
        msg.ConversationHandle = reader.GetGuid(0);
        msg.EnqueueTime = reader.GetDateTime(2);
        messages.Add(msg);
    }
    return messages;
}
```

---

## C# Ack (END CONVERSATION) — called by POST /queue/{id}/ack

```csharp
public async Task AckAsync(Guid conversationHandle, SqlConnection conn, SqlTransaction tx)
{
    var cmd = new SqlCommand(
        "END CONVERSATION @handle;", conn, tx);
    cmd.Parameters.AddWithValue("@handle", conversationHandle);
    await cmd.ExecuteNonQueryAsync();
}
```

---

## Monitoring (SQL Server 2025)

```sql
-- Queue depth and age
SELECT
    message_type_name,
    message_enqueue_time,
    DATEDIFF(second, message_enqueue_time, GETUTCDATE()) AS age_seconds,
    COUNT(*) AS count
FROM CompanionEventQueue WITH (NOLOCK)
GROUP BY message_type_name, message_enqueue_time
ORDER BY message_enqueue_time;

-- Poison message handling status
SELECT name, is_poison_message_handling_enabled
FROM sys.service_queues
WHERE name = 'CompanionEventQueue';
```

---

## Notes

- WAITFOR TIMEOUT 0 returns immediately if queue is empty — correct for a poller
- The conversation handle is what you ack; store it alongside the message during RECEIVE
- Large payloads: store on file share per ADR-0002, put the path in `payloadPath` field
- Dead letters: SQL Server 2025 poison handling automatically moves after repeated rollbacks
