import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getLeadAssignees, getRecordScope } from '@/lib/db-data';
import { createAuditEntry } from '@/lib/audit';
import { createNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { hasValidLeadLossReason, LEAD_LOSS_REASONS, LEAD_SOURCES, LEAD_STAGES } from '@/lib/crm';

const updateLeadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('status'),
    status: z.enum(LEAD_STAGES),
    reasonLost: z.enum(LEAD_LOSS_REASONS).optional(),
  }),
  z.object({
    action: z.literal('edit'),
    clientName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(5).max(40),
    whatsapp: z.string().trim().max(40).optional(),
    instagram: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    source: z.enum(LEAD_SOURCES),
    value: z.coerce.number().finite().min(0).max(1_000_000),
    notes: z.string().trim().max(2000).optional(),
    assignedToId: z.string().trim().min(1),
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const isBrowserFormRequest =
    request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') ||
    request.headers.get('content-type')?.includes('multipart/form-data') ||
    request.headers.get('accept')?.includes('text/html');
  const validationError = (key: string, message: string, status = 400) => {
    if (isBrowserFormRequest) {
      const url = new URL('/crm', request.url);
      url.searchParams.set('leadError', key);
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({ error: message }, { status });
  };

  const user = await getCurrentUserFromCookies();

  if (!user) {
    return validationError('unauthorized', 'Требуется войти в систему.', 401);
  }

  if (!hasPermission(user, 'leads:write')) {
    return validationError('forbidden', 'Недостаточно прав для изменения лида.', 403);
  }

  const { id } = await params;
  const formData = await request.formData();
  const parsed = updateLeadSchema.safeParse({
    action: formData.get('action'),
    status: formData.get('status') ?? undefined,
    reasonLost: formData.get('reasonLost') === '' ? undefined : formData.get('reasonLost') ?? undefined,
    clientName: formData.get('clientName') ?? undefined,
    phone: formData.get('phone') ?? undefined,
    whatsapp: formData.get('whatsapp') ?? undefined,
    instagram: formData.get('instagram') ?? undefined,
    city: formData.get('city') ?? undefined,
    source: formData.get('source') ?? undefined,
    value: formData.get('value') ?? undefined,
    notes: formData.get('notes') ?? undefined,
    assignedToId: formData.get('assignedToId') ?? undefined,
  });

  if (!parsed.success) {
    return validationError('invalid_fields', 'Проверьте поля лида и причину отказа.');
  }

  if (parsed.data.action === 'status' && !hasValidLeadLossReason(parsed.data.status, parsed.data.reasonLost)) {
    return validationError('loss_reason_required', 'Укажите причину отказа.');
  }

  const scope = await getRecordScope(user);
  const existingLead = await prisma.lead.findFirst({
    where: { id, ...(scope ?? {}) },
    select: {
      id: true,
      clientId: true,
      managerId: true,
      manager: { select: { userId: true } },
      status: true,
      reasonLost: true,
      source: true,
      notes: true,
      value: true,
      title: true,
      client: {
        select: {
          name: true,
          phone: true,
          whatsapp: true,
          instagram: true,
          city: true,
        },
      },
    },
  });

  if (!existingLead) {
    return validationError('not_found', 'Лид не найден или недоступен.', 404);
  }

  if (parsed.data.action === 'status') {
    if (parsed.data.status === 'WON') {
      if (!existingLead.clientId) {
        return validationError('client_required', 'Для создания заказа сначала привяжите к лиду клиента.');
      }

      try {
        const order = await prisma.$transaction(async (transaction) => {
          const currentOrder = await transaction.order.findFirst({
            where: { leadId: existingLead.id },
            select: { number: true },
          });

          if (currentOrder) {
            await transaction.lead.update({
              where: { id: existingLead.id },
              data: { status: 'WON', reasonLost: null },
            });
            return currentOrder;
          }

          const year = new Date().getFullYear();
          const prefix = `ORD-${year}-`;
          const lockKey = BigInt(22_359) * BigInt(1_000_000) + BigInt(year);
          await transaction.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${lockKey})`;
          const existingNumbers = await transaction.order.findMany({
            where: { number: { startsWith: prefix } },
            select: { number: true },
          });
          const nextSequence = existingNumbers.reduce((maximum, candidate) => {
            const sequence = Number(candidate.number.slice(prefix.length));
            return Number.isSafeInteger(sequence) ? Math.max(maximum, sequence) : maximum;
          }, 0) + 1;
          const number = `${prefix}${String(nextSequence).padStart(6, '0')}`;

          const createdOrder = await transaction.order.create({
            data: {
              number,
              status: 'NEW',
              total: Number(existingLead.value),
              deposit: Number(existingLead.value),
              paymentStatus: 'PAID',
              clientId: existingLead.clientId,
              leadId: existingLead.id,
              managerId: existingLead.managerId,
              items: {
                create: {
                  productName: 'Именные часы',
                  quantity: 1,
                  unitPrice: Number(existingLead.value),
                },
              },
            },
            select: { id: true, number: true },
          });

          await transaction.activityLog.create({
            data: {
              userId: user.id.startsWith('demo-') ? undefined : user.id,
              action: 'ORDER_CREATED',
              entity: 'Order',
              entityId: createdOrder.id,
              details: JSON.stringify({
                actor: user.name,
                leadId: existingLead.id,
                leadTitle: existingLead.title,
                status: 'NEW',
              }),
            },
          });
          await createAuditEntry(transaction, {
            userId: user.id,
            actor: user.name,
            action: 'LEAD_STATUS_CHANGED',
            entity: 'Lead',
            entityId: existingLead.id,
            details: {
              old: { status: existingLead.status, reasonLost: existingLead.reasonLost },
              new: { status: 'WON', reasonLost: null, orderNumber: createdOrder.number },
            },
          });
          await createNotifications(transaction, {
            userIds: existingLead.manager ? [existingLead.manager.userId] : [],
            roles: existingLead.manager ? [] : ['admin'],
            type: 'NEW_ORDER_ASSIGNED',
            title: 'Новый заказ назначен вам',
            message: `Создан заказ ${createdOrder.number} по клиенту «${existingLead.title}».`,
            href: `/orders/${createdOrder.id}`,
          });

          await transaction.lead.update({
            where: { id: existingLead.id },
            data: { status: 'WON', reasonLost: null },
          });

          return createdOrder;
        });

        const redirectUrl = new URL('/crm', request.url);
        redirectUrl.searchParams.set('lead', 'order_created');
        redirectUrl.searchParams.set('orderNumber', order.number);
        return NextResponse.redirect(redirectUrl, 303);
      } catch (error) {
        console.error('Order creation from lead failed:', error);
        return validationError('order_creation_failed', 'Не удалось создать заказ. Данные лида не изменены.', 500);
      }
    }

    const statusData = parsed.data;
    await prisma.$transaction(async (transaction) => {
      await transaction.lead.update({
        where: { id: existingLead.id },
        data: {
          status: statusData.status,
          reasonLost: statusData.status === 'LOST' ? statusData.reasonLost : null,
        },
      });
      await createAuditEntry(transaction, {
        userId: user.id,
        actor: user.name,
        action: 'LEAD_STATUS_CHANGED',
        entity: 'Lead',
        entityId: existingLead.id,
        details: {
          old: { status: existingLead.status, reasonLost: existingLead.reasonLost },
          new: { status: statusData.status, reasonLost: statusData.status === 'LOST' ? statusData.reasonLost : null },
        },
      });
    });
    return NextResponse.redirect(new URL('/crm?lead=updated', request.url), 303);
  }

  if (parsed.data.action !== 'edit') {
    return validationError('invalid_action', 'Неизвестное действие.');
  }

  const edit = parsed.data;
  const assignees = await getLeadAssignees(user);
  const assignee = assignees.find((candidate) => candidate.id === edit.assignedToId);

  if (!assignee) {
    return validationError('invalid_assignee', 'Нельзя назначить лид этому сотруднику.', 403);
  }

  const clientData = {
    name: edit.clientName,
    phone: edit.phone,
    whatsapp: edit.whatsapp || null,
    instagram: edit.instagram || null,
    city: edit.city || null,
    source: edit.source,
    notes: edit.notes || null,
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.lead.update({
      where: { id: existingLead.id },
      data: {
        title: `Заявка: ${edit.clientName}`,
        source: edit.source,
        value: edit.value,
        notes: edit.notes || null,
        manager: { connect: { id: assignee.id } },
        client: existingLead.clientId ? { update: clientData } : { create: clientData },
      },
    });
    await createAuditEntry(transaction, {
      userId: user.id,
      actor: user.name,
      action: 'LEAD_UPDATED',
      entity: 'Lead',
      entityId: existingLead.id,
      details: {
        old: {
          client: existingLead.client,
          source: existingLead.source,
          value: Number(existingLead.value),
          notes: existingLead.notes,
          managerId: existingLead.managerId,
        },
        new: {
          client: clientData,
          source: edit.source,
          value: edit.value,
          notes: edit.notes || null,
          managerId: assignee.id,
        },
      },
    });
  });

  return NextResponse.redirect(new URL('/crm?lead=edited', request.url), 303);
}
