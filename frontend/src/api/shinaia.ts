// Typed data-access layer for Shinã I.A.
//
// IMPORTANT: This app does NOT own a backend. All data comes from the external
// Shinã API at EXPO_PUBLIC_SHINAIA_API_URL. Until the real /mobile/bootstrap and
// module contracts are audited/provided, each adapter tries the live endpoint
// (Bearer = Supabase access_token) and transparently falls back to typed mocks.
//
// Swapping to live data later = delete the mock fallback / adjust the `map*`
// functions. No screen code needs to change.

import { supabase, supabaseConfigured } from '@/src/lib/supabase';
import { MOCK } from '@/src/mocks/data';

const API = (process.env.EXPO_PUBLIC_SHINAIA_API_URL || '').replace(/\/$/, '');
// Live fetch stays OFF until the real Shinã API/CORS is ready. Flip
// EXPO_PUBLIC_USE_LIVE_API=1 (with Supabase keys) to switch every adapter to
// live data — no screen changes needed.
const USE_LIVE = process.env.EXPO_PUBLIC_USE_LIVE_API === '1';

export type Kpis = typeof MOCK.bootstrap.kpis;
export type Bootstrap = typeof MOCK.bootstrap;
export type OperationsData = typeof MOCK.operations;
export type Asset = (typeof MOCK.assets)[number];
export type TrackedAsset = (typeof MOCK.tracking)[number];
export type FinancialData = typeof MOCK.financial;
export type Operator = (typeof MOCK.operators)[number];
export type Client = (typeof MOCK.clients)[number];
export type Contract = (typeof MOCK.contracts)[number];
export type DocItem = (typeof MOCK.documents)[number];
export type NotificationItem = (typeof MOCK.notifications)[number];

async function authToken(): Promise<string | null> {
  if (!supabaseConfigured || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Generic fetch helper. Returns live data when the external API responds OK,
 * otherwise resolves with the provided mock (never throws for read paths).
 */
async function get<T>(path: string, mock: T): Promise<{ data: T; source: 'live' | 'mock' }> {
  if (!USE_LIVE || !API) {
    await new Promise((r) => setTimeout(r, 300));
    return { data: mock, source: 'mock' };
  }
  try {
    const token = await authToken();
    const res = await fetch(`${API}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as T;
    return { data: json, source: 'live' };
  } catch {
    // Simulate light latency so skeletons are visible in the demo.
    await new Promise((r) => setTimeout(r, 350));
    return { data: mock, source: 'mock' };
  }
}

export const shinaia = {
  bootstrap: () => get<Bootstrap>('/mobile/bootstrap', MOCK.bootstrap),
  operations: () => get<OperationsData>('/operations/overview', MOCK.operations),
  assets: () => get<Asset[]>('/assets', MOCK.assets),
  asset: (id: string) => get<Asset | undefined>(`/assets/${id}`, MOCK.assets.find((a) => a.id === id)),
  tracking: () => get<TrackedAsset[]>('/tracking/positions', MOCK.tracking),
  financial: () => get<FinancialData>('/financial/overview', MOCK.financial),
  operators: () => get<Operator[]>('/operators', MOCK.operators),
  clients: () => get<Client[]>('/clients', MOCK.clients),
  contracts: () => get<Contract[]>('/contracts', MOCK.contracts),
  documents: () => get<DocItem[]>('/documents', MOCK.documents),
  notifications: () => get<NotificationItem[]>('/notifications', MOCK.notifications),
};
