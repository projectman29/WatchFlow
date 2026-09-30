export const ADMIN_ROLE_OPTIONS = [
  { value: 'admin', label: 'Администратор / владелец' },
  { value: 'manager', label: 'Руководитель отдела продаж' },
  { value: 'sales', label: 'Менеджер по продажам' },
  { value: 'designer', label: 'Дизайнер' },
  { value: 'master', label: 'Мастер' },
  { value: 'warehouse', label: 'Складской сотрудник' },
  { value: 'logistics', label: 'Логист' },
  { value: 'marketing', label: 'Маркетолог' },
];

export const DEMO_EMPLOYEES = [
  {
    id: 'emp-1',
    fullName: 'Super Admin',
    email: 'admin@watchflow.local',
    position: 'Owner',
    department: 'Administration',
    phone: '+7 700 000 00 00',
    role: 'admin',
    isActive: true,
  },
  {
    id: 'emp-2',
    fullName: 'Марина Соколова',
    email: 'manager@watchflow.local',
    position: 'РОП',
    department: 'Sales',
    phone: '+7 701 111 22 33',
    role: 'manager',
    isActive: true,
  },
  {
    id: 'emp-3',
    fullName: 'Иван Петров',
    email: 'sales@watchflow.local',
    position: 'Менеджер по продажам',
    department: 'Sales',
    phone: '+7 702 333 44 55',
    role: 'sales',
    isActive: true,
  },
];
