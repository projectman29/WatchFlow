import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getLeadAssignees, getRecordScope } from '@/lib/db-data';
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
    action: formData.get('action'),
    status: formData.get('status') ?? undefined,
    reasonLost: formData.get('reasonLost') ?? undefined,
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
    return NextResponse.json({ error: 'Проверьте поля лида и причину отказа.' }, { status: 400 });
  }

  if (parsed.data.action === 'status' && !hasValidLeadLossReason(parsed.data.status, parsed.data.reasonLost)) {
    return NextResponse.json({ error: 'Укажите причину отказа.' }, { status: 400 });
  }

  const scope = await getRecordScope(user);
  const existingLead = await prisma.lead.findFirst({
    where: { id, ...(scope ?? {}) },
    select: { id: true, clientId: true },
  });

  if (!existingLead) {
    return NextResponse.json({ error: 'Лид не найден или недоступен.' }, { status: 404 });
  }

  if (parsed.data.action === 'status') {
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        status: parsed.data.status,
        reasonLost: parsed.data.status === 'LOST' ? parsed.data.reasonLost : null,
      },
    });
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
