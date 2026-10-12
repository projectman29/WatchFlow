import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import { authenticateDemoAdmin, clearSessionCookie } from './auth';
import { canAccessSection, filterDemoRecordsByOwner, getAssignedEmployeeIds, hasPermission, ROLE_PERMISSIONS } from './access';
import { demoLeads } from './demo-data';
import { getProtectedSectionForPath } from '../middleware';

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
    expect(ROLE_PERMISSIONS.admin).toContain('audit:read');
    expect(hasPermission('admin', 'audit:read')).toBe(true);
    expect(hasPermission('sales', 'audit:read')).toBe(false);
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

  it('uses configured database permissions for an authenticated role', () => {
    const sales = { role: 'sales', permissions: ['orders:read', 'warehouse:read'] };

    expect(hasPermission(sales, 'orders:read')).toBe(true);
    expect(hasPermission(sales, 'leads:write')).toBe(false);
    expect(canAccessSection(sales, 'warehouse')).toBe(true);
    expect(canAccessSection(sales, 'leads')).toBe(false);
    expect(canAccessSection({ role: 'sales', permissions: [] }, 'orders')).toBe(false);
    expect(canAccessSection({ role: 'sales', permissions: [] }, 'dashboard')).toBe(false);
  });

  it('keeps the admin area restricted to the administrator role', () => {
    expect(canAccessSection({ role: 'sales', permissions: ['users:read', 'users:write'] }, 'admin')).toBe(false);
    expect(canAccessSection({ role: 'admin', permissions: [] }, 'admin')).toBe(true);
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
    const manager = { email: 'manager@watchflow.local', role: 'manager' };
    const sales = { email: 'sales@watchflow.local', role: 'sales' };

    expect(filterDemoRecordsByOwner(demoLeads, manager)).toHaveLength(6);
    expect(filterDemoRecordsByOwner(demoLeads, sales).map((lead) => lead.id)).toEqual([
      'lead-1',
      'lead-3',
      'lead-5',
    ]);
  });

  it('maps ERP route prefixes to the correct protected section', () => {
    expect(getProtectedSectionForPath('/dashboard')).toBe('dashboard');
    expect(getProtectedSectionForPath('/dashboard/reports')).toBe('dashboard');
    expect(getProtectedSectionForPath('/admin/employees')).toBe('admin');
    expect(getProtectedSectionForPath('/crm/leads')).toBe('crm');
    expect(getProtectedSectionForPath('/orders/123')).toBe('orders');
    expect(getProtectedSectionForPath('/warehouse/stock')).toBe('warehouse');
    expect(getProtectedSectionForPath('/employees/team')).toBe('employees');
    expect(getProtectedSectionForPath('/unknown')).toBeNull();
  });

  it('restricts unauthorized roles from protected ERP routes', () => {
    expect(canAccessSection('sales', 'crm')).toBe(false);
    expect(canAccessSection('sales', 'orders')).toBe(true);
    expect(canAccessSection('designer', 'production')).toBe(false);
    expect(canAccessSection('warehouse', 'warehouse')).toBe(true);
    expect(canAccessSection('manager', 'employees')).toBe(false);
    expect(canAccessSection('admin', 'employees')).toBe(true);
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
