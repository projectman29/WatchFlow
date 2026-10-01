import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_ROLES,
  createEmployee,
  deleteEmployee,
  employeeDirectory,
  getEmployeeSummary,
  toggleEmployeeStatus,
  updateEmployee,
} from './employees';
import { isEmployeeAccountActive } from './auth';
import { createEmployeeSchema, updateEmployeeSchema } from './employee-admin-validation';

describe('employees module', () => {
  it('allows only active employee accounts to pass the sign-in status check', () => {
    expect(isEmployeeAccountActive({ isActive: true })).toBe(true);
    expect(isEmployeeAccountActive({ isActive: false })).toBe(false);
    expect(isEmployeeAccountActive(null)).toBe(false);
  });

  it('validates employee credentials and permits password changes to be optional on edit', () => {
    const employee = {
      name: 'Анна Сотрудник',
      email: ' ANNA@EXAMPLE.COM ',
      position: 'Менеджер',
      department: 'Sales',
      role: 'sales',
      phone: '',
    };

    expect(createEmployeeSchema.safeParse({ ...employee, password: 'secret123' }).success).toBe(true);
    expect(createEmployeeSchema.safeParse({ ...employee, password: 'short' }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ ...employee, password: '', isActive: true }).success).toBe(true);
    expect(updateEmployeeSchema.safeParse({ ...employee, password: 'short', isActive: true }).success).toBe(false);
    expect(createEmployeeSchema.parse({ ...employee, password: 'secret123' }).email).toBe('anna@example.com');
  });

  it('exposes the required departments and roles', () => {
    expect(EMPLOYEE_ROLES).toContain('admin');
    expect(EMPLOYEE_ROLES).toContain('sales');
    expect(EMPLOYEE_ROLES).toContain('warehouse');
    expect(EMPLOYEE_DEPARTMENTS).toContain('Sales');
    expect(EMPLOYEE_DEPARTMENTS).toContain('Production');
  });

  it('summarizes the active team', () => {
    const summary = getEmployeeSummary(employeeDirectory);

    expect(summary.total).toBeGreaterThanOrEqual(4);
    expect(summary.active).toBeGreaterThan(0);
    expect(summary.byDepartment.Sales).toBeGreaterThan(0);
  });

  it('returns only active employees by default for the directory', () => {
    expect(employeeDirectory.every((employee) => employee.isActive)).toBe(true);
  });

  it('supports creating, updating, blocking and deleting staff records', () => {
    const initialLength = employeeDirectory.length;
    const created = createEmployee({
      name: 'Тестовый сотрудник',
      position: 'Тестовый менеджер',
      department: 'Sales',
      role: 'sales',
      email: 'test.employee@watchflow.local',
      phone: '+7 700 000 00 00',
      isActive: true,
      status: 'active',
    });

    expect(employeeDirectory).toHaveLength(initialLength + 1);
    expect(created.email).toBe('test.employee@watchflow.local');

    const updated = updateEmployee(created.id, {
      position: 'Старший менеджер',
      status: 'on_leave',
    });

    expect(updated.position).toBe('Старший менеджер');
    expect(updated.status).toBe('on_leave');

    const blocked = toggleEmployeeStatus(created.id, false);
    expect(blocked.isActive).toBe(false);
    expect(blocked.status).toBe('inactive');

    const unblocked = toggleEmployeeStatus(created.id, true);
    expect(unblocked.isActive).toBe(true);
    expect(unblocked.status).toBe('active');

    const removed = deleteEmployee(created.id);
    expect(removed.id).toBe(created.id);
    expect(employeeDirectory.some((employee) => employee.id === created.id)).toBe(false);
  });
});
