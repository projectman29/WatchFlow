import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LEAD_SOURCES } from '@/lib/crm';
import { getLeadAssignees } from '@/lib/db-data';

const createLeadSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  whatsapp: z.string().trim().max(40).optional(),
  instagram: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  value: z.coerce.number().finite().min(0).max(1_000_000),
  source: z.enum(LEAD_SOURCES),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });
  }

  if (!hasPermission(user.role, 'leads:write')) {
    return NextResponse.json({ error: 'Недостаточно прав для создания лида.' }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = createLeadSchema.safeParse({
    clientName: formData.get('clientName'),
    phone: formData.get('phone'),
    whatsapp: formData.get('whatsapp') ?? undefined,
    instagram: formData.get('instagram') ?? undefined,
    city: formData.get('city') ?? undefined,
    value: formData.get('value'),
    source: formData.get('source'),
    notes: formData.get('notes') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Проверьте имя клиента, телефон, источник и сумму.' }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true },
  });

  if (['manager', 'sales'].includes(user.role.toLowerCase()) && !employee) {
    return NextResponse.json({ error: 'Для пользователя не найден профиль сотрудника.' }, { status: 403 });
  }

  const assignees = await getLeadAssignees(user);
  const requestedAssigneeId = String(formData.get('assignedToId') ?? '').trim();
  const assignee = user.role.toLowerCase() === 'sales'
    ? assignees[0]
    : assignees.find((candidate) => candidate.id === (requestedAssigneeId || employee?.id));

  if (requestedAssigneeId && !assignees.some((candidate) => candidate.id === requestedAssigneeId)) {
    return NextResponse.json({ error: 'Нельзя назначить лид этому сотруднику.' }, { status: 403 });
  }

  if (['manager', 'sales'].includes(user.role.toLowerCase()) && !assignee) {
    return NextResponse.json({ error: 'Не удалось определить ответственного сотрудника.' }, { status: 403 });
  }

  try {
    await prisma.lead.create({
      data: {
        title: `Заявка: ${parsed.data.clientName}`,
        source: parsed.data.source,
        value: parsed.data.value,
        notes: parsed.data.notes || null,
        manager: assignee ? { connect: { id: assignee.id } } : undefined,
        client: {
          create: {
            name: parsed.data.clientName,
            phone: parsed.data.phone,
            whatsapp: parsed.data.whatsapp || null,
            instagram: parsed.data.instagram || null,
            city: parsed.data.city || null,
            source: parsed.data.source,
            status: 'NEW',
          },
        },
      },
    });
  } catch (error) {
    console.error('Lead creation failed:', error);
    return NextResponse.json({ error: 'Не удалось сохранить лид.' }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/crm?lead=created', request.url), 303);
}
