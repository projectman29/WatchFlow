import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import { authenticateDemoAdmin, clearSessionCookie } from './auth';
import { canAccessSection, filterDemoRecordsByOwner, getAssignedEmployeeIds, hasPermission, ROLE_PERMISSIONS } from './access';
import { demoLeads } from './demo-data';

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
    expect(ROLE_PERMISSIONS.designer).toContain('design:read');
  });

  it('allows sales and manager roles to access their standard sections only', () => {
    expect(canAccessSection('manager', 'leads')).toBe(true);
    expect(canAccessSection('manager', 'crm')).toBe(true);
    expect(canAccessSection('manager', 'reports')).toBe(true);
    expect(canAccessSection('manager', 'admin')).toBe(false);
    expect(canAccessSection('sales', 'orders')).toBe(true);
    expect(canAccessSection('sales', 'leads')).toBe(true);
    expect(canAccessSection('sales', 'crm')).toBe(false);
    expect(canAccessSection('sales', 'reports')).toBe(false);
    expect(canAccessSection('sales', 'warehouse')).toBe(false);
  });

  it('grants lead write access only to sales, managers, and admins', () => {
    expect(hasPermission('sales', 'leads:write')).toBe(true);
    expect(hasPermission('manager', 'leads:write')).toBe(true);
    expect(hasPermission('admin', 'leads:write')).toBe(true);
    expect(hasPermission('designer', 'leads:write')).toBe(false);
    expect(hasPermission('warehouse', 'leads:write')).toBe(false);
  });

  it('defines distinct section access for every operational role', () => {
    expect(canAccessSection('designer', 'design')).toBe(true);
    expect(canAccessSection('designer', 'production')).toBe(false);
    expect(canAccessSection('master', 'production')).toBe(true);
    expect(canAccessSection('master', 'design')).toBe(false);
    expect(canAccessSection('warehouse', 'warehouse')).toBe(true);
    expect(canAccessSection('warehouse', 'logistics')).toBe(false);
    expect(canAccessSection('logistics', 'logistics')).toBe(true);
    expect(canAccessSection('logistics', 'warehouse')).toBe(false);
    expect(canAccessSection('marketing', 'marketing')).toBe(true);
    expect(canAccessSection('marketing', 'crm')).toBe(false);
  });

  it('limits sales to owned records and manager to owned and subordinate records', () => {
    expect(getAssignedEmployeeIds('sales', 'sales-1', ['sales-2'])).toEqual(['sales-1']);
    expect(getAssignedEmployeeIds('manager', 'manager-1', ['sales-1', 'sales-2'])).toEqual([
      'manager-1',
      'sales-1',
      'sales-2',
    ]);
    expect(getAssignedEmployeeIds('manager', null, ['sales-1'])).toEqual([]);
    expect(getAssignedEmployeeIds('admin', 'admin-1', [])).toBeNull();
  });

  it('shows demo fallback leads to the manager team but only owned leads to sales', () => {
    const manager = authenticateDemoAdmin('manager@watchflow.local', 'manager123');
    const sales = authenticateDemoAdmin('sales@watchflow.local', 'sales123');

    expect(filterDemoRecordsByOwner(demoLeads, manager)).toHaveLength(6);
    expect(filterDemoRecordsByOwner(demoLeads, sales).map((lead) => lead.id)).toEqual([
      'lead-1',
      'lead-3',
      'lead-5',
    ]);
  });

  it('allows the demo admin login even when the database is unavailable', () => {
    const user = authenticateDemoAdmin('admin@watchflow.local', 'admin123');

    expect(user).not.toBeNull();
    expect(user?.role).toBe('admin');
    expect(user?.email).toBe('admin@watchflow.local');
  });

  it('allows demo manager and sales logins', () => {
    expect(authenticateDemoAdmin('manager@watchflow.local', 'manager123')?.role).toBe('manager');
    expect(authenticateDemoAdmin('sales@watchflow.local', 'sales123')?.role).toBe('sales');
  });

  it('allows every demo role login in the default demo environment', () => {
    expect(authenticateDemoAdmin('designer@watchflow.local', 'designer123')?.role).toBe('designer');
    expect(authenticateDemoAdmin('master@watchflow.local', 'master123')?.role).toBe('master');
    expect(authenticateDemoAdmin('warehouse@watchflow.local', 'warehouse123')?.role).toBe('warehouse');
    expect(authenticateDemoAdmin('logistics@watchflow.local', 'logistics123')?.role).toBe('logistics');
    expect(authenticateDemoAdmin('marketing@watchflow.local', 'marketing123')?.role).toBe('marketing');
  });

  it('clears the session cookie when logging out', () => {
    const response = NextResponse.redirect('http://localhost:3000/login');
    clearSessionCookie(response);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('set-cookie') ?? '').toContain('watchflow_session=;');
  });
});
