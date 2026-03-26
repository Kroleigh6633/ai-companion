import { EventEmitter } from 'node:events';
import { createLogger } from '@ai-companion/utils';

const log = createLogger('bus');

// Session-lifetime event bus.
// For durable cross-session events, use enqueue() from queue-store.ts — the poller
// delivers those onto this same bus so handlers are written once regardless of path.
export const bus = new EventEmitter();
bus.setMaxListeners(50);

bus.on('error', (err) => {
  log.error('Bus error', err);
});

export type BusEventMap = {
  'document:created': { id: string; typeId: string };
  'document:chunked': { documentId: string; chunkCount: number };
  'task:ready': { ghId: number };
  'task:completed': { ghId: number; score?: number };
  'graph:reindex': { filePath: string };
  'context:compress': { sessionId: string };
};

export type BusEvent = keyof BusEventMap;

export function emit<E extends BusEvent>(event: E, payload: BusEventMap[E]): void {
  log.debug(`emit ${event}`, payload);
  bus.emit(event, payload);
}

export function on<E extends BusEvent>(event: E, handler: (payload: BusEventMap[E]) => Promise<void> | void): void {
  bus.on(event, (payload: BusEventMap[E]) => {
    Promise.resolve(handler(payload)).catch((err) => {
      log.error(`Handler error for ${event}`, err);
    });
  });
}
