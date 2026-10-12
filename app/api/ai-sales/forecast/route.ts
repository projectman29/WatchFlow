import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/access';
import { buildAiForecast, sumCollectedRevenue } from '@/lib/ai-sales';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(user, 'ai.chat.use') && !hasPermission(user, 'ai.kpi.view_self') && !hasPermission(user, 'ai.kpi.view_team')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      forecast: buildAiForecast({
        actualRevenue: 0,
        averageDailyRevenue: 0,
        remainingWorkDays: 0,
      }),
      note: 'Database is not configured. Showing empty forecast snapshot.',
    });
  }

  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const remainingWorkDays = Math.max(0, monthEnd.getDate() - today.getDate());

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
      select: {
        total: true,
        deposit: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    const actualRevenue = sumCollectedRevenue(orders.map((order) => ({
      total: Number(order.total ?? 0),
      deposit: Number(order.deposit ?? 0),
      paymentStatus: order.paymentStatus,
    })));

    const daysInWindow = Math.max(1, Math.min(30, Math.max(1, today.getDate())));
    const averageDailyRevenue = actualRevenue > 0 ? actualRevenue / daysInWindow : 0;

    return NextResponse.json({
      forecast: buildAiForecast({
        actualRevenue,
        averageDailyRevenue,
        remainingWorkDays,
      }),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unable to calculate AI sales forecast:', error);
    return NextResponse.json({ error: 'Unable to calculate forecast.' }, { status: 500 });
  }
}
