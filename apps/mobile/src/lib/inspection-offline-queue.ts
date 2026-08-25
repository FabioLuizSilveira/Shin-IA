// crypto.randomUUID() is not reliably available on Hermes in this app's
// RN/Expo version (confirmed: secure-session-store.ts only polyfills
// crypto.getRandomValues via react-native-get-random-values, never uses
// randomUUID) — generate queue-entry ids from the same polyfilled
// primitive everything else in this app already relies on, instead of a
// method that might not exist at runtime.
import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { shinaia } from "./shinaia-api";

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// P1.3 — real offline hardening for inspection capture (item 20/21 of the
// production-completion spec). Before this, InspectionCaptureScreen wrote
// straight to the network on every answer/photo — a dropped connection
// mid-capture just failed visibly, with nothing queued to retry. This
// module makes every write local-first:
//   1. Persist to AsyncStorage immediately (the draft never lives only in
//      React state — killing the app mid-vistoria can't lose it).
//   2. Attempt the network call.
//   3. On failure, leave the item queued; a NetInfo reconnect listener (and
//      manual flush calls) retries it later.
// Both underlying API calls are idempotent server-side already
// (inspection_responses upserts on inspection_id+item_id;
// inspection_media dedupes by checksum_sha256 — added in the P0 round) —
// that's what makes blind retry here safe, not a new client-side
// idempotency key.

const QUEUE_KEY_PREFIX = "inspection_offline_queue:";

type ResponseValue = {
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueJson?: unknown;
};

interface QueuedResponse {
  kind: "response";
  id: string;
  itemId: string;
  value: ResponseValue;
  queuedAt: string;
}

interface QueuedMedia {
  kind: "media";
  id: string;
  itemId?: string;
  photoUri: string;
  latitude?: number;
  longitude?: number;
  queuedAt: string;
}

type QueueEntry = QueuedResponse | QueuedMedia;

interface QueueState {
  entries: QueueEntry[];
  syncedCount: number;
}

async function readQueue(inspectionId: string): Promise<QueueState> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY_PREFIX + inspectionId);
  if (!raw) return { entries: [], syncedCount: 0 };
  try {
    return JSON.parse(raw) as QueueState;
  } catch {
    return { entries: [], syncedCount: 0 };
  }
}

async function writeQueue(inspectionId: string, state: QueueState): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY_PREFIX + inspectionId, JSON.stringify(state));
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false;
}

export interface QueueStatus {
  pendingResponses: number;
  pendingMedia: number;
  syncedCount: number;
  online: boolean;
}

export async function getQueueStatus(inspectionId: string): Promise<QueueStatus> {
  const { entries, syncedCount } = await readQueue(inspectionId);
  return {
    pendingResponses: entries.filter((e) => e.kind === "response").length,
    pendingMedia: entries.filter((e) => e.kind === "media").length,
    syncedCount,
    online: await isOnline(),
  };
}

// Attempts one entry against the network; returns true if it can be
// dropped from the queue (succeeded), false if it should stay queued.
async function trySync(
  inspectionId: string,
  entry: QueueEntry,
  scope: "staff" | "operator",
): Promise<boolean> {
  try {
    if (entry.kind === "response") {
      await shinaia.saveInspectionResponse(inspectionId, entry.itemId, entry.value, scope);
    } else {
      await shinaia.uploadInspectionMedia(inspectionId, entry.photoUri, {
        itemId: entry.itemId,
        latitude: entry.latitude,
        longitude: entry.longitude,
        scope,
      });
    }
    return true;
  } catch {
    return false;
  }
}

// Saves one checklist answer local-first. Always resolves (never throws)
// — the caller can immediately move on; the queue is what carries the
// write through a bad connection. Returns whether it made it to the
// server on this attempt (used only for optional immediate UI feedback,
// never to decide whether to keep going).
export async function queueResponse(
  inspectionId: string,
  itemId: string,
  value: ResponseValue,
  scope: "staff" | "operator",
): Promise<{ synced: boolean }> {
  const state = await readQueue(inspectionId);
  // Replacing an existing queued response for the same item — no point
  // keeping a stale draft answer queued once the operator changed it
  // again before the first attempt even synced.
  const filtered = state.entries.filter((e) => !(e.kind === "response" && e.itemId === itemId));
  const entry: QueuedResponse = {
    kind: "response",
    id: randomId(),
    itemId,
    value,
    queuedAt: new Date().toISOString(),
  };
  const nextState: QueueState = { ...state, entries: [...filtered, entry] };
  await writeQueue(inspectionId, nextState);

  if (await isOnline()) {
    const ok = await trySync(inspectionId, entry, scope);
    if (ok) {
      const after = await readQueue(inspectionId);
      await writeQueue(inspectionId, {
        entries: after.entries.filter((e) => e.id !== entry.id),
        syncedCount: after.syncedCount + 1,
      });
      return { synced: true };
    }
  }
  return { synced: false };
}

export async function queueMedia(
  inspectionId: string,
  photoUri: string,
  options: { itemId?: string; latitude?: number; longitude?: number },
  scope: "staff" | "operator",
): Promise<{ synced: boolean }> {
  const state = await readQueue(inspectionId);
  const entry: QueuedMedia = {
    kind: "media",
    id: randomId(),
    itemId: options.itemId,
    photoUri,
    latitude: options.latitude,
    longitude: options.longitude,
    queuedAt: new Date().toISOString(),
  };
  await writeQueue(inspectionId, { ...state, entries: [...state.entries, entry] });

  if (await isOnline()) {
    const ok = await trySync(inspectionId, entry, scope);
    if (ok) {
      const after = await readQueue(inspectionId);
      await writeQueue(inspectionId, {
        entries: after.entries.filter((e) => e.id !== entry.id),
        syncedCount: after.syncedCount + 1,
      });
      return { synced: true };
    }
  }
  return { synced: false };
}

// Retries every queued entry for an inspection, in order. Called on
// NetInfo reconnect and whenever the capture screen regains focus — a
// dropped connection during capture must resolve itself automatically
// once the signal comes back, never require the operator to notice and
// manually retry each item (item 20 of the spec).
export async function flushQueue(
  inspectionId: string,
  scope: "staff" | "operator",
): Promise<QueueStatus> {
  if (!(await isOnline())) return getQueueStatus(inspectionId);

  const state = await readQueue(inspectionId);
  const stillPending: QueueEntry[] = [];
  let syncedThisRun = 0;
  for (const entry of state.entries) {
    const ok = await trySync(inspectionId, entry, scope);
    if (ok) syncedThisRun += 1;
    else stillPending.push(entry);
  }
  await writeQueue(inspectionId, {
    entries: stillPending,
    syncedCount: state.syncedCount + syncedThisRun,
  });
  return getQueueStatus(inspectionId);
}

export function subscribeToReconnect(onReconnect: () => void): () => void {
  let wasOffline = false;
  return NetInfo.addEventListener((state) => {
    const offline = state.isConnected === false;
    if (wasOffline && !offline) onReconnect();
    wasOffline = offline;
  });
}

export async function clearQueue(inspectionId: string): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY_PREFIX + inspectionId);
}
