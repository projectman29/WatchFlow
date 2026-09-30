import { describe, expect, it } from 'vitest';
import { getProductionStatusIndex, PRODUCTION_STATUSES } from './production';

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
});
