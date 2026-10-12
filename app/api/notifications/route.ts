import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });
  }
  const notificationUser = user.id.startsWith('demo-') && process.env.DATABASE_URL
    ? await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } })
    : { id: user.id };
  if (!notificationUser) {
    return NextResponse.json({ error: 'Аккаунт не найден.' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: true });
  }

  const formData = await request.formData();
  const action = formData.get('action');

  try {
    if (action === 'read-all') {
      await prisma.notification.updateMany({
        where: { userId: notificationUser.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (action === 'read-one') {
      const notificationId = formData.get('notificationId');
      if (typeof notificationId !== 'string' || notificationId.length === 0) {
        return NextResponse.json({ error: 'Не указано уведомление.' }, { status: 400 });
      }
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: notificationUser.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else {
      return NextResponse.json({ error: 'Неизвестное действие.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Notification update failed:', error);
    return NextResponse.json({ error: 'Не удалось обновить уведомления.' }, { status: 500 });
  }

  if (request.headers.get('accept')?.includes('text/html')) {
    const url = new URL('/notifications', request.url);
    url.searchParams.set('updated', '1');
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.json({ success: true });
}
