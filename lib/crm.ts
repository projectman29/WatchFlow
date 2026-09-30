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
