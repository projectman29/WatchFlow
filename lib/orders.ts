export const ORDER_STATUS_FLOW = [
  'NEW',
  'WAITING_DESIGN',
  'DESIGN_IN_PROGRESS',
  'WAITING_CLIENT_APPROVAL',
  'DESIGN_APPROVED',
  'WAITING_PRODUCTION',
  'IN_PRODUCTION',
  'QUALITY_CONTROL',
  'READY_FOR_PACKING',
  'READY_FOR_SHIPMENT',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый',
  WAITING_DESIGN: 'Ожидает дизайна',
  DESIGN_IN_PROGRESS: 'Дизайн в работе',
  WAITING_CLIENT_APPROVAL: 'Ожидает согласования',
  DESIGN_APPROVED: 'Дизайн подтверждён',
  WAITING_PRODUCTION: 'Передан в производство',
  IN_PRODUCTION: 'В производстве',
  QUALITY_CONTROL: 'Контроль качества',
  READY_FOR_PACKING: 'Готов к упаковке',
  READY_FOR_SHIPMENT: 'Готов к отправке',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export function getOrderStatusIndex(status: string): number {
  return ORDER_STATUS_FLOW.indexOf(status as (typeof ORDER_STATUS_FLOW)[number]);
}

export function getOrderProgressPercent(status: string): number {
  const index = getOrderStatusIndex(status);
  if (index === -1) return 0;

  const percent = ((index + 1) / ORDER_STATUS_FLOW.length) * 100;
  return Math.round(percent);
}
