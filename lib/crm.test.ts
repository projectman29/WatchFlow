import { describe, expect, it } from 'vitest';
import { getLeadSourceSummary, getPipelineSummary, hasValidLeadLossReason, LEAD_LOSS_REASONS, LEAD_STAGES, orderByStage } from './crm';

describe('CRM pipeline', () => {
  it('requires one of the configured reasons when a lead is lost', () => {
    expect(LEAD_LOSS_REASONS).toEqual([
      'Дорого',
      'Передумал',
      'Не отвечает',
      'Выбрал конкурента',
      'Нет нужного товара',
      'Другое',
    ]);
    expect(hasValidLeadLossReason('LOST')).toBe(false);
    expect(hasValidLeadLossReason('LOST', 'Дорого')).toBe(true);
    expect(hasValidLeadLossReason('NEW')).toBe(true);
  });

  it('orders lead stages in the expected sales funnel', () => {
    expect(LEAD_STAGES).toEqual([
      'NEW',
      'CONTACTED',
      'INTERESTED',
      'WAITING_PAYMENT',
      'WON',
      'LOST',
    ]);

    expect(orderByStage('WAITING_PAYMENT')).toBeGreaterThan(orderByStage('CONTACTED'));
    expect(orderByStage('LOST')).toBeGreaterThan(orderByStage('INTERESTED'));
  });

  it('calculates pipeline counts from leads', () => {
    const summary = getPipelineSummary([
      { status: 'NEW' },
      { status: 'CONTACTED' },
      { status: 'INTERESTED' },
      { status: 'WAITING_PAYMENT' },
      { status: 'WON' },
      { status: 'LOST' },
    ]);

    expect(summary.total).toBe(6);
    expect(summary.won).toBe(1);
    expect(summary.lost).toBe(1);
    expect(summary.inProgress).toBe(4);
  });

  it('groups leads by source for sales analysis', () => {
    const summary = getLeadSourceSummary([
      { source: 'Instagram' },
      { source: 'Instagram' },
      { source: 'Meta Ads' },
      { source: 'Рекомендации' },
      { source: 'Повторный клиент' },
    ]);

    expect(summary).toEqual([
      { source: 'Instagram', count: 2 },
      { source: 'Meta Ads', count: 1 },
      { source: 'Рекомендации', count: 1 },
      { source: 'Повторный клиент', count: 1 },
    ]);
  });
});
