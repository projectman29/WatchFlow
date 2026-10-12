import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/access';
import { buildAiSalesSummary, sumCollectedRevenue } from '@/lib/ai-sales';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getRecordScope } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(user, 'ai.kpi.view_self') && !hasPermission(user, 'ai.kpi.view_team')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      summary: buildAiSalesSummary({
        totalRevenue: 0,
        targetRevenue: 0,
        paidOrders: 0,
        qualifiedLeads: 0,
      }),
      note: 'Database is not configured. Showing empty read-only snapshot.',
    });
  }

  try {
    const recordScope = await getRecordScope(user);
    const [orders, leads, salesPlans] = await Promise.all([
      prisma.order.findMany({
        where: recordScope ?? undefined,
        select: {
          total: true,
          deposit: true,
          paymentStatus: true,
        },
      }),
      prisma.lead.findMany({
        where: recordScope ?? undefined,
        select: {
          status: true,
        },
      }),
      prisma.salesPlan.findMany({
        where: recordScope ? { employeeId: recordScope.managerId } : undefined,
        select: {
          targetAmount: true,
        },
      }),
    ]);

    const paidOrders = orders.filter((order) => ['PAID', 'PARTIAL'].includes(order.paymentStatus));
    const totalRevenue = sumCollectedRevenue(paidOrders.map((order) => ({
      total: Number(order.total ?? 0),
      deposit: Number(order.deposit ?? 0),
      paymentStatus: order.paymentStatus,
    })));
    const targetRevenue = salesPlans.reduce((sum, plan) => sum + Number(plan.targetAmount ?? 0), 0);
    const qualifiedLeads = leads.filter((lead) => ['INTERESTED', 'WAITING_PAYMENT', 'WON'].includes(lead.status)).length;

    return NextResponse.json({
      summary: buildAiSalesSummary({
        totalRevenue,
        targetRevenue,
        paidOrders: paidOrders.length,
        qualifiedLeads,
      }),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unable to calculate AI sales summary:', error);
    return NextResponse.json({ error: 'Unable to calculate AI summary.' }, { status: 500 });
  }
}
