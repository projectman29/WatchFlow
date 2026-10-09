import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getRecordScope } from '@/lib/db-data';
import { createNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { canTransitionOrderStatus, ORDER_STATUS_FLOW } from '@/lib/orders';

const itemSchema = z.object({
  id: z.string().optional(),
  productName: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: z.coerce.number().finite().min(0).max(1_000_000),
  model: z.string().trim().max(120).optional(),
  color: z.string().trim().max(80).optional(),
  strap: z.string().trim().max(80).optional(),
  engraving: z.string().trim().max(200).optional(),
});

const updateOrderSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('status'),
    status: z.enum(ORDER_STATUS_FLOW),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('edit'),
    discount: z.coerce.number().finite().min(0).max(1_000_000),
    deposit: z.coerce.number().finite().min(0).max(1_000_000),
    items: z.array(itemSchema).min(1).max(20),
    removeItemIds: z.array(z.string()).max(20),
  }),
]);

function errorResponse(request: NextRequest, key: string, message: string, status: number) {
  const contentType = request.headers.get('content-type') ?? '';
  const isBrowserForm = contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data') ||
    request.headers.get('accept')?.includes('text/html');

  if (!isBrowserForm) {
    return NextResponse.json({ error: message }, { status });
  }

  const url = new URL(request.nextUrl.pathname, request.url);
  url.searchParams.set('error', key);
  return NextResponse.redirect(url, 303);
}

function actorId(userId: string): string | undefined {
  return userId.startsWith('demo-') ? undefined : userId;
}

