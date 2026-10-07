import { describe, expect, it } from 'vitest';
import { canTransitionOrderWorkflow, getOrderStatusIndex, ORDER_STATUS_FLOW } from './orders';

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

  it('keeps design and production transitions within each role', () => {
    expect(canTransitionOrderWorkflow('designer', 'WAITING_DESIGN', 'DESIGN_IN_PROGRESS')).toBe(true);
    expect(canTransitionOrderWorkflow('designer', 'WAITING_CLIENT_APPROVAL', 'DESIGN_APPROVED')).toBe(true);
    expect(canTransitionOrderWorkflow('designer', 'IN_PRODUCTION', 'QUALITY_CONTROL')).toBe(false);
    expect(canTransitionOrderWorkflow('master', 'IN_PRODUCTION', 'QUALITY_CONTROL')).toBe(true);
    expect(canTransitionOrderWorkflow('master', 'WAITING_DESIGN', 'DESIGN_IN_PROGRESS')).toBe(false);
    expect(canTransitionOrderWorkflow('sales', 'IN_PRODUCTION', 'QUALITY_CONTROL')).toBe(false);
  });
});
