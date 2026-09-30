export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'WAITING_PAYMENT'
  | 'WON'
  | 'LOST';

export type OrderStatus =
  | 'NEW'
  | 'WAITING_DESIGN'
  | 'DESIGN_IN_PROGRESS'
  | 'WAITING_CLIENT_APPROVAL'
  | 'DESIGN_APPROVED'
  | 'WAITING_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'QUALITY_CONTROL'
  | 'READY_FOR_PACKING'
  | 'READY_FOR_SHIPMENT'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type LeadRecord = {
  id: string;
  client: string;
  source: string;
  status: LeadStatus;
  value: number;
  reasonLost?: string;
  createdAt: string;
};

export type OrderRecord = {
  id: string;
  number: string;
  client: string;
  product: string;
  total: number;
  status: OrderStatus;
  assignee: string;
  createdAt: string;
  city: string;
  address: string;
  model: string;
  size: string;
  color: string;
  strap: string;
  engraving: string;
  payment: string;
  deposit: number;
  balance: number;
  manager: string;
  designer: string;
  master: string;
  logistics: string;
  history: Array<{ label: string; date: string; note: string }>;
};

export const demoLeads: LeadRecord[] = [
  {
    id: 'lead-1',
    client: 'Анна Смирнова',
    source: 'Instagram',
    status: 'NEW',
    value: 1100,
    createdAt: '2026-09-24',
  },
  {
    id: 'lead-2',
    client: 'Илья Кузнецов',
    source: 'Google Ads',
    status: 'CONTACTED',
    value: 1750,
    createdAt: '2026-09-20',
  },
  {
    id: 'lead-3',
    client: 'Елена Павлова',
    source: 'Реферал',
    status: 'INTERESTED',
    value: 2200,
    createdAt: '2026-09-18',
  },
  {
    id: 'lead-4',
    client: 'Дмитрий Лапин',
    source: 'Landing',
    status: 'WAITING_PAYMENT',
    value: 3100,
    createdAt: '2026-09-15',
  },
  {
    id: 'lead-5',
    client: 'Мария Васильева',
    source: 'Instagram',
    status: 'WON',
    value: 4200,
    createdAt: '2026-09-10',
  },
  {
    id: 'lead-6',
    client: 'Сергей Белов',
    source: 'VK',
    status: 'LOST',
    value: 900,
    reasonLost: 'Не подошёл размер и бюджет',
    createdAt: '2026-09-08',
  },
];

export const demoOrders: OrderRecord[] = [
  {
    id: 'order-1001',
    number: 'WF-1001',
    client: 'Мария Васильева',
    product: 'Classic Steel 42mm',
    total: 4200,
    status: 'IN_PRODUCTION',
    assignee: 'Мастер Игорь',
    createdAt: '2026-09-26',
    city: 'Алматы',
    address: 'ул. Абая 15, кв. 28',
    model: 'Classic Steel',
    size: '42mm',
    color: 'Черный',
    strap: 'Кожаный',
    engraving: 'M.V. / 2026',
    payment: 'Предоплата 50%',
    deposit: 2100,
    balance: 2100,
    manager: 'Марина',
    designer: 'Ольга',
    master: 'Игорь',
    logistics: 'Сергей',
    history: [
      { label: 'Новый', date: '2026-09-25', note: 'Лид пришёл через Instagram' },
      { label: 'Дизайн подтверждён', date: '2026-09-26', note: 'Клиент согласовал макет' },
      { label: 'В производстве', date: '2026-09-27', note: 'Начато изготовление корпуса и механизма' },
    ],
  },
  {
    id: 'order-1002',
    number: 'WF-1002',
    client: 'Андрей Котов',
    product: 'Titanium Chronograph',
    total: 5600,
    status: 'DESIGN_APPROVED',
    assignee: 'Дизайнер Ольга',
    createdAt: '2026-09-25',
    city: 'Нур-Султан',
    address: 'ул. Кунаева 91',
    model: 'Titanium Chronograph',
    size: '44mm',
    color: 'Серебро',
    strap: 'Металлический',
    engraving: 'A.K. / forever',
    payment: 'Полная оплата',
    deposit: 5600,
    balance: 0,
    manager: 'Иван',
    designer: 'Ольга',
    master: 'Кирилл',
    logistics: 'Алина',
    history: [
      { label: 'Новый', date: '2026-09-24', note: 'Уточнение по дизайну' },
      { label: 'Дизайн подтверждён', date: '2026-09-25', note: 'Проверена версия 2' },
    ],
  },
  {
    id: 'order-1003',
    number: 'WF-1003',
    client: 'Елизавета Кудряшова',
    product: 'Minimal Leather 38mm',
    total: 2900,
    status: 'SHIPPED',
    assignee: 'Логистика',
    createdAt: '2026-09-22',
    city: 'Астана',
    address: 'пр. Мангилик Ел 12',
    model: 'Minimal Leather',
    size: '38mm',
    color: 'Темный коричневый',
    strap: 'Кожаный',
    engraving: 'E.K. / family',
    payment: 'Оплата при получении',
    deposit: 0,
    balance: 2900,
    manager: 'Ольга',
    designer: 'Наталья',
    master: 'Андрей',
    logistics: 'Сергей',
    history: [
      { label: 'Производство завершено', date: '2026-09-23', note: 'Проверка качества пройдена' },
      { label: 'Отправлен', date: '2026-09-24', note: 'Трек: KZ-10482' },
    ],
  },
];
