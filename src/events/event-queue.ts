import { sendEvent } from "../api/client";
import {
  MAX_LOCAL_LOG,
  MAX_QUEUE_SIZE,
  MAX_RETRY_ATTEMPTS,
  STORAGE_KEYS,
} from "../shared/constants";
import {
  createWebVisitEvent,
  generateEventId,
  type QueuedEvent,
  type WebVisitEvent,
} from "./event-types";

async function getQueue(): Promise<QueuedEvent[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.EVENT_QUEUE);
  return (result[STORAGE_KEYS.EVENT_QUEUE] as QueuedEvent[] | undefined) ?? [];
}

async function saveQueue(queue: QueuedEvent[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_QUEUE]: queue });
}

async function appendToLocalLog(event: WebVisitEvent): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LOCAL_EVENT_LOG);
  const log = (result[STORAGE_KEYS.LOCAL_EVENT_LOG] as WebVisitEvent[] | undefined) ?? [];
  const updated = [event, ...log].slice(0, MAX_LOCAL_LOG);
  await chrome.storage.local.set({ [STORAGE_KEYS.LOCAL_EVENT_LOG]: updated });
}

export async function getLocalEventLog(): Promise<WebVisitEvent[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LOCAL_EVENT_LOG);
  return (result[STORAGE_KEYS.LOCAL_EVENT_LOG] as WebVisitEvent[] | undefined) ?? [];
}

export async function enqueueEvent(url: string, title: string): Promise<void> {
  const event = createWebVisitEvent(url, title);
  await appendToLocalLog(event);

  const queue = await getQueue();
  const queued: QueuedEvent = {
    ...event,
    id: generateEventId(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  queue.push(queued);

  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }

  await saveQueue(queue);
}

export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const remaining: QueuedEvent[] = [];
  let sent = 0;
  let failed = 0;

  for (const item of queue) {
    const result = await sendEvent(item);

    if (result.ok) {
      sent += 1;
      continue;
    }

    const nextAttempts = item.attempts + 1;
    if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
      failed += 1;
      console.warn("[Echoes] Dropping event after max retries:", item.id, result.error);
      continue;
    }

    remaining.push({ ...item, attempts: nextAttempts });
    failed += 1;
  }

  await saveQueue(remaining);
  return { sent, failed };
}

export async function getQueueStats(): Promise<{ pending: number; totalAttempts: number }> {
  const queue = await getQueue();
  return {
    pending: queue.length,
    totalAttempts: queue.reduce((sum, item) => sum + item.attempts, 0),
  };
}

export async function clearQueue(): Promise<void> {
  await saveQueue([]);
}
