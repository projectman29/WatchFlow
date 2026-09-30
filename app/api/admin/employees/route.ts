import { NextRequest, NextResponse } from 'next/server';
import { createEmployee, deleteEmployee, employeeDirectory, toggleEmployeeStatus, updateEmployee } from '@/lib/employees';

export async function GET() {
  return NextResponse.json({ employees: employeeDirectory });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const action = String(formData.get('_action') ?? 'create');
  const employeeId = String(formData.get('employeeId') ?? '');

  if (action === 'block' && employeeId) {
    try {
      toggleEmployeeStatus(employeeId, false);
    } catch {
      // Ignore missing employee records and keep the UI stable.
    }
    return NextResponse.redirect(new URL('/admin/employees', request.url));
  }

  if (action === 'unblock' && employeeId) {
    try {
      toggleEmployeeStatus(employeeId, true);
    } catch {
      // Ignore missing employee records and keep the UI stable.
    }
    return NextResponse.redirect(new URL('/admin/employees', request.url));
  }

  if (action === 'delete' && employeeId) {
    try {
      deleteEmployee(employeeId);
    } catch {
      // Ignore missing employee records and keep the UI stable.
    }
    return NextResponse.redirect(new URL('/admin/employees', request.url));
  }

  if (action === 'update' && employeeId) {
    try {
      updateEmployee(employeeId, {
        name: String(formData.get('name') ?? '').trim(),
        position: String(formData.get('position') ?? '').trim(),
        department: String(formData.get('department') ?? 'Sales') as any,
        role: String(formData.get('role') ?? 'sales') as any,
        email: String(formData.get('email') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        isActive: String(formData.get('isActive') ?? 'on') === 'on',
        status: String(formData.get('status') ?? 'active') as 'active' | 'on_leave' | 'inactive',
      });
    } catch {
      // Ignore missing employee records and keep the UI stable.
    }
    return NextResponse.redirect(new URL('/admin/employees', request.url));
  }

  const submittedName = String(formData.get('name') ?? formData.get('fullName') ?? '').trim();
  const employee = createEmployee({
    name: submittedName,
    position: String(formData.get('position') ?? '').trim(),
    department: String(formData.get('department') ?? 'Sales') as any,
    role: String(formData.get('role') ?? 'sales') as any,
    email: String(formData.get('email') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    isActive: true,
    status: 'active',
  });

  if (!employee.name || !employee.email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  return NextResponse.redirect(new URL('/admin/employees', request.url));
}
