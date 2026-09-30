export const DESIGN_STATUSES = ['NEW', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'REVISION', 'APPROVED'] as const;

export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export const designQueue = [
  {
    id: 'd-101',
    client: 'Мария Васильева',
    order: 'WF-1001',
    status: 'NEW',
    artist: 'Ольга',
    asset: 'dial-concept-v2.png',
    version: 1,
  },
  {
    id: 'd-102',
    client: 'Андрей Котов',
    order: 'WF-1002',
    status: 'IN_PROGRESS',
    artist: 'Антон',
    asset: 'tourbillon-brief.pdf',
    version: 3,
  },
  {
    id: 'd-103',
    client: 'Елизавета Кудряшова',
    order: 'WF-1003',
    status: 'READY_FOR_REVIEW',
    artist: 'Ирина',
    asset: 'case-blueprint.jpg',
    version: 2,
  },
  {
    id: 'd-104',
    client: 'Сергей Белов',
    order: 'WF-1004',
    status: 'REVISION',
    artist: 'Ольга',
    asset: 'brand-plate.png',
    version: 4,
  },
  {
    id: 'd-105',
    client: 'Анна Смирнова',
    order: 'WF-1005',
    status: 'APPROVED',
    artist: 'Антон',
    asset: 'final-watchpack.pdf',
    version: 5,
  },
] as const;

export function getDesignSummary(items: Array<{ status: DesignStatus }>) {
  return {
    total: items.length,
    inProgress: items.filter((item) => item.status !== 'APPROVED').length,
    approved: items.filter((item) => item.status === 'APPROVED').length,
    revision: items.filter((item) => item.status === 'REVISION').length,
  };
}
