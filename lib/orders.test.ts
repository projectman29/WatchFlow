import { describe, expect, it } from 'vitest';
import { getOrderStatusIndex, ORDER_STATUS_FLOW } from './orders';

describe('order lifecycle', () => {
  it('defines the business order flow', () => {
    expect(ORDER_STATUS_FLOW[0]).toBe('NEW');
    expect(ORDER_STATUS_FLOW).toContain('IN_PRODUCTION');
    expect(ORDER_STATUS_FLOW).toContain('DELIVERED');
    expect(ORDER_STATUS_FLOW).toContain('COMPLETED');
  });

  it('calculates order progression in the correct sequence', () => {
    expect(getOrderStatusIndex('NEW')).toBe(0);
    expect(getOrderStatusIndex('DESIGN_APPROVED')).toBeGreaterThan(getOrderStatusIndex('WAITING_DESIGN'));
    expect(getOrderStatusIndex('DELIVERED')).toBeLessThan(getOrderStatusIndex('COMPLETED'));
  });
});
