export const INVENTORY_CATEGORIES = [
  'watch',
  'case',
  'mechanism',
  'strap',
  'dial',
  'box',
  'bag',
  'packaging',
  'consumable',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_MOVEMENT_TYPES = ['INCOMING', 'OUTGOING', 'PRODUCTION', 'RETURN', 'ADJUSTMENT'] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  stock: number;
  reorderLevel: number;
  unitPrice: number;
  supplier: string;
  location: string;
  description?: string;
};

export type InventoryMovement = {
  id: string;
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  orderId?: string;
  createdAt: string;
};

export const warehouseInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    sku: 'CASE-001',
    name: 'Корпус watch classic',
    category: 'case',
    stock: 42,
    reorderLevel: 18,
    unitPrice: 850,
    supplier: 'CityParts',
    location: 'A-01',
    description: 'Стальной корпус 42mm',
  },
  {
    id: 'inv-2',
    sku: 'MECH-001',
    name: 'Механизм Quartz',
    category: 'mechanism',
    stock: 29,
    reorderLevel: 12,
    unitPrice: 1700,
    supplier: 'TimeCore',
    location: 'B-02',
    description: 'Японский механизм с батарейкой',
  },
  {
    id: 'inv-3',
    sku: 'STRAP-BLACK-01',
    name: 'Ремешок black leather',
    category: 'strap',
    stock: 21,
    reorderLevel: 34,
    unitPrice: 420,
    supplier: 'LeatherWorks',
    location: 'C-11',
    description: 'Черный кожаный ремешок',
  },
  {
    id: 'inv-4',
    sku: 'BOX-01',
    name: 'Футляр premium',
    category: 'box',
    stock: 14,
    reorderLevel: 20,
    unitPrice: 320,
    supplier: 'GiftPack',
    location: 'D-03',
    description: 'Премиальная упаковка',
  },
  {
    id: 'inv-5',
    sku: 'BAG-001',
    name: 'Пакет чехол',
    category: 'bag',
    stock: 61,
    reorderLevel: 25,
    unitPrice: 90,
    supplier: 'PackLine',
    location: 'E-07',
    description: 'Пакет и защитная ткань',
  },
  {
    id: 'inv-6',
    sku: 'DIAL-01',
    name: 'Циферблат matte',
    category: 'dial',
    stock: 9,
    reorderLevel: 12,
    unitPrice: 560,
    supplier: 'DialGrade',
    location: 'F-02',
    description: 'Матовый циферблат для премиум линейки',
  },
];

export const productBOM = [
  { product: 'WATCH-001', component: 'CASE-001', quantity: 1 },
  { product: 'WATCH-001', component: 'MECH-001', quantity: 1 },
  { product: 'WATCH-001', component: 'STRAP-BLACK-01', quantity: 1 },
  { product: 'WATCH-001', component: 'BOX-01', quantity: 1 },
  { product: 'WATCH-001', component: 'BAG-001', quantity: 1 },
  { product: 'WATCH-001', component: 'DIAL-01', quantity: 1 },
] as const;

type InventoryContext = Pick<InventoryItem, 'stock' | 'reorderLevel'> & Partial<Pick<InventoryItem, 'id' | 'sku' | 'name' | 'category'>>;

export function canReserveStock(item: InventoryContext, quantity: number): boolean {
  return item.stock >= quantity;
}

export function applyInventoryMovement(
  item: Pick<InventoryItem, 'stock' | 'reorderLevel'> & Partial<Pick<InventoryItem, 'id' | 'sku' | 'name' | 'category'>>,
  quantity: number,
  type: InventoryMovementType,
  orderId?: string,
): { ok: boolean; stock: number; movement: InventoryMovement | null; reason?: string } {
  const movement: InventoryMovement = {
    id: `movement-${Date.now()}`,
    itemId: 'item',
    type,
    quantity,
    reason: type === 'PRODUCTION' ? `Production for ${orderId ?? 'unknown'}` : type,
    orderId,
    createdAt: new Date().toISOString(),
  };

  if (['OUTGOING', 'PRODUCTION'].includes(type) && item.stock < quantity) {
    return {
      ok: false,
      stock: item.stock,
      movement: null,
      reason: 'Недостаточно товара на складе',
    };
  }

  const nextStock =
    type === 'INCOMING' || type === 'RETURN' || type === 'ADJUSTMENT' ? item.stock + quantity : item.stock - quantity;

  return {
    ok: true,
    stock: nextStock,
    movement: { ...movement, quantity },
  };
}

export function getLowStockItems(items: ReadonlyArray<Pick<InventoryItem, 'sku' | 'stock' | 'reorderLevel' | 'name'>>) {
  return items.filter((item) => item.stock <= item.reorderLevel);
}

export function getInventorySummary(items: ReadonlyArray<Pick<InventoryItem, 'stock' | 'reorderLevel'>>) {
  return {
    totalUnits: items.reduce((sum, item) => sum + item.stock, 0),
    lowStock: items.filter((item) => item.stock <= item.reorderLevel).length,
    critical: items.filter((item) => item.stock <= Math.max(0, item.reorderLevel / 2)).length,
  };
}
