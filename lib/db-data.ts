import { prisma } from '@/lib/prisma';
import { demoLeads, demoOrders, type LeadRecord, type OrderRecord } from '@/lib/demo-data';
import { type Employee, type EmployeeDepartment, type EmployeeRole } from '@/lib/employees';
import { canAccessSection, filterDemoRecordsByOwner, getAssignedEmployeeIds, hasPermission, normalizeRole } from '@/lib/access';
import type { SessionUser } from '@/lib/auth';
import { ORDER_STATUS_LABELS } from '@/lib/orders';
import { getDateRange } from '@/lib/search';
import { isSalesDataFoundationReady } from '@/lib/sales-data-readiness';

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
  const salesDataReady = await isSalesDataFoundationReady();
  const leads = await prisma.lead.findMany({
    where: scope ?? undefined,
    include: {
      client: true,
      manager: { include: { user: true } },
      orders: { select: { id: true, number: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const qualifiedTransitions = salesDataReady
    ? await prisma.leadStatusHistory.findMany({
        where: { leadId: { in: leads.map((lead) => lead.id) }, toStatus: { in: ['WAITING_PAYMENT', 'WON'] } },
        orderBy: { changedAt: 'asc' },
        distinct: ['leadId'],
        select: { leadId: true, changedAt: true },
      })
    : [];
  const qualifiedAtByLead = new Map(qualifiedTransitions.map(({ leadId, changedAt }) => [leadId, changedAt]));

  return leads.map((lead) => ({
    id: lead.id,
    assignedToId: lead.manager?.id,
    assignedTo: lead.manager?.fullName,
    assignedToEmail: lead.manager?.user.email,
    linkedOrder: user && canAccessSection(user, 'orders') && lead.orders[0]
      ? { id: lead.orders[0].id, number: lead.orders[0].number }
      : undefined,
    firstQualifiedAt: salesDataReady && user && hasPermission(user, 'leads:write') && hasPermission(user, 'orders:write')
      ? qualifiedAtByLead.get(lead.id)?.toISOString()
      : undefined,
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

export type OrderFilters = {
  status?: string;
  managerId?: string;
  city?: string;
  from?: string;
  to?: string;
  overdue?: boolean;
};

export async function getOrdersFromDb(user?: SessionUser, filters: OrderFilters = {}): Promise<OrderRecord[]> {
  const orderCount = await prisma.order.count();

  if (orderCount === 0) {
    return filterDemoRecordsByOwner(demoOrders, user).filter((order) =>
      (!filters.status || order.status === filters.status) &&
      (!filters.city || order.city.toLocaleLowerCase().includes(filters.city.toLocaleLowerCase())) &&
      (!filters.from || order.createdAt >= filters.from) &&
      (!filters.to || order.createdAt <= filters.to),
    );
  }

  const scope = user ? await getRecordScope(user) : null;
  const salesDataReady = await isSalesDataFoundationReady();
  const dateRange = getDateRange(filters.from, filters.to);
  const where = {
    ...(scope ?? {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.managerId ? { managerId: filters.managerId } : {}),
    ...(filters.city ? { client: { city: { contains: filters.city, mode: 'insensitive' as const } } } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
    ...(filters.overdue ? {
      AND: [
        { designTask: { is: { deadline: { lt: new Date() }, status: { not: 'APPROVED' } } } },
        { status: { notIn: ['COMPLETED', 'CANCELLED', 'SHIPPED', 'DELIVERED'] } },
      ],
    } : {}),
  };
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      discount: true,
      deposit: true,
      paymentStatus: true,
      clientId: true,
      leadId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      ...(salesDataReady ? { currency: true } : {}),
      client: { select: { name: true, city: true, company: true } },
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          model: true,
          color: true,
          strap: true,
          engraving: true,
        },
      },
      manager: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((order) => ({
    id: order.id,
    number: order.number,
    client: order.client?.name ?? 'Неизвестный клиент',
    product: order.items[0]?.productName ?? 'Custom Watch',
    total: Number(order.total ?? 0),
    currency: 'currency' in order ? order.currency : null,
    discount: Number(order.discount ?? 0),
    status: (order.status as OrderRecord['status']) ?? 'NEW',
    assignee: order.manager?.fullName ?? 'Не назначен',
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
    manager: order.manager?.fullName ?? 'Не назначен',
    designer: 'Ольга',
    master: 'Игорь',
    logistics: 'Сергей',
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      model: item.model ?? undefined,
      color: item.color ?? undefined,
      strap: item.strap ?? undefined,
      engraving: item.engraving ?? undefined,
    })),
    history: [],
  }));
}

export async function getOrderByIdFromDb(id: string, user?: SessionUser): Promise<OrderRecord | null> {
  const orders = await getOrdersFromDb(user);
  const order = orders.find((candidate) => candidate.id === id);

  if (!order || order.id.startsWith('order-')) {
    return order ?? null;
  }

  const activities = await prisma.activityLog.findMany({
    where: { entity: 'Order', entityId: order.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const history = activities.map((activity) => {
    let details: Record<string, unknown> = {};
    try {
      details = JSON.parse(activity.details ?? '{}') as Record<string, unknown>;
    } catch {
      details = {};
    }

    let note = typeof details.note === 'string' ? details.note : '';
    const actor = activity.user?.name ?? (typeof details.actor === 'string' ? details.actor : 'Система');
    const newValues = typeof details.new === 'object' && details.new !== null
      ? details.new as Record<string, unknown>
      : {};
    if (activity.action === 'ORDER_CREATED') {
      note = note || 'Заказ создан из лида.';
    } else if (activity.action === 'ORDER_UPDATED') {
      const oldValues = details.old as Record<string, unknown> | undefined;
      const newValues = details.new as Record<string, unknown> | undefined;
      const changes: string[] = [];
      for (const [key, label] of [
        ['total', 'сумма'],
        ['discount', 'скидка'],
        ['deposit', 'предоплата'],
        ['paymentStatus', 'оплата'],
      ] as const) {
        if (oldValues?.[key] !== newValues?.[key]) {
          changes.push(`${label}: ${String(oldValues?.[key] ?? '—')} → ${String(newValues?.[key] ?? '—')}`);
        }
      }
      if (JSON.stringify(oldValues?.items) !== JSON.stringify(newValues?.items)) {
        changes.push('позиции заказа обновлены');
      }
      note = changes.join('; ') || 'Данные заказа обновлены.';
    } else if (activity.action === 'DESIGN_TASK_CREATED') {
      note = 'Создана задача дизайна.';
    } else if (activity.action === 'DESIGNER_ASSIGNED') {
      note = 'Назначен дизайнер.';
    } else if (activity.action === 'DESIGN_STARTED') {
      note = 'Дизайнер начал работу над макетом.';
    } else if (activity.action === 'DESIGN_FILE_UPLOADED') {
      note = `Загружен макет v${String(newValues.version ?? details.version ?? '')}: ${String(newValues.fileName ?? details.fileName ?? '')}`;
    } else if (activity.action === 'DESIGN_APPROVED') {
      note = 'Макет подтверждён, заказ готов к передаче в производство.';
    } else if (activity.action === 'DESIGN_REVISION_REQUESTED') {
      note = `Запрошены правки #${String(newValues.revisionCount ?? details.revisionCount ?? '')}: ${String(newValues.notes ?? details.notes ?? '')}`;
    }

    return {
      label: activity.action === 'STATUS_CHANGED'
        ? `${ORDER_STATUS_LABELS[String(details.from)] ?? String(details.from ?? 'Статус')} → ${ORDER_STATUS_LABELS[String(details.to)] ?? String(details.to ?? 'Статус')}`
        : activity.action === 'ORDER_CREATED'
          ? 'Заказ создан'
          : activity.action === 'DESIGN_TASK_CREATED'
            ? 'Очередь дизайна'
            : activity.action === 'DESIGNER_ASSIGNED'
              ? 'Дизайнер назначен'
              : activity.action === 'DESIGN_STARTED'
                ? 'Работа начата'
                : activity.action === 'DESIGN_FILE_UPLOADED'
                  ? 'Макет загружен'
                  : activity.action === 'DESIGN_APPROVED'
                    ? 'Дизайн подтверждён'
                    : activity.action === 'DESIGN_REVISION_REQUESTED'
                      ? 'Запрошены правки'
                      : 'Данные заказа изменены',
      date: activity.createdAt.toISOString(),
      note,
      actor,
    };
  });

  if (!activities.some((activity) => activity.action === 'ORDER_CREATED')) {
    history.unshift({
      label: 'Заказ создан',
      date: order.createdAt,
      note: 'Заказ зарегистрирован в системе.',
      actor: 'Система',
    });
  }

  return { ...order, history };
}
