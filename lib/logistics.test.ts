import { describe, expect, it } from 'vitest';
import { LOGISTICS_STATUSES, getLogisticsStatusIndex, getReadyForShipmentOrders, readyShipments } from './logistics';

describe('logistics workflow', () => {
  it('contains the required shipment lifecycle', () => {
    expect(LOGISTICS_STATUSES[0]).toBe('READY_FOR_SHIPMENT');
    expect(LOGISTICS_STATUSES).toContain('SHIPPED');
    expect(LOGISTICS_STATUSES).toContain('DELIVERED');
  });

  it('keeps ready-to-ship orders separate from closed shipments', () => {
    expect(getReadyForShipmentOrders(readyShipments)).toHaveLength(2);
    expect(getReadyForShipmentOrders(readyShipments).every((item) => item.status === 'READY_FOR_SHIPMENT')).toBe(true);
  });

  it('calculates stage order correctly in the delivery pipeline', () => {
    expect(getLogisticsStatusIndex('READY_FOR_SHIPMENT')).toBeLessThan(getLogisticsStatusIndex('SHIPPED'));
    expect(getLogisticsStatusIndex('SHIPPED')).toBeLessThan(getLogisticsStatusIndex('DELIVERED'));
  });
});
