export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'WAITING_PAYMENT',
  'WON',
  'LOST',
] as const;

export const LEAD_SOURCES = [
  'Instagram',
  'TikTok',
  'Meta Ads',
  'Рекомендации',
  'Повторный клиент',
  'Другое',
] as const;

export const LEAD_LOSS_REASONS = [
  'Дорого',
  'Передумал',
  'Не отвечает',
  'Выбрал конкурента',
  'Нет нужного товара',
  'Другое',
] as const;

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STAGES)[number], string> = {
  NEW: 'Новая заявка',
  CONTACTED: 'Связались',
  INTERESTED: 'Заинтересован',
  WAITING_PAYMENT: 'Ожидает оплаты',
  WON: 'Оплатил / заказ создан',
  LOST: 'Отказ',
};

export function normalizeOptionalString(value: FormDataEntryValue | string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = typeof value === 'string' ? value : String(value);
  const trimmed = normalized.trim();

  return trimmed === '' ? undefined : trimmed;
}

export function hasValidLeadLossReason(status: string, reason?: string | null): boolean {
  return status !== 'LOST' || LEAD_LOSS_REASONS.some((candidate) => candidate === reason);
}

export function shouldCreateOrderForStatus(status: string, previousStatus?: string | null): boolean {
  return status === 'WON' && previousStatus !== 'WON';
}

export const ORDER_STAGES = [
  'NEW',
  'IN_PRODUCTION',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

export function orderByStage(stage: string): number {
  return LEAD_STAGES.indexOf(stage as (typeof LEAD_STAGES)[number]);
}

export function getLeadSourceSummary(leads: Array<{ source?: string }>) {
  const sourceMap = new Map<string, number>();

  for (const lead of leads) {
    const source = lead.source ?? 'Другое';
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  }

  return Array.from(sourceMap.entries()).map(([source, count]) => ({
    source,
    count,
  }));
}

export function getPipelineSummary(leads: Array<{ status: string }>) {
  const total = leads.length;
  const won = leads.filter((lead) => lead.status === 'WON').length;
  const lost = leads.filter((lead) => lead.status === 'LOST').length;
  const inProgress = leads.filter((lead) => lead.status !== 'WON' && lead.status !== 'LOST').length;

  return {
    total,
    won,
    lost,
    inProgress,
  };
}
