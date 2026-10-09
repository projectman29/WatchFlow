import { describe, expect, it } from 'vitest';
import {
  canTransitionOrderStatus,
  getAllowedOrderStatusTransitions,
  getOrderProgressPercent,
  getOrderStatusIndex,
  ORDER_STATUS_FLOW,
} from './orders';

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

  it('allows only the next status or cancellation, and keeps terminal statuses closed', () => {
    expect(getAllowedOrderStatusTransitions('NEW')).toEqual(['WAITING_DESIGN', 'CANCELLED']);
    expect(canTransitionOrderStatus('NEW', 'WAITING_DESIGN')).toBe(true);
    expect(canTransitionOrderStatus('NEW', 'IN_PRODUCTION')).toBe(false);
    expect(getAllowedOrderStatusTransitions('COMPLETED')).toEqual([]);
    expect(getAllowedOrderStatusTransitions('CANCELLED')).toEqual([]);
  });

  it('does not count cancellation as completed workflow progress', () => {
    expect(getOrderProgressPercent('COMPLETED')).toBe(100);
    expect(getOrderProgressPercent('CANCELLED')).toBe(0);
  });
});
