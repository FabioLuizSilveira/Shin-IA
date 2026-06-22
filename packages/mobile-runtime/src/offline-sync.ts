import type { SyncQueueItem, SyncStatus, OperationType } from "./types.js";

export class MobileRuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MobileRuntimeError";
  }
}

export class OfflineSyncEngine {
  private readonly queue: SyncQueueItem[] = [];
  private status: SyncStatus = "idle";

  enqueue(item: Omit<SyncQueueItem, "retryCount" | "createdAt">): SyncQueueItem {
    const entry: SyncQueueItem = {
      ...item,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.queue.push(entry);
    if (this.status === "idle") this.status = "pending";
    return entry;
  }

  dequeue(): SyncQueueItem | undefined {
    return this.queue.sort((a, b) => b.priority - a.priority).shift();
  }

  peek(): SyncQueueItem | undefined {
    if (this.queue.length === 0) return undefined;
    return [...this.queue].sort((a, b) => b.priority - a.priority)[0];
  }

  markAttempt(id: string): void {
    const item = this.queue.find((i) => i.id === id);
    if (!item) throw new MobileRuntimeError(`Item not found: ${id}`, "ITEM_NOT_FOUND");
    item.retryCount++;
    item.lastAttemptAt = new Date().toISOString();
  }

  remove(id: string): void {
    const idx = this.queue.findIndex((i) => i.id === id);
    if (idx === -1) throw new MobileRuntimeError(`Item not found: ${id}`, "ITEM_NOT_FOUND");
    this.queue.splice(idx, 1);
    if (this.queue.length === 0) this.status = "idle";
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getSyncStatus(): SyncStatus {
    return this.status;
  }

  setSyncStatus(status: SyncStatus): void {
    this.status = status;
  }

  clearQueue(): void {
    this.queue.splice(0, this.queue.length);
    this.status = "idle";
  }

  listByOperation(operation: OperationType): SyncQueueItem[] {
    return this.queue.filter((i) => i.operation === operation);
  }

  listExhausted(): SyncQueueItem[] {
    return this.queue.filter((i) => i.retryCount >= i.maxRetries);
  }
}
