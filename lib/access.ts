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
    'crm:read',
    'crm:write',
    'leads:read',
    'leads:write',
    'orders:read',
    'orders:write',
  ],
  designer: ['dashboard:read', 'design:read', 'design:write'],
  design: ['dashboard:read', 'design:read', 'design:write'],
  master: ['dashboard:read', 'production:read', 'production:write'],
  warehouse: ['dashboard:read', 'warehouse:read', 'warehouse:write'],
  logistics: ['dashboard:read', 'logistics:read', 'logistics:write', 'orders:read'],
  marketing: ['dashboard:read', 'marketing:read', 'marketing:write'],
} as const;

export type RoleName = keyof typeof ROLE_PERMISSIONS;

const SECTION_PERMISSIONS: Record<string, string[]> = {
  dashboard: ['dashboard:read'],
  crm: ['crm:read'],
  leads: ['leads:read'],
  orders: ['orders:read'],
  warehouse: ['warehouse:read'],
  marketing: ['marketing:read'],
  design: ['design:read'],
  production: ['production:read'],
  logistics: ['logistics:read'],
  reports: ['reports:read'],
};

export function hasPermission(role: string, permission: string): boolean {
  const permissions = Array.from(ROLE_PERMISSIONS[role as RoleName] ?? []) as unknown as string[];
  return permissions.includes(permission) || permissions.includes('*');
}

export function canAccessSection(role: string, section: string): boolean {
  const allowedPermissions = SECTION_PERMISSIONS[section] ?? [];

  return allowedPermissions.some((permission) => hasPermission(role, permission));
}