function makeAuditDetails(details: Record<string, unknown>, userName: string): string {
  return JSON.stringify({ ...details, actor: userName });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return errorResponse(request, 'unauthorized', 'Требуется войти в систему.', 401);
  }

  if (!hasPermission(user, 'orders:write')) {
    return errorResponse(request, 'forbidden', 'Недостаточно прав для изменения заказа.', 403);
  }

  const { id } = await params;
  const formData = await request.formData();
  const action = formData.get('action');
  const removeItemIds = formData.getAll('removeItemId').map(String);
  const submittedItems = formData.getAll('productName').map((productName, index) => ({
    id: String(formData.getAll('itemId')[index] ?? '') || undefined,
    productName,
    quantity: formData.getAll('quantity')[index],
    unitPrice: formData.getAll('unitPrice')[index],
    model: formData.getAll('model')[index] ?? undefined,
    color: formData.getAll('color')[index] ?? undefined,
    strap: formData.getAll('strap')[index] ?? undefined,
    engraving: formData.getAll('engraving')[index] ?? undefined,
  }));
  const rawData = action === 'edit'
    ? {
        action,
        discount: formData.get('discount'),
        deposit: formData.get('deposit'),
        items: submittedItems.filter((item) =>
          !(item.id && removeItemIds.includes(item.id)) && (item.id || String(item.productName).trim()),
        ),
        removeItemIds,
      }
    : {
        action,
        status: formData.get('status'),
        note: formData.get('note') ?? undefined,
      };
  const parsed = updateOrderSchema.safeParse(rawData);

  if (!parsed.success) {
    return errorResponse(request, 'invalid_fields', 'Проверьте данные заказа и его позиции.', 400);
  }

  const scope = await getRecordScope(user);
  const order = await prisma.order.findFirst({
    where: { id, ...(scope ?? {}) },
    include: { items: true, manager: { select: { userId: true } } },
  });

  if (!order) {
    return errorResponse(request, 'not_found', 'Заказ не найден или недоступен.', 404);
  }

  try {
    if (parsed.data.action === 'status') {
      const statusUpdate = parsed.data;
      if (!canTransitionOrderStatus(order.status, statusUpdate.status)) {
        return errorResponse(request, 'invalid_transition', 'Нельзя пропустить этап или изменить завершённый заказ.', 400);
      }
      if (['DESIGN_IN_PROGRESS', 'WAITING_CLIENT_APPROVAL', 'DESIGN_APPROVED'].includes(statusUpdate.status)) {
        return errorResponse(request, 'invalid_transition', 'Этап дизайна меняется только через задачу дизайнера.', 400);
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.order.update({
          where: { id: order.id },
          data: { status: statusUpdate.status },
        });
        if (statusUpdate.status === 'WAITING_DESIGN') {
          await transaction.designTask.upsert({
            where: { orderId: order.id },
            update: {},
            create: { orderId: order.id },
          });
        }
        await transaction.activityLog.create({
          data: {
            userId: actorId(user.id),
            action: 'STATUS_CHANGED',
            entity: 'Order',
            entityId: order.id,
            details: makeAuditDetails({
              from: order.status,
              to: statusUpdate.status,
              note: statusUpdate.note || null,
            }, user.name),
          },
        });
        if (statusUpdate.status === 'WAITING_DESIGN') {
          await createNotifications(transaction, {
            roles: ['designer'],
            type: 'DESIGN_TASK_ASSIGNED',
            title: 'Новая задача дизайна',
            message: `Заказ ${order.number} ожидает дизайнера.`,
            href: '/design',
          });
        }
        if (statusUpdate.status === 'WAITING_PRODUCTION') {
          await createNotifications(transaction, {
            roles: ['master'],
            type: 'PRODUCTION_TASK_ASSIGNED',
            title: 'Заказ передан в производство',
            message: `Заказ ${order.number} ожидает производства.`,
            href: '/production',
          });
        }
        if (statusUpdate.status === 'READY_FOR_SHIPMENT') {
          await createNotifications(transaction, {
            roles: ['logistics'],
            type: 'SHIPMENT_READY',
            title: 'Необходимо отправить заказ',
            message: `Заказ ${order.number} готов к отправке.`,
            href: '/logistics',
          });
        }
        if (statusUpdate.status === 'SHIPPED' || statusUpdate.status === 'DELIVERED') {
          await createNotifications(transaction, {
            userIds: order.manager ? [order.manager.userId] : [],
            roles: order.manager ? [] : ['manager', 'admin'],
            type: `ORDER_${statusUpdate.status}`,
            title: statusUpdate.status === 'SHIPPED' ? 'Заказ отправлен' : 'Заказ доставлен',
            message: `Статус заказа ${order.number}: ${statusUpdate.status === 'SHIPPED' ? 'отправлен' : 'доставлен'}.`,
            href: `/orders/${order.id}`,
          });
        }
      });

      const successUrl = new URL(request.nextUrl.pathname, request.url);
      successUrl.searchParams.set('updated', 'status');
      return NextResponse.redirect(successUrl, 303);
    }

    const edit = parsed.data;
    const submittedExistingIds = edit.items
      .map((item) => item.id)
      .filter((itemId): itemId is string => Boolean(itemId));
    const editRemovedItemIds = edit.removeItemIds;
    const existingIds = order.items.map((item) => item.id);
    if (
      new Set(submittedExistingIds).size !== submittedExistingIds.length ||
      new Set(editRemovedItemIds).size !== editRemovedItemIds.length ||
      submittedExistingIds.some((itemId) => !existingIds.includes(itemId)) ||
      editRemovedItemIds.some((itemId) => !existingIds.includes(itemId) || submittedExistingIds.includes(itemId)) ||
      existingIds.some((itemId) => !submittedExistingIds.includes(itemId) && !editRemovedItemIds.includes(itemId))
    ) {
      return errorResponse(request, 'invalid_items', 'Состав позиций изменился. Обновите страницу и повторите сохранение.', 400);
    }

    const itemTotal = edit.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    if (edit.discount > itemTotal) {
      return errorResponse(request, 'discount_exceeds_total', 'Скидка не может превышать стоимость позиций.', 400);
    }
    const total = itemTotal - edit.discount;
    if (edit.deposit > total) {
      return errorResponse(request, 'deposit_exceeds_total', 'Предоплата не может превышать сумму заказа.', 400);
    }

    const paymentStatus = edit.deposit === 0
      ? 'PENDING'
      : edit.deposit >= total
        ? 'PAID'
        : 'PARTIAL';
    const oldValues = {
      total: Number(order.total),
      discount: Number(order.discount),
      deposit: Number(order.deposit),
      paymentStatus: order.paymentStatus,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    };
    const newValues = {
      total,
      discount: edit.discount,
      deposit: edit.deposit,
      paymentStatus,
      items: edit.items.map(({ id: itemId, ...item }) => ({ id: itemId ?? null, ...item })),
    };

    await prisma.$transaction(async (transaction) => {
      if (editRemovedItemIds.length > 0) {
        await transaction.orderItem.deleteMany({
          where: { orderId: order.id, id: { in: editRemovedItemIds } },
        });
      }

      await transaction.order.update({
        where: { id: order.id },
        data: {
          total,
          discount: edit.discount,
          deposit: edit.deposit,
          paymentStatus,
        },
      });

      for (const item of edit.items) {
        const itemData = {
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          model: item.model || null,
          color: item.color || null,
          strap: item.strap || null,
          engraving: item.engraving || null,
        };
        if (item.id) {
          await transaction.orderItem.update({
            where: { id: item.id },
            data: itemData,
          });
        } else {
          await transaction.orderItem.create({
            data: { ...itemData, orderId: order.id },
          });
        }
      }

      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'ORDER_UPDATED',
          entity: 'Order',
          entityId: order.id,
          details: makeAuditDetails({ old: oldValues, new: newValues }, user.name),
        },
      });
    });

    const successUrl = new URL(request.nextUrl.pathname, request.url);
    successUrl.searchParams.set('updated', 'order');
    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    console.error('Order update failed:', error);
    return errorResponse(request, 'update_failed', 'Не удалось сохранить заказ. Изменения не применены.', 500);
  }
}
