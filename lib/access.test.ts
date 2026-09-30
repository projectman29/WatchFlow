import { describe, expect, it } from 'vitest';
import { authenticateDemoAdmin } from './auth';
import { canAccessSection, hasPermission, ROLE_PERMISSIONS } from './access';

describe('RBAC access rules', () => {
  it('grants admin all dashboard permissions', () => {
    expect(canAccessSection('admin', 'dashboard')).toBe(true);
    expect(hasPermission('admin', 'orders:read')).toBe(true);
    expect(hasPermission('admin', 'warehouse:write')).toBe(true);
  });

  it('restricts warehouse users from marketing sections', () => {
    expect(canAccessSection('warehouse', 'warehouse')).toBe(true);
    expect(canAccessSection('warehouse', 'marketing')).toBe(false);
    expect(hasPermission('warehouse', 'warehouse:write')).toBe(true);
    expect(hasPermission('warehouse', 'marketing:read')).toBe(false);
  });

  it('defines default permissions per role', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('dashboard:read');
    expect(ROLE_PERMISSIONS.manager).toContain('leads:read');
    expect(ROLE_PERMISSIONS.design).toContain('design:read');
  });

  it('allows the demo admin login even when the database is unavailable', () => {
    const user = authenticateDemoAdmin('admin@watchflow.local', 'admin123');

    expect(user).not.toBeNull();
    expect(user?.role).toBe('admin');
    expect(user?.email).toBe('admin@watchflow.local');
  });
});
