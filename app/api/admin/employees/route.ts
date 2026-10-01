import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/employee-admin-validation';
import { getEmployeesFromDb } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';

function redirectWithResult(request: NextRequest, key: 'success' | 'error', value: string) {
  const url = new URL('/admin/employees', request.url);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

async function requireAdmin() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!canAccessSection(user.role, 'admin')) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    return NextResponse.json({ employees: await getEmployeesFromDb() });
  } catch {
    return NextResponse.json({ error: 'Unable to load employees.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const formData = await request.formData();
  const action = String(formData.get('_action') ?? 'create');
  const employeeId = String(formData.get('employeeId') ?? '').trim();

  try {
    if (action === 'block' || action === 'unblock') {
      if (!employeeId) return redirectWithResult(request, 'error', 'invalid_employee');

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: { include: { role: true } } },
      });
      if (!employee) return redirectWithResult(request, 'error', 'employee_not_found');

      if (action === 'block' && employee.user.email === auth.user.email) {
        return redirectWithResult(request, 'error', 'cannot_block_self');
      }

      if (action === 'block' && employee.user.role?.name === 'admin') {
        const activeAdminCount = await prisma.employee.count({
          where: { isActive: true, user: { role: { name: 'admin' } } },
        });
        if (activeAdminCount <= 1) {
          return redirectWithResult(request, 'error', 'last_admin');
        }
      }

      await prisma.employee.update({
        where: { id: employeeId },
        data: { isActive: action === 'unblock' },
      });
      return redirectWithResult(request, 'success', action === 'block' ? 'blocked' : 'unblocked');
    }

    if (action === 'delete') {
      return redirectWithResult(request, 'error', 'use_block_instead');
    }

    if (action === 'create') {
      const parsed = createEmployeeSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        position: formData.get('position'),
        department: formData.get('department'),
        role: formData.get('role'),
        phone: formData.get('phone') ?? '',
      });

      if (!parsed.success) return redirectWithResult(request, 'error', 'invalid_form');

      const data = parsed.data;
      const role = await prisma.role.findUnique({ where: { name: data.role } });
      if (!role) return redirectWithResult(request, 'error', 'role_not_found');

      const salesManager = data.role === 'sales'
        ? await prisma.employee.findFirst({
            where: { isActive: true, user: { role: { name: 'manager' } } },
            select: { id: true },
          })
        : null;

      await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: await bcrypt.hash(data.password, 12),
          role: { connect: { id: role.id } },
          employee: {
            create: {
              fullName: data.name,
              position: data.position,
              department: data.department,
              phone: data.phone || null,
              isActive: true,
              ...(salesManager ? { manager: { connect: { id: salesManager.id } } } : {}),
            },
          },
        },
      });

      return redirectWithResult(request, 'success', 'created');
    }

    if (action === 'update') {
      if (!employeeId) return redirectWithResult(request, 'error', 'invalid_employee');

      const parsed = updateEmployeeSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password') ?? '',
        position: formData.get('position'),
        department: formData.get('department'),
        role: formData.get('role'),
        phone: formData.get('phone') ?? '',
        isActive: String(formData.get('isActive') ?? '') === 'on',
      });

      if (!parsed.success) return redirectWithResult(request, 'error', 'invalid_form');

      const data = parsed.data;
      const role = await prisma.role.findUnique({ where: { name: data.role } });
      if (!role) return redirectWithResult(request, 'error', 'role_not_found');

      const currentEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: { include: { role: true } } },
      });
      if (!currentEmployee) return redirectWithResult(request, 'error', 'employee_not_found');

      const losesAdminAccess = currentEmployee.user.role?.name === 'admin'
        && (!data.isActive || data.role !== 'admin');
      if (losesAdminAccess) {
        const activeAdminCount = await prisma.employee.count({
          where: { isActive: true, user: { role: { name: 'admin' } } },
        });
        if (activeAdminCount <= 1) return redirectWithResult(request, 'error', 'last_admin');
      }

      if (currentEmployee.user.email === auth.user.email && (!data.isActive || data.role !== 'admin')) {
        return redirectWithResult(request, 'error', 'cannot_remove_own_admin');
      }

      const salesManager = data.role === 'sales' && !currentEmployee.managerId
        ? await prisma.employee.findFirst({
            where: {
              id: { not: currentEmployee.id },
              isActive: true,
              user: { role: { name: 'manager' } },
            },
            select: { id: true },
          })
        : null;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: currentEmployee.userId },
          data: {
            name: data.name,
            email: data.email,
            roleId: role.id,
            ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}),
          },
        });
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            fullName: data.name,
            position: data.position,
            department: data.department,
            phone: data.phone || null,
            isActive: data.isActive,
            manager: data.role === 'sales' && (currentEmployee.managerId || salesManager)
              ? { connect: { id: currentEmployee.managerId ?? salesManager?.id } }
              : { disconnect: true },
          },
        });
      });

      return redirectWithResult(request, 'success', 'updated');
    }

    return redirectWithResult(request, 'error', 'unknown_action');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return redirectWithResult(request, 'error', 'email_in_use');
    }

    console.error('Employee administration failed:', error);
    return redirectWithResult(request, 'error', 'save_failed');
  }
}
