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
  ],
  sales: [
    'dashboard:read',
    'leads:read',
    'leads:write',
    'orders:read',
    'orders:write',
  ],
  designer: ['dashboard:read', 'design:read', 'design:write'],
  master: ['dashboard:read', 'production:read', 'production:write'],
  warehouse: ['dashboard:read', 'warehouse:read', 'warehouse:write'],
  logistics: ['dashboard:read', 'logistics:read', 'logistics:write', 'orders:read'],
  marketing: ['dashboard:read', 'marketing:read', 'marketing:write'],
} as const;

export type RoleName = keyof typeof ROLE_PERMISSIONS;

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

export function hasPermission(role: string, permission: string): boolean {
  const normalizedRole = normalizeRole(role);
  const permissions = Array.from(ROLE_PERMISSIONS[normalizedRole as RoleName] ?? []) as string[];
  return normalizedRole === 'admin' || permissions.includes(permission) || permissions.includes('*');
}

export function canAccessSection(role: string, section: string): boolean {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'admin') {
    return true;
  }

  const allowedPermissions = SECTION_PERMISSIONS[section] ?? [];
  return allowedPermissions.some((permission) => hasPermission(normalizedRole, permission));
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
