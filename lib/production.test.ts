import { describe, expect, it } from 'vitest';
import { getProductionStatusIndex, getProductionSummary, PRODUCTION_STATUSES, productionQueue } from './production';

describe('production workflow', () => {
  it('contains the expected production stages', () => {
    expect(PRODUCTION_STATUSES[0]).toBe('WAITING_PRODUCTION');
    expect(PRODUCTION_STATUSES).toContain('IN_PROGRESS');
    expect(PRODUCTION_STATUSES).toContain('QUALITY_CONTROL');
    expect(PRODUCTION_STATUSES).toContain('READY_FOR_PACKING');
    expect(PRODUCTION_STATUSES).toContain('COMPLETED');
  });

  it('orders progression along the production pipeline', () => {
    expect(getProductionStatusIndex('WAITING_PRODUCTION')).toBeLessThan(getProductionStatusIndex('IN_PROGRESS'));
    expect(getProductionStatusIndex('QUALITY_CONTROL')).toBeLessThan(getProductionStatusIndex('READY_FOR_PACKING'));
    expect(getProductionStatusIndex('COMPLETED')).toBeGreaterThan(getProductionStatusIndex('IN_PROGRESS'));
  });

  it('marks overdue production orders using deadline dates', () => {
    const summary = getProductionSummary(productionQueue);

    expect(summary.total).toBe(productionQueue.length);
    expect(summary.overdue).toBeGreaterThan(0);
    expect(summary.overdue).toBeLessThanOrEqual(summary.total);
  });
});
