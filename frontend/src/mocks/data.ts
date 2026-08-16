// Mocked domain data for Shinã I.A. — used until the real api.shinaia.com.br
// contracts are audited/provided. Shapes here mirror the typed interfaces in
// src/api/shinaia.ts so swapping to live data is a drop-in change.

export const MOCK = {
  bootstrap: {
    user: { id: 'op-001', name: 'Comandante Shinã', email: 'ops@shinaia.com.br', role: 'operations_manager' },
    org: { id: 'org-001', name: 'Shinã Logística', plan: 'Enterprise' },
    kpis: {
      fleet_health: 92,
      active_vehicles: 38,
      total_vehicles: 44,
      open_alerts: 5,
      pending_tasks: 12,
      utilization: 0.78,
    },
  },

  operations: {
    hero: { label: 'Saúde da Frota', value: 92, unit: '%', trend: +3.2, gradient: 'neural' },
    tiles: [
      { id: 'active', label: 'Veículos Ativos', value: '38/44', icon: 'bus', trend: +2 },
      { id: 'alerts', label: 'Alertas Abertos', value: '5', icon: 'warning', trend: -1, tone: 'warning' },
      { id: 'tasks', label: 'Tarefas Pendentes', value: '12', icon: 'checkbox', trend: +4 },
      { id: 'util', label: 'Utilização', value: '78%', icon: 'speedometer', trend: +5 },
    ],
    activity: [
      { id: 'a1', title: 'Rota SP-RJ iniciada', asset: 'SHN-1042', time: '08:12', tone: 'info' },
      { id: 'a2', title: 'Alerta de temperatura', asset: 'SHN-0781', time: '07:54', tone: 'warning' },
      { id: 'a3', title: 'Manutenção concluída', asset: 'SHN-0330', time: '07:20', tone: 'success' },
      { id: 'a4', title: 'Novo operador vinculado', asset: 'OP-221', time: '06:58', tone: 'info' },
    ],
    weekly_load: [42, 55, 61, 48, 73, 66, 58], // for bar chart
  },

  assets: [
    { id: 'SHN-1042', model: 'Volvo FH 540', type: 'Caminhão', status: 'active', health: 96, plate: 'RTA1B23', odo_km: 182340, photo: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400' },
    { id: 'SHN-0781', model: 'Scania R450', type: 'Caminhão', status: 'alert', health: 61, plate: 'RTB2C34', odo_km: 254110, photo: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=400' },
    { id: 'SHN-0330', model: 'Mercedes Actros', type: 'Caminhão', status: 'maintenance', health: 74, plate: 'RTC3D45', odo_km: 98720, photo: 'https://images.unsplash.com/photo-1586191582151-f73872dfd183?w=400' },
    { id: 'SHN-0912', model: 'Iveco Daily', type: 'Van', status: 'active', health: 88, plate: 'RTD4E56', odo_km: 45210, photo: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?w=400' },
    { id: 'SHN-0455', model: 'Ford Cargo', type: 'Caminhão', status: 'idle', health: 90, plate: 'RTE5F67', odo_km: 132980, photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' },
    { id: 'SHN-1188', model: 'VW Delivery', type: 'Van', status: 'active', health: 82, plate: 'RTF6G78', odo_km: 67450, photo: 'https://images.unsplash.com/photo-1617196701537-7329482cc9fe?w=400' },
  ],

  tracking: [
    { id: 'SHN-1042', label: 'Volvo FH 540', status: 'active', lat: -23.5505, lng: -46.6333, speed: 78, city: 'São Paulo, SP', x: 0.34, y: 0.42 },
    { id: 'SHN-0781', label: 'Scania R450', status: 'alert', lat: -22.9068, lng: -43.1729, speed: 0, city: 'Rio de Janeiro, RJ', x: 0.62, y: 0.55 },
    { id: 'SHN-0912', label: 'Iveco Daily', status: 'active', lat: -19.9167, lng: -43.9345, speed: 54, city: 'Belo Horizonte, MG', x: 0.55, y: 0.30 },
    { id: 'SHN-0455', label: 'Ford Cargo', status: 'idle', lat: -25.4284, lng: -49.2733, speed: 0, city: 'Curitiba, PR', x: 0.28, y: 0.70 },
  ],

  financial: {
    period: 'Junho 2026',
    revenue: 482300,
    expenses: 311750,
    net: 170550,
    margin: 0.354,
    revenue_series: [320, 360, 410, 395, 440, 482],
    expense_series: [250, 270, 300, 290, 305, 311],
    breakdown: [
      { id: 'fuel', label: 'Combustível', value: 128400, tone: 'warning' },
      { id: 'maint', label: 'Manutenção', value: 74200, tone: 'info' },
      { id: 'salary', label: 'Operadores', value: 89100, tone: 'brand' },
      { id: 'other', label: 'Outros', value: 20050, tone: 'muted' },
    ],
  },

  operators: [
    { id: 'OP-221', name: 'Marcos Almeida', role: 'Motorista Sênior', status: 'on_route', rating: 4.9, license: 'E', assignedAsset: 'SHN-1042' },
    { id: 'OP-118', name: 'Julia Ferreira', role: 'Motorista', status: 'available', rating: 4.7, license: 'D', assignedAsset: null },
    { id: 'OP-090', name: 'Ricardo Souza', role: 'Motorista', status: 'off', rating: 4.5, license: 'E', assignedAsset: null },
    { id: 'OP-305', name: 'Beatriz Lima', role: 'Motorista Sênior', status: 'on_route', rating: 4.8, license: 'E', assignedAsset: 'SHN-0912' },
  ],

  clients: [
    { id: 'CLI-01', name: 'Distribuidora Norte', segment: 'Varejo', activeContracts: 3, revenue: 210400, status: 'active' },
    { id: 'CLI-02', name: 'AgroSul Cooperativa', segment: 'Agro', activeContracts: 2, revenue: 138900, status: 'active' },
    { id: 'CLI-03', name: 'TechParts Ltda', segment: 'Indústria', activeContracts: 1, revenue: 66200, status: 'pending' },
    { id: 'CLI-04', name: 'FarmaExpress', segment: 'Saúde', activeContracts: 4, revenue: 298750, status: 'active' },
  ],

  contracts: [
    { id: 'CTR-1201', client: 'Distribuidora Norte', value: 84000, start: '2026-01-10', end: '2026-12-31', status: 'active' },
    { id: 'CTR-1202', client: 'AgroSul Cooperativa', value: 62000, start: '2026-03-01', end: '2026-09-30', status: 'active' },
    { id: 'CTR-1203', client: 'TechParts Ltda', value: 45000, start: '2026-06-01', end: '2027-05-31', status: 'pending' },
    { id: 'CTR-1180', client: 'FarmaExpress', value: 120000, start: '2025-11-01', end: '2026-10-31', status: 'active' },
  ],

  documents: [
    { id: 'DOC-01', name: 'CRLV — SHN-1042', type: 'Licenciamento', size: '1.2 MB', updated: '2026-05-12', status: 'valid' },
    { id: 'DOC-02', name: 'Apólice de Seguro Frota', type: 'Seguro', size: '3.4 MB', updated: '2026-04-02', status: 'valid' },
    { id: 'DOC-03', name: 'Contrato CTR-1203', type: 'Contrato', size: '820 KB', updated: '2026-06-01', status: 'pending' },
    { id: 'DOC-04', name: 'ANTT — Certificado', type: 'Regulatório', size: '640 KB', updated: '2026-02-20', status: 'expiring' },
  ],

  notifications: [
    { id: 'N1', title: 'Manutenção preventiva agendada', body: 'SHN-0330 entra em revisão amanhã às 09:00.', time: 'há 12 min', tone: 'info', read: false },
    { id: 'N2', title: 'Alerta crítico de sensor', body: 'Temperatura acima do limite em SHN-0781.', time: 'há 34 min', tone: 'warning', read: false },
    { id: 'N3', title: 'Documento expirando', body: 'Certificado ANTT expira em 15 dias.', time: 'há 2 h', tone: 'warning', read: true },
    { id: 'N4', title: 'Pagamento recebido', body: 'FarmaExpress quitou a fatura de junho.', time: 'há 5 h', tone: 'success', read: true },
  ],
};
