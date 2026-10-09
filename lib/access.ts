export const ROLE_PERMISSIONS = {
  admin: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'orders:read',
    'orders:write',
    'warehouse:read',
    'warehouse:write',
    'marketing:read',
    'marketing:write',
    'design:read',
    'design:write',
    'production:read',
    'production:write',
    'logistics:read',
    'logistics:write',
    'reports:read',
    'users:read',
    'users:write',
    'audit:read',
  ],
  manager: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'leads:read',
    'leads:write',
    'orders:read',
    'orders:write',
    'reports:read',
    'design:read',
  ],
  sales: [
    'dashboard:read',
    'leads:read',
    'leads:write',
    'orders:read',
    'orders:write',
    'design:read',
  ],
  designer: ['dashboard:read', 'design:read', 'design:write'],
  master: ['dashboard:read', 'production:read', 'production:write'],
  warehouse: ['dashboard:read', 'warehouse:read', 'warehouse:write'],
  logistics: ['dashboard:read', 'logistics:read', 'logistics:write', 'orders:read'],
  marketing: ['dashboard:read', 'marketing:read', 'marketing:write'],
} as const;

export type RoleName = keyof typeof ROLE_PERMISSIONS;
export type AccessSubject = string | { role: string; permissions?: readonly string[] };

export const PERMISSION_LABELS: Record<string, string> = {
  'dashboard:read': 'Просмотр панели управления',
  'crm:read': 'Просмотр CRM',
  'crm:write': 'Изменение CRM',
  'leads:read': 'Просмотр лидов',
  'leads:write': 'Изменение лидов',
  'orders:read': 'Просмотр заказов',
  'orders:write': 'Изменение заказов',
  'warehouse:read': 'Просмотр склада',
  'warehouse:write': 'Изменение склада',
  'marketing:read': 'Просмотр маркетинга',
  'marketing:write': 'Изменение маркетинга',
  'design:read': 'Просмотр дизайна',
  'design:write': 'Управление дизайном',
  'production:read': 'Просмотр производства',
  'production:write': 'Управление производством',
  'logistics:read': 'Просмотр логистики',
  'logistics:write': 'Управление логистикой',
  'reports:read': 'Просмотр отчетов',
  'users:read': 'Просмотр сотрудников',
  'users:write': 'Управление сотрудниками',
  'audit:read': 'Просмотр истории и аудита',
};

const SECTION_PERMISSIONS: Record<string, string[]> = {
  admin: ['users:read'],
  dashboard: ['dashboard:read'],
  crm: ['crm:read'],
  leads: ['leads:read'],
  orders: ['orders:read'],
  warehouse: ['warehouse:read'],
  inventory: ['warehouse:read'],
  marketing: ['marketing:read'],
  design: ['design:read'],
  production: ['production:read'],
  logistics: ['logistics:read'],
  employees: ['users:read'],
  reports: ['reports:read'],
};

export function normalizeRole(role?: string | null): string {
  return (role ?? '').trim().toLowerCase();
}

function getRole(subject: AccessSubject): string {
  return typeof subject === 'string' ? subject : subject.role;
}

function getPermissions(subject: AccessSubject): readonly string[] {
  if (typeof subject !== 'string' && subject.permissions !== undefined) return subject.permissions;
  return ROLE_PERMISSIONS[normalizeRole(getRole(subject)) as RoleName] ?? [];
}

export function hasPermission(subject: AccessSubject, permission: string): boolean {
  const role = normalizeRole(getRole(subject));
  const permissions = getPermissions(subject);
  return role === 'admin' || permissions.includes(permission) || permissions.includes('*');
}

export function canAccessSection(subject: AccessSubject, section: string): boolean {
  const role = normalizeRole(getRole(subject));

  if (section === 'admin') {
    return role === 'admin';
  }

  if (role === 'admin') {
    return true;
  }

  const allowedPermissions = SECTION_PERMISSIONS[section] ?? [];
  return allowedPermissions.some((permission) => hasPermission(subject, permission));
}

export function hasAnyRole(role: string | null | undefined, allowedRoles: readonly string[]): boolean {
  return allowedRoles.some((candidate) => normalizeRole(candidate) === normalizeRole(role));
}

export function getAssignedEmployeeIds(
  role: string,
  employeeId: string | null,
  subordinateIds: readonly string[] = [],
): string[] | null {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'manager') {
    return employeeId ? [...new Set([employeeId, ...subordinateIds])] : [];
  }

  if (normalizedRole === 'sales') {
    return employeeId ? [employeeId] : [];
  }

  return null;
}

export function filterDemoRecordsByOwner<T extends { assignedToEmail?: string }>(
  records: T[],
  user?: { email: string; role: string } | null,
): T[] {
  if (!user) {
    return records;
  }

  const role = normalizeRole(user.role);

  if (role === 'sales') {
    return records.filter((record) => record.assignedToEmail === user.email);
  }

  if (role === 'manager') {
    const teamEmails = user.email === 'manager@watchflow.local'
      ? [user.email, 'sales@watchflow.local']
      : [user.email];
    return records.filter((record) => record.assignedToEmail && teamEmails.includes(record.assignedToEmail));
  }

  return records;
}
