// M22/M23 — dev/demo-only fixture data, reachable only when areMocksAllowed()
// is true (mock-policy.ts) AND a live call actually fails. Shapes mirror the
// real endpoint responses (see shinaia-api.ts) so switching to live data
// never requires a screen change.
export const MOCK = {
  dashboard: {
    operations: { active: 12, upcoming: 3 },
    assets: { available: 18, total: 24 },
    kpis: { utilization: 74 },
  },
  operations: [
    {
      id: "demo-op-1",
      type: "delivery",
      status: "pending",
      scheduled_starts_at: new Date().toISOString(),
      scheduled_ends_at: new Date(Date.now() + 3600_000).toISOString(),
      started_at: null,
      completed_at: null,
      description: "Entrega demo",
      resources: { id: "demo-res-1", name: "Van 01", type: "vehicle", status: "available" },
      assets: null,
    },
  ],
  assets: [
    {
      id: "demo-asset-1",
      name: "Empilhadeira 01",
      serial_number: "SN-001",
      category: "equipment",
      status: "available",
      branch_id: "demo-branch",
      asset_type_id: "demo-type",
      type_name: "Empilhadeira",
    },
  ],
  contracts: [
    {
      id: "demo-contract-1",
      type: "rental",
      status: "active",
      value_amount: 1200,
      value_currency: "BRL",
      period_starts_at: new Date().toISOString(),
      period_ends_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      template_id: null,
      organization_id: "demo-org",
    },
  ],
  documents: {
    requirements: [{ id: "demo-req-1", key: "cnh", label: "CNH", is_mandatory: true }],
    documents: [],
  },
  tracking: [{ latitude: -23.55, longitude: -46.63, recorded_at: new Date().toISOString() }],
  notifications: [
    {
      id: "demo-notif-1",
      subject: "Bem-vindo",
      body: "Este é um dado de demonstração.",
      priority: "normal",
      status: "pending",
      created_at: new Date().toISOString(),
      read_at: null,
    },
  ],
  clients: [
    {
      id: "demo-org-1",
      name: "Cliente Demo",
      trade_name: null,
      type: "customer",
      document: "00000000000",
    },
  ],
  operators: [
    {
      id: "demo-op-1",
      full_name: "Operador Demo",
      document: null,
      phone: null,
      email: null,
      status: "active",
    },
  ],
  financial: {
    receivables: { amount: 5000, currency: "BRL", count: 3 },
    overdue: { amount: 1000, currency: "BRL", count: 1 },
    paid: { amount: 8000, currency: "BRL", count: 5 },
    nextDue: null,
  },
  invoices: [
    {
      id: "demo-invoice-1",
      status: "issued",
      total_amount: 1500,
      total_currency: "BRL",
      due_date: new Date(Date.now() + 5 * 86400_000).toISOString(),
      paid_at: null,
    },
  ],
  reports: {
    period: {
      start: new Date(Date.now() - 30 * 86400_000).toISOString(),
      end: new Date().toISOString(),
    },
    kpis: [
      {
        type: "operations",
        label: "Total Operations",
        value: 42,
        unit: "count",
        changePercent: 12.5,
      },
    ],
  },
};
