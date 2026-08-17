// Mocked domain data for Shinã IA — DEMO scenario:
// "Shinã Rent" — locadora de veículos para motoristas de aplicativo.
// 8 veículos | locação SEMANAL (R$750 popular / R$1.000 luxo) | 6 meses de operação.
// Shapes mirror the typed interfaces in src/api/shinaia.ts so switching to the
// live api.shinaia.com.br is a drop-in change.

export const MOCK = {
  bootstrap: {
    user: { id: 'op-001', name: 'Gestor Shinã', email: 'gestor@shinaia.com.br', role: 'fleet_manager' },
    org: { id: 'org-001', name: 'Shinã Rent — Locadora para Apps', plan: 'Enterprise' },
    kpis: {
      fleet_health: 88,
      active_vehicles: 6,
      total_vehicles: 8,
      open_alerts: 3,
      pending_tasks: 4,
      utilization: 0.75,
    },
  },

  operations: {
    hero: { label: 'Ocupação da Frota', value: 88, unit: '%', trend: 6.5, gradient: 'neural' },
    tiles: [
      { id: 'rented', label: 'Veículos Alugados', value: '6/8', icon: 'car', trend: 1 },
      { id: 'weekly', label: 'Receita Semanal', value: 'R$ 5.250', icon: 'cash', trend: 2 },
      { id: 'contracts', label: 'Contratos Ativos', value: '6', icon: 'document-text', trend: 1 },
      { id: 'default', label: 'Inadimplência', value: '1', icon: 'alert-circle', trend: -1, tone: 'warning' },
    ],
    activity: [
      { id: 'a1', title: 'Locação renovada +1 semana', asset: 'Corolla • RTF6G78', time: '09:10', tone: 'success' },
      { id: 'a2', title: 'Pagamento semanal recebido (R$ 750)', asset: 'HB20 • Julia F.', time: '08:40', tone: 'success' },
      { id: 'a3', title: 'Alerta: revisão dos 120k km', asset: 'Voyage • RTC3D45', time: '08:05', tone: 'warning' },
      { id: 'a4', title: 'Contrato finalizado — carro devolvido', asset: 'Kwid • Anderson M.', time: '07:30', tone: 'info' },
      { id: 'a5', title: 'Novo motorista aprovado', asset: 'Cadastro • CNH categoria B', time: '07:00', tone: 'info' },
    ],
    weekly_load: [70, 75, 88, 82, 90, 86, 88], // ocupação % — últimos 7 dias
  },

  // 8 veículos — 5 populares (R$750/sem) + 3 luxo (R$1.000/sem)
  assets: [
    { id: 'SHN-01', model: 'Chevrolet Onix 1.0', type: 'Hatch', category: 'popular', weekly_rate: 750, status: 'rented', health: 94, plate: 'RTA1B23', odo_km: 68200, photo: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400' },
    { id: 'SHN-02', model: 'Hyundai HB20 1.0', type: 'Hatch', category: 'popular', weekly_rate: 750, status: 'rented', health: 88, plate: 'RTB2C34', odo_km: 82400, photo: 'https://images.unsplash.com/photo-1541348263662-e068662d82af?w=400' },
    { id: 'SHN-03', model: 'VW Voyage 1.6', type: 'Sedan', category: 'popular', weekly_rate: 750, status: 'rented', health: 79, plate: 'RTC3D45', odo_km: 121500, photo: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=400' },
    { id: 'SHN-04', model: 'Renault Kwid', type: 'Hatch', category: 'popular', weekly_rate: 750, status: 'available', health: 96, plate: 'RTD4E56', odo_km: 22100, photo: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400' },
    { id: 'SHN-05', model: 'Fiat Cronos 1.3', type: 'Sedan', category: 'popular', weekly_rate: 750, status: 'maintenance', health: 61, plate: 'RTE5F67', odo_km: 99300, photo: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400' },
    { id: 'SHN-06', model: 'Toyota Corolla 2.0', type: 'Sedan', category: 'luxo', weekly_rate: 1000, status: 'rented', health: 97, plate: 'RTF6G78', odo_km: 41800, photo: 'https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=400' },
    { id: 'SHN-07', model: 'Honda Civic', type: 'Sedan', category: 'luxo', weekly_rate: 1000, status: 'rented', health: 90, plate: 'RTG7H89', odo_km: 55600, photo: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400' },
    { id: 'SHN-08', model: 'Jeep Compass', type: 'SUV', category: 'luxo', weekly_rate: 1000, status: 'rented', health: 85, plate: 'RTH8I90', odo_km: 38900, photo: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400' },
  ],

  // Veículos alugados que estão rodando agora
  tracking: [
    { id: 'SHN-06', label: 'Toyota Corolla • Marcos', status: 'active', lat: -23.5505, lng: -46.6333, speed: 42, city: 'São Paulo, SP', x: 0.40, y: 0.45 },
    { id: 'SHN-02', label: 'Hyundai HB20 • Julia', status: 'active', lat: -23.5629, lng: -46.6544, speed: 28, city: 'São Paulo, SP', x: 0.30, y: 0.55 },
    { id: 'SHN-08', label: 'Jeep Compass • Beatriz', status: 'active', lat: -23.5015, lng: -46.6291, speed: 51, city: 'Guarulhos, SP', x: 0.58, y: 0.32 },
    { id: 'SHN-03', label: 'VW Voyage • Ricardo', status: 'idle', lat: -23.5893, lng: -46.6588, speed: 0, city: 'Santo André, SP', x: 0.66, y: 0.66 },
  ],

  financial: {
    period: 'Junho 2026',
    revenue: 22680,
    expenses: 9450,
    net: 13230,
    margin: 0.583,
    revenue_series: [8, 12, 16, 19, 21, 23], // 6 meses (milhares) — frota crescendo de 3 → 8 carros
    expense_series: [5, 6, 7, 8, 8, 9],
    breakdown: [
      { id: 'maint', label: 'Manutenção', value: 3200, tone: 'info' },
      { id: 'insurance', label: 'Seguro da Frota', value: 2100, tone: 'warning' },
      { id: 'financing', label: 'Parcelas dos Veículos', value: 2500, tone: 'brand' },
      { id: 'docs', label: 'IPVA / Licenciamento', value: 1150, tone: 'muted' },
      { id: 'other', label: 'Outros', value: 500, tone: 'muted' },
    ],
  },

  // Motoristas de aplicativo que operam os veículos alugados
  operators: [
    { id: 'OP-01', name: 'Marcos Almeida', role: 'Motorista • Uber Black', status: 'on_route', rating: 4.9, license: 'B', assignedAsset: 'RTF6G78' },
    { id: 'OP-02', name: 'Julia Ferreira', role: 'Motorista • 99', status: 'on_route', rating: 4.8, license: 'B', assignedAsset: 'RTB2C34' },
    { id: 'OP-03', name: 'Beatriz Lima', role: 'Motorista • Uber Comfort', status: 'on_route', rating: 4.9, license: 'B', assignedAsset: 'RTH8I90' },
    { id: 'OP-04', name: 'Ricardo Souza', role: 'Motorista • Uber X', status: 'available', rating: 4.6, license: 'B', assignedAsset: 'RTC3D45' },
    { id: 'OP-05', name: 'Anderson Melo', role: 'Motorista • InDrive', status: 'off', rating: 4.4, license: 'B', assignedAsset: null },
    { id: 'OP-06', name: 'Patrícia Gomes', role: 'Motorista • 99', status: 'off', rating: 4.7, license: 'B', assignedAsset: null },
  ],

  // Carteira de clientes (titulares dos contratos de locação)
  clients: [
    { id: 'CLI-01', name: 'Marcos Almeida', segment: 'Uber Black', activeContracts: 1, revenue: 26000, status: 'active' },
    { id: 'CLI-02', name: 'Julia Ferreira', segment: '99', activeContracts: 1, revenue: 15750, status: 'active' },
    { id: 'CLI-03', name: 'Beatriz Lima', segment: 'Uber Comfort', activeContracts: 1, revenue: 24000, status: 'active' },
    { id: 'CLI-04', name: 'Ricardo Souza', segment: 'Uber X', activeContracts: 1, revenue: 12750, status: 'active' },
    { id: 'CLI-05', name: 'Anderson Melo', segment: 'InDrive', activeContracts: 1, revenue: 6750, status: 'pending' },
    { id: 'CLI-06', name: 'Patrícia Gomes', segment: '99', activeContracts: 0, revenue: 18000, status: 'inadimplente' },
  ],

  // Contratos de locação SEMANAL — ativos, pendente e finalizados
  contracts: [
    { id: 'CTR-2041', client: 'Marcos Almeida', vehicle: 'Toyota Corolla', plan: 'Semanal', value: 1000, start: '2026-02-01', end: '2026-12-31', status: 'active' },
    { id: 'CTR-2042', client: 'Julia Ferreira', vehicle: 'Hyundai HB20', plan: 'Semanal', value: 750, start: '2026-03-10', end: '2026-12-31', status: 'active' },
    { id: 'CTR-2043', client: 'Beatriz Lima', vehicle: 'Jeep Compass', plan: 'Semanal', value: 1000, start: '2026-03-22', end: '2026-12-31', status: 'active' },
    { id: 'CTR-2044', client: 'Ricardo Souza', vehicle: 'VW Voyage', plan: 'Semanal', value: 750, start: '2026-04-05', end: '2026-12-31', status: 'active' },
    { id: 'CTR-2045', client: 'Anderson Melo', vehicle: 'Renault Kwid', plan: 'Semanal', value: 750, start: '2026-06-14', end: '2026-12-31', status: 'pending' },
    { id: 'CTR-2039', client: 'Diego Santos', vehicle: 'Chevrolet Onix', plan: 'Semanal', value: 750, start: '2025-12-01', end: '2026-03-01', status: 'finalizado' },
    { id: 'CTR-2040', client: 'Carla Nunes', vehicle: 'Honda Civic', plan: 'Semanal', value: 1000, start: '2026-01-08', end: '2026-04-08', status: 'finalizado' },
    { id: 'CTR-2038', client: 'Rafael Dias', vehicle: 'Fiat Cronos', plan: 'Semanal', value: 750, start: '2025-12-15', end: '2026-03-15', status: 'finalizado' },
  ],

  documents: [
    { id: 'DOC-01', name: 'CRLV — Onix RTA1B23', type: 'Licenciamento', size: '1.1 MB', updated: '2026-05-12', status: 'valid' },
    { id: 'DOC-02', name: 'Apólice de Seguro da Frota', type: 'Seguro', size: '3.4 MB', updated: '2026-04-02', status: 'valid' },
    { id: 'DOC-03', name: 'Contrato de Locação CTR-2045', type: 'Contrato', size: '780 KB', updated: '2026-06-14', status: 'pending' },
    { id: 'DOC-04', name: 'Vistoria Cautelar — Fiat Cronos', type: 'Regulatório', size: '640 KB', updated: '2026-02-20', status: 'expiring' },
  ],

  notifications: [
    { id: 'N1', title: 'Pagamento semanal recebido', body: 'Marcos Almeida quitou a semana (R$ 1.000) do Corolla.', time: 'há 12 min', tone: 'success', read: false },
    { id: 'N2', title: 'Manutenção agendada', body: 'Fiat Cronos entra em revisão amanhã às 09:00.', time: 'há 40 min', tone: 'info', read: false },
    { id: 'N3', title: 'Inadimplência detectada', body: 'Patrícia Gomes está com 1 semana de locação em atraso.', time: 'há 2 h', tone: 'warning', read: false },
    { id: 'N4', title: 'Contrato finalizado', body: 'Renault Kwid devolvido — disponível para nova locação.', time: 'há 5 h', tone: 'success', read: true },
  ],
};
