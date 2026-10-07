import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const movementSchema = z.object({
  itemId: z.string().trim().min(1),
  type: z.enum(['INCOMING', 'OUTGOING']),
  quantity: z.coerce.number().int().min(1).max(100_000),
  reason: z.string().trim().min(3).max(300),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });
  if (!hasPermission(user.role, 'warehouse:write')) {
    return NextResponse.json({ error: 'Недостаточно прав для изменения остатков.' }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = movementSchema.safeParse({
    itemId: formData.get('itemId'),
    type: formData.get('type'),
    quantity: formData.get('quantity'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Укажите тип, количество и причину операции.' }, { status: 400 });

  const { itemId, type, quantity, reason } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const itemUpdate = type === 'INCOMING'
        ? await tx.inventoryItem.updateMany({ where: { id: itemId }, data: { stock: { increment: quantity } } })
        : await tx.inventoryItem.updateMany({ where: { id: itemId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });

      if (!itemUpdate.count) {
        const itemExists = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { id: true } });
        throw new Error(itemExists ? 'INSUFFICIENT_STOCK' : 'ITEM_NOT_FOUND');
      }

      await tx.inventoryMovement.create({
        data: {
          itemId,
          type,
          quantity,
          reason,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id.startsWith('demo-') ? undefined : user.id,
          action: `inventory_${type.toLowerCase()}`,
          entity: 'InventoryItem',
          entityId: itemId,
          details: `${quantity} шт.: ${reason}`,
        },
      });
    });

    const url = new URL('/warehouse', request.url);
    url.searchParams.set('updated', '1');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Недостаточно товара на складе.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') {
      return NextResponse.json({ error: 'Позиция не найдена.' }, { status: 404 });
    }
    console.error('Inventory movement failed:', error);
    return NextResponse.json({ error: 'Не удалось сохранить складскую операцию.' }, { status: 500 });
  }
}
