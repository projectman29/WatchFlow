export const LOGISTICS_STATUSES = ['READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED', 'RETURNED'] as const;

export type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];

export const LOGISTICS_STATUS_LABELS: Record<string, string> = {
  READY_FOR_SHIPMENT: 'Готов к отправке',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  RETURNED: 'Возврат',
};

export type ReadyShipment = {
  id: string;
  order: string;
  client: string;
  phone: string;
  city: string;
  address: string;
  amount: number;
  deliveryType: string;
  cashOnDelivery: number;
  status: LogisticsStatus;
  courier: string;
  service: string;
  tracking: string;
  note: string;
};

export const readyShipments: ReadyShipment[] = [
  {
    id: 'ship-101',
    order: 'WF-1003',
    client: 'Елизавета Кудряшова',
    phone: '+7 701 111 22 33',
    city: 'Астана',
    address: 'пр. Мангилик Ел 12',
    amount: 2900,
    deliveryType: 'Курьер по городу',
    cashOnDelivery: 2900,
    status: 'READY_FOR_SHIPMENT',
    courier: 'Сергей',
    service: 'CityExpress',
    tracking: 'KZ-10482',
    note: 'Требуется подтверждение адреса',
  },
  {
    id: 'ship-102',
    order: 'WF-1001',
    client: 'Мария Васильева',
    phone: '+7 707 335 90 12',
    city: 'Алматы',
    address: 'ул. Абая 15, кв. 28',
    amount: 4200,
    deliveryType: 'Доставка по Казахстану',
    cashOnDelivery: 2100,
    status: 'READY_FOR_SHIPMENT',
    courier: 'Алексей',
    service: 'KazPost',
    tracking: 'KZ-11890',
    note: 'Проверить время вручения',
  },
  {
    id: 'ship-103',
    order: 'WF-1006',
    client: 'Иван Петров',
    phone: '+7 702 998 21 11',
    city: 'Тараз',
    address: 'ул. Ленина 44',
    amount: 3100,
    deliveryType: 'Доставка по Казахстану',
    cashOnDelivery: 3100,
    status: 'SHIPPED',
    courier: 'Алина',
    service: 'KazPost',
    tracking: 'KZ-12440',
    note: 'В пути',
  },
  {
    id: 'ship-104',
    order: 'WF-1007',
    client: 'Олег Соколов',
    phone: '+7 701 440 58 30',
    city: 'Уральск',
    address: 'ул. Сейфуллина 7',
    amount: 2600,
    deliveryType: 'Самовывоз',
    cashOnDelivery: 0,
    status: 'DELIVERED',
    courier: 'Михаил',
    service: 'Pickup',
    tracking: 'PICKUP-09',
    note: 'Получен клиентом',
  },
];

export function getLogisticsStatusIndex(status: string): number {
  return LOGISTICS_STATUSES.indexOf(status as LogisticsStatus);
}

export function getReadyForShipmentOrders(items: ReadonlyArray<ReadyShipment>) {
  return items.filter((item) => item.status === 'READY_FOR_SHIPMENT');
}

export function getShipmentSummary(items: ReadonlyArray<ReadyShipment>) {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'READY_FOR_SHIPMENT').length,
    shipped: items.filter((item) => item.status === 'SHIPPED').length,
    delivered: items.filter((item) => item.status === 'DELIVERED').length,
  };
}
