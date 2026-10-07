import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getLeadAssignees, getRecordScope } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';
import {
  hasValidLeadLossReason,
  LEAD_LOSS_REASONS,
  LEAD_SOURCES,
  LEAD_STAGES,
  normalizeOptionalString,
  shouldCreateOrderForStatus,
} from '@/lib/crm';

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
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });
  }

  if (!hasPermission(user.role, 'leads:write')) {
    return NextResponse.json({ error: 'Недостаточно прав для изменения лида.' }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const parsed = updateLeadSchema.safeParse({
    action: normalizeOptionalString(formData.get('action')),
    status: normalizeOptionalString(formData.get('status')),
    reasonLost: normalizeOptionalString(formData.get('reasonLost')),
    clientName: normalizeOptionalString(formData.get('clientName')),
    phone: normalizeOptionalString(formData.get('phone')),
    whatsapp: normalizeOptionalString(formData.get('whatsapp')),
    instagram: normalizeOptionalString(formData.get('instagram')),
    city: normalizeOptionalString(formData.get('city')),
    source: normalizeOptionalString(formData.get('source')),
    value: normalizeOptionalString(formData.get('value')),
    notes: normalizeOptionalString(formData.get('notes')),
    assignedToId: normalizeOptionalString(formData.get('assignedToId')),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Проверьте поля лида и причину отказа.' }, { status: 400 });
  }

  if (parsed.data.action === 'status' && !hasValidLeadLossReason(parsed.data.status, parsed.data.reasonLost)) {
    return NextResponse.json({ error: 'Укажите причину отказа.' }, { status: 400 });
  }

  const scope = await getRecordScope(user);
  const existingLead = await prisma.lead.findFirst({
    where: { id, ...(scope ?? {}) },
    select: {
      id: true,
      clientId: true,
      managerId: true,
      status: true,
      value: true,
      notes: true,
    },
  });

  if (!existingLead) {
    return NextResponse.json({ error: 'Лид не найден или недоступен.' }, { status: 404 });
  }

  if (parsed.data.action === 'status') {
    const previousStatus = existingLead.status;

    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        status: parsed.data.status,
        reasonLost: parsed.data.status === 'LOST' ? parsed.data.reasonLost : null,
      },
    });

    if (shouldCreateOrderForStatus(parsed.data.status, previousStatus)) {
      const existingOrder = await prisma.order.findFirst({
        where: { leadId: existingLead.id },
        select: { id: true },
      });

      if (!existingOrder && existingLead.clientId) {
        const orderCount = await prisma.order.count();
        const orderNumber = `WF-${String(orderCount + 1001)}`;

        await prisma.order.create({
          data: {
            number: orderNumber,
            status: 'NEW',
            total: Number(existingLead.value ?? 0),
            paymentStatus: 'PAID',
            client: { connect: { id: existingLead.clientId } },
            lead: { connect: { id: existingLead.id } },
            manager: existingLead.managerId ? { connect: { id: existingLead.managerId } } : undefined,
            items: {
              create: [{
                productName: 'Custom Watch',
                quantity: 1,
                unitPrice: Number(existingLead.value ?? 0),
                model: 'Custom',
                color: 'Черный',
                strap: 'Кожаный',
                engraving: existingLead.notes ?? '',
              }],
            },
          },
        });
      }
    }

    return NextResponse.redirect(new URL('/crm?lead=updated', request.url), 303);
  }

  if (parsed.data.action !== 'edit') {
    return NextResponse.json({ error: 'Неизвестное действие.' }, { status: 400 });
  }

  const edit = parsed.data;
  const assignees = await getLeadAssignees(user);
  const assignee = assignees.find((candidate) => candidate.id === edit.assignedToId);

  if (!assignee) {
    return NextResponse.json({ error: 'Нельзя назначить лид этому сотруднику.' }, { status: 403 });
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

  await prisma.lead.update({
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

  return NextResponse.redirect(new URL('/crm?lead=edited', request.url), 303);
}
