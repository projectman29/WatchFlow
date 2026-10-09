import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { canTransitionDesignTask } from '@/lib/design';
import { getRecordScope } from '@/lib/db-data';
import { createNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

const taskActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    orderId: z.string().min(1),
    designerId: z.string().optional(),
    deadline: z.string().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal('assign'),
    designerId: z.string().min(1),
  }),
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('revision'),
    notes: z.string().trim().min(1).max(2000),
  }),
]);

function isBrowserForm(request: NextRequest): boolean {
  return request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') === true ||
    request.headers.get('content-type')?.includes('multipart/form-data') === true ||
    request.headers.get('accept')?.includes('text/html') === true;
}

function respond(request: NextRequest, message: string, status: number, success = false) {
  if (!isBrowserForm(request)) {
    return NextResponse.json(success ? { success: true } : { error: message }, { status: success ? 200 : status });
  }

  const url = new URL('/design', request.url);
  url.searchParams.set(success ? 'success' : 'error', message);
  return NextResponse.redirect(url, 303);
}

function actorId(userId: string): string | undefined {
  return userId.startsWith('demo-') ? undefined : userId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();
  if (!user) return respond(request, 'unauthorized', 401);

  const formData = await request.formData();
  const parsed = taskActionSchema.safeParse({
    action: formData.get('action'),
    orderId: formData.get('orderId') ?? undefined,
    designerId: formData.get('designerId') ?? undefined,
    deadline: formData.get('deadline') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  });
  if (!parsed.success) return respond(request, 'invalid_fields', 400);

  const { id } = await params;
  const canManage = hasPermission(user, 'orders:write');
  const canDesign = hasPermission(user, 'design:write');

  if (parsed.data.action === 'create') {
    const createData = parsed.data;
    if (!canManage) return respond(request, 'forbidden', 403);
    const date = createData.deadline ? new Date(`${createData.deadline}T23:59:59`) : undefined;
    if (date && Number.isNaN(date.getTime())) return respond(request, 'invalid_fields', 400);
    let assignedDesignerUserId: string | undefined;
    if (createData.designerId) {
      const designer = await prisma.employee.findFirst({
        where: { id: createData.designerId, isActive: true, user: { role: { name: 'designer' } } },
        select: { id: true, userId: true },
      });
      if (!designer) return respond(request, 'invalid_designer', 400);
      assignedDesignerUserId = designer.userId;
    }

    const scope = await getRecordScope(user);
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { designTask: true, manager: { select: { userId: true } } },
    });
    if (!order) return respond(request, 'order_not_found', 404);
    if (scope && (!order.managerId || !scope.managerId.in.includes(order.managerId))) {
      return respond(request, 'forbidden', 403);
    }
    if (order.designTask) return respond(request, 'task_exists', 409);
    if (!['NEW', 'WAITING_DESIGN', 'DESIGN_IN_PROGRESS'].includes(order.status)) {
      return respond(request, 'wrong_order_status', 400);
    }

    await prisma.$transaction(async (transaction) => {
      const created = await transaction.designTask.create({
        data: {
          orderId: order.id,
          assignedDesignerId: createData.designerId || null,
          deadline: date,
          notes: createData.notes || null,
          status: 'NEW',
        },
      });
      await transaction.order.update({
        where: { id: order.id },
        data: { status: 'WAITING_DESIGN' },
      });
      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'DESIGN_TASK_CREATED',
          entity: 'Order',
          entityId: order.id,
          details: JSON.stringify({ actor: user.name, taskId: created.id, assignedDesignerId: createData.designerId ?? null }),
        },
      });
      await createNotifications(transaction, {
        userIds: assignedDesignerUserId ? [assignedDesignerUserId] : [],
        roles: assignedDesignerUserId ? [] : ['designer'],
        type: 'DESIGN_TASK_ASSIGNED',
        title: 'Новая задача дизайна',
        message: `Заказ ${order.number} добавлен в очередь дизайна.`,
        href: '/design',
      });
    });

    return respond(request, 'created', 201, true);
  }

  const task = await prisma.designTask.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, number: true, status: true, managerId: true, manager: { select: { userId: true } } } },
      assignedDesigner: { select: { userId: true } },
    },
  });
  if (!task) return respond(request, 'task_not_found', 404);
  const scope = await getRecordScope(user);
  if (scope && (!task.order.managerId || !scope.managerId.in.includes(task.order.managerId))) {
    return respond(request, 'forbidden', 403);
  }

  const employee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true },
  });
  const ownsTask = task.assignedDesignerId === employee?.id;

  if (parsed.data.action === 'assign') {
    if (!canManage) return respond(request, 'forbidden', 403);
    if (!canTransitionDesignTask(task.status, 'assign')) return respond(request, 'invalid_transition', 400);
    const designer = await prisma.employee.findFirst({
      where: { id: parsed.data.designerId, isActive: true, user: { role: { name: 'designer' } } },
      select: { id: true, userId: true },
    });
    if (!designer) return respond(request, 'invalid_designer', 400);
    await prisma.$transaction(async (transaction) => {
      await transaction.designTask.update({
        where: { id: task.id },
        data: { assignedDesignerId: designer.id },
      });
      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'DESIGNER_ASSIGNED',
          entity: 'Order',
          entityId: task.order.id,
          details: JSON.stringify({
            actor: user.name,
            taskId: task.id,
            old: { assignedDesignerId: task.assignedDesignerId },
            new: { assignedDesignerId: designer.id },
          }),
        },
      });
      await createNotifications(transaction, {
        userIds: [designer.userId],
        type: 'DESIGN_TASK_ASSIGNED',
        title: 'Вам назначена задача дизайна',
        message: `Заказ ${task.order.number} назначен вам.`,
        href: '/design',
      });
    });
    return respond(request, 'assigned', 200, true);
  }

  if (parsed.data.action === 'start') {
    if (!canDesign || (task.assignedDesignerId && !ownsTask)) return respond(request, 'forbidden', 403);
    if (!canTransitionDesignTask(task.status, 'start')) return respond(request, 'invalid_transition', 400);
    const assignedDesignerId = task.assignedDesignerId ?? employee?.id;
    if (!assignedDesignerId && !canManage) return respond(request, 'designer_profile_missing', 403);
    await prisma.$transaction(async (transaction) => {
      await transaction.designTask.update({
        where: { id: task.id },
        data: {
          status: 'IN_PROGRESS',
          ...(assignedDesignerId ? { assignedDesignerId } : {}),
        },
      });
      await transaction.order.update({
        where: { id: task.order.id },
        data: { status: 'DESIGN_IN_PROGRESS' },
      });
      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'DESIGN_STARTED',
          entity: 'Order',
          entityId: task.order.id,
          details: JSON.stringify({
            actor: user.name,
            taskId: task.id,
            old: { designStatus: task.status, orderStatus: task.order.status },
            new: { designStatus: 'IN_PROGRESS', orderStatus: 'DESIGN_IN_PROGRESS' },
          }),
        },
      });
    });
    return respond(request, 'started', 200, true);
  }

  if (!canManage) return respond(request, 'forbidden', 403);

  if (parsed.data.action === 'approve') {
    if (!canTransitionDesignTask(task.status, 'approve')) return respond(request, 'invalid_transition', 400);
    await prisma.$transaction(async (transaction) => {
      await transaction.designTask.update({
        where: { id: task.id },
        data: { status: 'APPROVED' },
      });
      await transaction.order.update({
        where: { id: task.order.id },
        data: { status: 'DESIGN_APPROVED' },
      });
      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'DESIGN_APPROVED',
          entity: 'Order',
          entityId: task.order.id,
          details: JSON.stringify({
            actor: user.name,
            taskId: task.id,
            old: { designStatus: task.status, orderStatus: task.order.status },
            new: { designStatus: 'APPROVED', orderStatus: 'DESIGN_APPROVED' },
          }),
        },
      });
    });
    return respond(request, 'approved', 200, true);
  }

  if (parsed.data.action === 'revision') {
    if (!canTransitionDesignTask(task.status, 'revision')) return respond(request, 'invalid_transition', 400);
    const revisionNotes = parsed.data.notes;
    await prisma.$transaction(async (transaction) => {
      await transaction.designTask.update({
        where: { id: task.id },
        data: {
          status: 'REVISION',
          revisionCount: { increment: 1 },
          notes: revisionNotes,
        },
      });
      await transaction.order.update({
        where: { id: task.order.id },
        data: { status: 'DESIGN_IN_PROGRESS' },
      });
      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'DESIGN_REVISION_REQUESTED',
          entity: 'Order',
          entityId: task.order.id,
          details: JSON.stringify({
            actor: user.name,
            taskId: task.id,
            old: { designStatus: task.status, orderStatus: task.order.status, revisionCount: task.revisionCount },
            new: {
              designStatus: 'REVISION',
              orderStatus: 'DESIGN_IN_PROGRESS',
              revisionCount: task.revisionCount + 1,
              notes: revisionNotes,
            },
          }),
        },
      });
      await createNotifications(transaction, {
        userIds: task.assignedDesigner ? [task.assignedDesigner.userId] : [],
        roles: task.assignedDesigner ? [] : ['designer'],
        type: 'DESIGN_REVISION_REQUESTED',
        title: 'Клиент запросил изменения',
        message: `По заказу ${task.order.number} запрошены правки: ${revisionNotes}`,
        href: '/design',
      });
    });
    return respond(request, 'revision_requested', 200, true);
  }

  return respond(request, 'invalid_action', 400);
}
