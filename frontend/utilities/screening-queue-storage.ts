import {
  parseScreeningQueue,
  SCREENING_QUEUE_KEY_PREFIX,
  type ScreeningQueue,
} from "@/utilities/screening-queue";

export const MAX_STORED_SCREENING_QUEUES = 10;

const memory = new Map<string, ScreeningQueue | null>();
const listeners = new Set<() => void>();

function readFromSessionStorage(key: string): ScreeningQueue | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return parseScreeningQueue(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readScreeningQueue(key: string): ScreeningQueue | null {
  if (memory.has(key)) return memory.get(key) ?? null;

  const stored = readFromSessionStorage(key);
  memory.set(key, stored);
  return stored;
}

function writeToSessionStorage(key: string, queue: ScreeningQueue): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

function removeFromSessionStorage(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    return;
  }
}

function storedScreeningQueueKeys(): string[] {
  try {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(SCREENING_QUEUE_KEY_PREFIX)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

function createdAtOf(key: string): number {
  const queue = memory.get(key) ?? readFromSessionStorage(key);
  const createdAt = queue ? Date.parse(queue.createdAt) : Number.NaN;
  return Number.isNaN(createdAt) ? Number.NEGATIVE_INFINITY : createdAt;
}

function pruneScreeningQueues(newestKey: string): void {
  const keys = new Set(storedScreeningQueueKeys());
  for (const [key, queue] of memory) {
    if (queue && key.startsWith(SCREENING_QUEUE_KEY_PREFIX)) keys.add(key);
  }
  keys.delete(newestKey);

  const oldestLast = [...keys]
    .map((key) => ({ key, createdAt: createdAtOf(key) }))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));

  for (const { key } of oldestLast.slice(MAX_STORED_SCREENING_QUEUES - 1)) {
    memory.delete(key);
    removeFromSessionStorage(key);
  }
}

export function writeScreeningQueue(key: string, queue: ScreeningQueue): void {
  memory.set(key, queue);
  writeToSessionStorage(key, queue);
  pruneScreeningQueues(key);

  for (const listener of [...listeners]) listener();
}

export function subscribeScreeningQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function forgetScreeningQueuesInMemory(): void {
  memory.clear();
}
