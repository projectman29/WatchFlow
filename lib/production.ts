export const PRODUCTION_STATUSES = [
  'WAITING_PRODUCTION',
  'IN_PROGRESS',
  'QUALITY_CONTROL',
  'READY_FOR_PACKING',
  'READY_FOR_SHIPMENT',
  'COMPLETED',
  'REVISION',
  'CANCELLED',
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  WAITING_PRODUCTION: 'Ожидает производства',
  IN_PROGRESS: 'В производстве',
  QUALITY_CONTROL: 'Контроль качества',
  READY_FOR_PACKING: 'Готов к упаковке',
  READY_FOR_SHIPMENT: 'Готов к отправке',
  COMPLETED: 'Завершён',
  REVISION: 'На доработке',
  CANCELLED: 'Отменён',
};

export type ProductionTask = {
  id: string;
  order: string;
  client: string;
  model: string;
  master: string;
  status: ProductionStatus;
  progress: number;
  deadline: string;
  parts: string[];
  note: string;
};

export const productionQueue: ProductionTask[] = [
  {
    id: 'prod-101',
    order: 'WF-1001',
    client: 'Мария Васильева',
    model: 'Classic Steel',
    master: 'Игорь',
    status: 'IN_PROGRESS',
    progress: 62,
    deadline: '2026-09-30',
    parts: ['CASE-001', 'MECH-001', 'STRAP-BLACK-01'],
    note: 'Нужна финальная проверка шестерёнки',
  },
  {
    id: 'prod-102',
    order: 'WF-1002',
    client: 'Андрей Котов',
    model: 'Titanium Chronograph',
    master: 'Сергей',
    status: 'QUALITY_CONTROL',
    progress: 88,
    deadline: '2026-10-01',
    parts: ['CASE-004', 'MECH-007', 'BOX-002'],
    note: 'Проверка фиксации и веса корпуса',
  },
  {
    id: 'prod-103',
    order: 'WF-1003',
    client: 'Елизавета Кудряшова',
    model: 'Minimal Leather',
    master: 'Павел',
    status: 'READY_FOR_PACKING',
    progress: 100,
    deadline: '2026-09-30',
    parts: ['CASE-003', 'MECH-005', 'BAG-002'],
    note: 'Упаковка и маркировка готовы',
  },
  {
    id: 'prod-104',
    order: 'WF-1004',
    client: 'Сергей Белов',
    model: 'Urban Drift',
    master: 'Игорь',
    status: 'REVISION',
    progress: 41,
    deadline: '2026-10-02',
    parts: ['CASE-005', 'STRAP-BLACK-02', 'BELL-001'],
    note: 'Исправить шрифт и довести герметичность корпуса',
  },
  {
    id: 'prod-105',
    order: 'WF-1005',
    client: 'Анна Смирнова',
    model: 'Aster 38',
    master: 'Андрей',
    status: 'WAITING_PRODUCTION',
    progress: 12,
    deadline: '2026-10-03',
    parts: ['CASE-006', 'MECH-004', 'STRAP-LEATHER-01'],
    note: 'Назначено на ближайший слот производства',
  },
];

export function getProductionStatusIndex(status: string): number {
  return PRODUCTION_STATUSES.indexOf(status as ProductionStatus);
}

export function getProductionProgressPercent(status: string): number {
  const index = getProductionStatusIndex(status);
  if (index === -1) return 0;

  return Math.min(Math.round(((index + 1) / PRODUCTION_STATUSES.length) * 100), 100);
}

export function isProductionTaskOverdue(item: { status: ProductionStatus; deadline?: string }, referenceDate = new Date()): boolean {
  if (!item.deadline) return false;
  if (item.status === 'COMPLETED' || item.status === 'READY_FOR_SHIPMENT' || item.status === 'CANCELLED') return false;

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(`${item.deadline}T00:00:00`);
  return deadline < today;
}

export function getProductionQueueByPriority(items: ReadonlyArray<ProductionTask>) {
  return [...items].sort((a, b) => {
    const overdueDiff = Number(isProductionTaskOverdue(b)) - Number(isProductionTaskOverdue(a));
    if (overdueDiff !== 0) return overdueDiff;

    const statusDiff = getProductionStatusIndex(a.status) - getProductionStatusIndex(b.status);
    if (statusDiff !== 0) return statusDiff;

    const deadlineA = a.deadline ? new Date(`${a.deadline}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    const deadlineB = b.deadline ? new Date(`${b.deadline}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    return deadlineA - deadlineB;
  });
}

export function getProductionSummary(items: ReadonlyArray<{ status: ProductionStatus; deadline?: string }>) {
  const overdue = items.filter((item) => isProductionTaskOverdue(item)).length;

  return {
    total: items.length,
    inProgress: items.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'QUALITY_CONTROL').length,
    ready: items.filter((item) => item.status === 'READY_FOR_PACKING' || item.status === 'READY_FOR_SHIPMENT' || item.status === 'COMPLETED').length,
    revision: items.filter((item) => item.status === 'REVISION').length,
    overdue,
  };
}
