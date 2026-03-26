import { createLogger, getConfig } from '@ai-companion/utils';
import { emit } from './bus.js';
import type { BusEvent, BusEventMap } from './bus.js';

const log = createLogger('poller');

const POLL_INTERVAL_MS = parseInt(process.env['QUEUE_POLL_MS'] ?? '5000', 10);
const MAX_ATTEMPTS = 3;

let _timer: ReturnType<typeof setInterval> | null = null;

// The shell calls the C# API for queue operations — queue logic lives in the API,
// not in the shell. Hot-reloading the API updates queue behavior without restarting Claude.
async function fetchPending(): Promise<Array<{ id: string; event: string; payload: unknown; attempts: number }>> {
  try {
    const { apiGet } = await import('@ai-companion/utils');
    return await apiGet<Array<{ id: string; event: string; payload: unknown; attempts: number }>>('/queue/pending?limit=10');
  } catch {
    return [];
  }
}

async function ackMessage(id: string, success: boolean): Promise<void> {
  try {
    const { apiPost } = await import('@ai-companion/utils');
    await apiPost(success ? `/queue/${id}/ack` : `/queue/${id}/nack`, {});
  } catch (err) {
    log.warn(`Could not ${success ? 'ack' : 'nack'} message ${id}`, err);
  }
}

async function poll(): Promise<void> {
  try {
    const messages = await fetchPending();
    for (const msg of messages) {
      if (msg.attempts >= MAX_ATTEMPTS) {
        log.warn(`Dead letter: ${msg.event} ${msg.id} after ${msg.attempts} attempts`);
        await ackMessage(msg.id, false);
        continue;
      }
      try {
        emit(msg.event as BusEvent, msg.payload as BusEventMap[BusEvent]);
        await ackMessage(msg.id, true);
        log.debug(`Processed ${msg.event}`, { id: msg.id });
      } catch (err) {
        log.error(`Handler failed for ${msg.event} ${msg.id}`, err);
        await ackMessage(msg.id, false);
      }
    }
  } catch (err) {
    log.warn('Poll cycle error (will retry next tick)', err);
  }
}

export function startPoller(): void {
  if (_timer) return;
  _timer = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
  log.info('Queue poller started', { intervalMs: POLL_INTERVAL_MS });
  void poll(); // immediate first run
}

export function stopPoller(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    log.info('Queue poller stopped');
  }
}
