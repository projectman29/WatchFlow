import { describe, expect, it } from 'vitest';
import {
  INVENTORY_MOVEMENT_TYPES,
  applyInventoryMovement,
  canReserveStock,
  getLowStockItems,
} from './inventory';

describe('warehouse logic', () => {
  it('defines the required movement types', () => {
    expect(INVENTORY_MOVEMENT_TYPES).toContain('INCOMING');
    expect(INVENTORY_MOVEMENT_TYPES).toContain('PRODUCTION');
    expect(INVENTORY_MOVEMENT_TYPES).toContain('RETURN');
    expect(INVENTORY_MOVEMENT_TYPES).toContain('ADJUSTMENT');
  });

  it('allows stock reservation only when quantity is available', () => {
    expect(canReserveStock({ id: '1', sku: 'STRAP-BLACK-01', stock: 15, reorderLevel: 5 }, 10)).toBe(true);
    expect(canReserveStock({ id: '1', sku: 'STRAP-BLACK-01', stock: 15, reorderLevel: 5 }, 16)).toBe(false);
  });

  it('decreases inventory only for production movements that fit available stock', () => {
    const result = applyInventoryMovement({
      id: '1',
      sku: 'STRAP-BLACK-01',
      stock: 18,
      reorderLevel: 5,
      category: 'strap',
      name: 'Ремешок Black',
    }, 10, 'PRODUCTION', 'ORD-1001');

    expect(result.ok).toBe(true);
    expect(result.stock).toBe(8);
    expect(result.movement).not.toBeNull();
    if (!result.movement) {
      throw new Error('Expected movement record to be created');
    }
    expect(result.movement.type).toBe('PRODUCTION');
  });

  it('flags low stock items with a warning', () => {
    const items = [
      { id: '1', sku: 'STRAP-BLACK-01', stock: 4, reorderLevel: 5, category: 'strap', name: 'Ремешок Black' },
      { id: '2', sku: 'CASE-001', stock: 80, reorderLevel: 12, category: 'case', name: 'Корпус' },
    ];

    expect(getLowStockItems(items)).toHaveLength(1);
    expect(getLowStockItems(items)[0].sku).toBe('STRAP-BLACK-01');
  });
});
