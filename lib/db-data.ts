import { prisma } from '@/lib/prisma';
import { demoLeads, demoOrders, type LeadRecord, type OrderRecord } from '@/lib/demo-data';
import { type Employee, type EmployeeDepartment, type EmployeeRole } from '@/lib/employees';
import { filterDemoRecordsByOwner, getAssignedEmployeeIds, normalizeRole } from '@/lib/access';
import type { SessionUser } from '@/lib/auth';

export type LeadAssignee = { id: string; name: string; email: string; role: string };

export async function getLeadAssignees(user: SessionUser): Promise<LeadAssignee[]> {
  const role = normalizeRole(user.role);

  if (!['admin', 'manager', 'sales'].includes(role)) {
    return [];
  }

  const currentEmployee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true },
  });

  if (role === 'manager' && !currentEmployee) {
    return [];
  }

  if (role === 'sales') {
    const employee = currentEmployee
      ? await prisma.employee.findUnique({
          where: { id: currentEmployee.id },
          include: { user: { include: { role: true } } },
        })
      : null;
    return employee?.isActive && employee.user ? [{
      id: employee.id,
      name: employee.fullName,
      email: employee.user.email,
      role: normalizeRole(employee.user.role?.name),
    }] : [];
  }

  const employees = await prisma.employee.findMany({
    where: role === 'manager' && currentEmployee
      ? { OR: [{ id: currentEmployee.id }, { managerId: currentEmployee.id }] }
      : undefined,
    include: { user: { include: { role: true } } },
    orderBy: { fullName: 'asc' },
  });

  return employees
    .filter((employee) => employee.isActive && ['manager', 'sales'].includes(normalizeRole(employee.user?.role?.name)))
    .map((employee) => ({
      id: employee.id,
      name: employee.fullName,
      email: employee.user.email,
      role: normalizeRole(employee.user.role?.name),
    }));
}

export async function getRecordScope(user: SessionUser) {
  if (!['manager', 'sales'].includes(normalizeRole(user.role))) {
    return null;
  }

  const employee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true, subordinates: { select: { id: true } } },
  });
  const employeeIds = getAssignedEmployeeIds(
    user.role,
    employee?.id ?? null,
    employee?.subordinates.map((subordinate) => subordinate.id) ?? [],
  );

  return { managerId: { in: employeeIds ?? [] } };
}

export async function getEmployeesFromDb(): Promise<Employee[]> {
  const employeeCount = await prisma.employee.count();

  if (employeeCount === 0) {
    return [];
  }

  const employees = await prisma.employee.findMany({
    include: { user: { include: { role: true } } },
    orderBy: { fullName: 'asc' },
  });

  return employees.map((employee) => ({
    id: employee.id,
    name: employee.fullName,
    position: employee.position,
    department: (employee.department ?? 'Sales') as EmployeeDepartment,
    role: (employee.user?.role?.name ?? 'sales') as EmployeeRole,
    email: employee.user?.email ?? 'unknown@watchflow.local',
    phone: employee.phone ?? '+7 700 000 00 00',
    isActive: employee.isActive,
    status: employee.isActive ? 'active' : 'inactive',
  }));
}

export async function getCRMLeadsFromDb(user?: SessionUser): Promise<LeadRecord[]> {
  const leadCount = await prisma.lead.count();

  if (leadCount === 0) {
    return filterDemoRecordsByOwner(demoLeads, user).map((lead) => ({ ...lead, isDemo: true }));
  }

  const scope = user ? await getRecordScope(user) : null;
  const leads = await prisma.lead.findMany({
    where: scope ?? undefined,
    include: { client: true, manager: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return leads.map((lead) => ({
    id: lead.id,
    assignedToId: lead.manager?.id,
    assignedTo: lead.manager?.fullName,
    assignedToEmail: lead.manager?.user.email,
    phone: lead.client?.phone ?? undefined,
    whatsapp: lead.client?.whatsapp ?? undefined,
    instagram: lead.client?.instagram ?? undefined,
    city: lead.client?.city ?? undefined,
    notes: lead.notes ?? lead.client?.notes ?? undefined,
    isDemo: false,
    client: lead.client?.name ?? 'Неизвестный клиент',
    source: lead.source ?? 'Другое',
    status: (lead.status as LeadRecord['status']) ?? 'NEW',
    value: Number(lead.value ?? 0),
    reasonLost: lead.reasonLost ?? undefined,
    createdAt: lead.createdAt.toISOString().slice(0, 10),
  }));
}

export async function getOrdersFromDb(user?: SessionUser): Promise<OrderRecord[]> {
  const orderCount = await prisma.order.count();

  if (orderCount === 0) {
    return filterDemoRecordsByOwner(demoOrders, user);
  }

  const scope = user ? await getRecordScope(user) : null;
  const orders = await prisma.order.findMany({
    where: scope ?? undefined,
    include: { client: true, items: true },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((order) => ({
    id: order.id,
    number: order.number,
    client: order.client?.name ?? 'Неизвестный клиент',
    product: order.items[0]?.productName ?? 'Custom Watch',
    total: Number(order.total ?? 0),
    status: (order.status as OrderRecord['status']) ?? 'NEW',
    assignee: 'Менеджер',
    createdAt: order.createdAt.toISOString().slice(0, 10),
    city: order.client?.city ?? 'Алматы',
    address: order.client?.company ?? 'Адрес не указан',
    model: order.items[0]?.model ?? 'Classic',
    size: '42mm',
    color: order.items[0]?.color ?? 'Черный',
    strap: order.items[0]?.strap ?? 'Кожаный',
    engraving: order.items[0]?.engraving ?? '',
    payment: order.paymentStatus,
    deposit: Number(order.deposit ?? 0),
    balance: Math.max(0, Number(order.total ?? 0) - Number(order.deposit ?? 0)),
    manager: 'Марина',
    designer: 'Ольга',
    master: 'Игорь',
    logistics: 'Сергей',
    history: [],
  }));
}

export async function getOrderByIdFromDb(id: string, user?: SessionUser): Promise<OrderRecord | null> {
  const orders = await getOrdersFromDb(user);
  return orders.find((order) => order.id === id) ?? null;
}
