import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { LEAD_LOSS_REASONS, LEAD_SOURCES, LEAD_STAGES, normalizeOptionalString } from '@/lib/crm';
import { prisma } from '@/lib/prisma';

function successResponse(request: NextRequest, id: string) {
  const accept = request.headers.get('accept') ?? '';
  const isBrowserNavigation =
    request.headers.get('sec-fetch-mode') === 'navigate' ||
    request.headers.get('sec-fetch-dest') === 'document';
  const isHtmlForm =
    request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') ||
    request.headers.get('content-type')?.includes('multipart/form-data');

  if (isBrowserNavigation || (isHtmlForm && !accept.includes('application/json'))) {
    return NextResponse.redirect(new URL('/crm', request.url), 303);
  }

  return NextResponse.json({ success: true, leadId: id });
}

const updateLeadSchema = z.object({
  action: z.enum(['status', 'edit']),
  status: z.enum(LEAD_STAGES).optional(),
  reasonLost: z.enum(LEAD_LOSS_REASONS).optional(),
  clientName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  instagram: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  value: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),
  assignedToId: z.string().trim().min(1).max(120).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!hasPermission(user, 'leads:write')) {
    return NextResponse.json({ error: 'Not enough rights to edit this lead.' }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const parsed = updateLeadSchema.safeParse({
    action: normalizeOptionalString(formData.get('action')) ?? 'status',
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
    return NextResponse.json({ error: 'Check the lead fields and reason for loss.' }, { status: 400 });
  }

  const {
    action,
    status,
    reasonLost,
    clientName,
    phone,
    whatsapp,
    instagram,
    city,
    source,
    value,
    notes,
    assignedToId,
  } = parsed.data;

  const existingLead = await prisma.lead.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!existingLead) {
    return NextResponse.json({ error: 'Lead not found or not available.' }, { status: 404 });
  }

  if (action === 'status') {
    await prisma.lead.update({
      where: { id },
      data: {
        status: status ?? existingLead.status,
        reasonLost: status === 'LOST' ? reasonLost ?? null : null,
      },
    });

    return successResponse(request, id);
  }

  const clientData = {
    name: clientName ?? existingLead.client?.name ?? existingLead.title,
    phone: phone ?? existingLead.client?.phone ?? null,
    whatsapp: whatsapp ?? existingLead.client?.whatsapp ?? null,
    instagram: instagram ?? existingLead.client?.instagram ?? null,
    city: city ?? existingLead.client?.city ?? null,
    source: source ?? existingLead.client?.source ?? existingLead.source ?? 'OTHER',
    status: existingLead.client?.status ?? 'NEW',
    notes: notes ?? existingLead.client?.notes ?? existingLead.notes ?? null,
  };

  const leadUpdateData = {
    source: source ?? existingLead.source ?? undefined,
    value: value ?? existingLead.value,
    notes: notes ?? existingLead.notes ?? undefined,
    title: clientName ? `Заявка: ${clientName}` : existingLead.title,
    ...(assignedToId ? { manager: { connect: { id: assignedToId } } } : {}),
    ...(existingLead.clientId
      ? { client: { update: clientData } }
      : { client: { create: clientData } }),
  };

  await prisma.lead.update({
    where: { id },
    data: leadUpdateData,
  });

  return successResponse(request, id);
}
