import { parseScreeningQueue, type ScreeningQueue } from "@/utilities/screening-queue";

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

export function writeScreeningQueue(key: string, queue: ScreeningQueue): void {
  memory.set(key, queue);
  writeToSessionStorage(key, queue);

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
