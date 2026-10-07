import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { canTransitionShipmentStatus, type LogisticsStatus } from '@/lib/logistics';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  orderId: z.string().trim().min(1),
  status: z.enum(['SHIPPED', 'DELIVERED', 'RETURNED']),
  trackingNumber: z.string().trim().max(120).optional(),
  courierName: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });
  }

  if (!hasPermission(user.role, 'logistics:write')) {
    return NextResponse.json({ error: 'Недостаточно прав для изменения доставки.' }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = updateSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
    trackingNumber: formData.get('trackingNumber') ?? '',
    courierName: formData.get('courierName') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Проверьте данные отправления.' }, { status: 400 });
  }

  const { orderId, status, trackingNumber, courierName } = parsed.data;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) {
      return NextResponse.json({ error: 'Заказ не найден.' }, { status: 404 });
    }

    const shipment = order.shipments[0];
    const currentStatus = shipment
      ? (shipment.status === 'PREPARING' ? 'READY_FOR_SHIPMENT' : shipment.status)
      : order.status;

    if (!canTransitionShipmentStatus(currentStatus, status as LogisticsStatus)) {
      return NextResponse.json({ error: 'Этот переход статуса доставки недопустим.' }, { status: 409 });
    }

    if (status === 'SHIPPED' && !trackingNumber && !courierName) {
      return NextResponse.json({ error: 'Укажите трек-номер или службу доставки.' }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const shipmentData = {
        status,
        ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber || null } : {}),
        ...(courierName !== undefined ? { courierName: courierName || null } : {}),
        ...(status === 'SHIPPED' ? { shippedAt: now } : {}),
        ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
      };

      if (shipment) {
        await tx.shipment.update({ where: { id: shipment.id }, data: shipmentData });
      } else {
        await tx.shipment.create({
          data: {
            ...shipmentData,
            order: { connect: { id: order.id } },
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id.startsWith('demo-') ? undefined : user.id,
          action: `shipment_${status.toLowerCase()}`,
          entity: 'Order',
          entityId: order.id,
          details: `Статус отправления ${order.number}: ${status}`,
        },
      });
    });

    const url = new URL('/logistics', request.url);
    url.searchParams.set('updated', status.toLowerCase());
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error('Shipment update failed:', error);
    return NextResponse.json({ error: 'Не удалось сохранить изменения доставки.' }, { status: 500 });
  }
}
