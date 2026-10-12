import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { canTransitionOrderWorkflow } from '@/lib/orders';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  orderId: z.string().trim().min(1),
  status: z.enum([
    'DESIGN_IN_PROGRESS',
    'WAITING_CLIENT_APPROVAL',
    'DESIGN_APPROVED',
    'IN_PRODUCTION',
    'QUALITY_CONTROL',
    'READY_FOR_PACKING',
    'READY_FOR_SHIPMENT',
  ]),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });

  const canDesign = hasPermission(user.role, 'design:write');
  const canProduce = hasPermission(user.role, 'production:write');
  if (!canDesign && !canProduce) {
    return NextResponse.json({ error: 'Недостаточно прав для изменения этапа заказа.' }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = updateSchema.safeParse({ orderId: formData.get('orderId'), status: formData.get('status') });
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте этап заказа.' }, { status: 400 });

  try {
    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId }, select: { id: true, number: true, status: true } });
    if (!order) return NextResponse.json({ error: 'Заказ не найден.' }, { status: 404 });

    if (!canTransitionOrderWorkflow(user.role, order.status, parsed.data.status)) {
      return NextResponse.json({ error: 'Недопустимый переход этапа для этой роли.' }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: parsed.data.status } }),
      prisma.activityLog.create({
        data: {
          userId: user.id.startsWith('demo-') ? undefined : user.id,
          action: 'order_status_changed',
          entity: 'Order',
          entityId: order.id,
          details: `${order.number}: ${order.status} → ${parsed.data.status}`,
        },
      }),
    ]);

    const url = new URL(canDesign && !canProduce ? '/design' : '/production', request.url);
    url.searchParams.set('updated', '1');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error('Order workflow update failed:', error);
    return NextResponse.json({ error: 'Не удалось сохранить этап заказа.' }, { status: 500 });
  }
}
