import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { createOrderFromQualifiedLead } from '@/lib/ai-sales-foundation';
import { getRecordScope } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';
import { isSalesDataFoundationReady } from '@/lib/sales-data-readiness';

const convertSchema = z.object({
  total: z.number().finite().positive().max(1_000_000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!hasPermission(user, 'leads:write') || !hasPermission(user, 'orders:write')) {
    return NextResponse.json({ error: 'Not enough rights to create an order from this lead.' }, { status: 403 });
  }
  if (!await isSalesDataFoundationReady()) {
    return NextResponse.json({ error: 'Order creation is temporarily unavailable until the database is updated.' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = convertSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'A confirmed order total is required.' }, { status: 400 });

  const { id } = await params;
  const scope = await getRecordScope(user);
  const lead = await prisma.lead.findFirst({
    where: { id, ...(scope ?? {}) },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: 'Lead not found or not available.' }, { status: 404 });

  try {
    const order = await createOrderFromQualifiedLead(lead.id, parsed.data.total, { id: user.id, name: user.name });
    return NextResponse.json({ orderId: order.id, number: order.number }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && [
      'Only qualified leads can be converted to orders.',
      'An order already exists for this lead.',
      'The lead is outside the 30-day conversion window.',
      'Order total must be greater than zero.',
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
