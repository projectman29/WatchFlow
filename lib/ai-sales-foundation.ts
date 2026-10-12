import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { LEAD_ORDER_CONVERSION_WINDOW_DAYS } from './crm';

export const SALES_ANALYTICS_CURRENCY = 'KZT';
export { LEAD_ORDER_CONVERSION_WINDOW_DAYS } from './crm';

const QUALIFIED_LEAD_STATUSES = ['WAITING_PAYMENT', 'WON'];
const PAYMENT_KINDS = ['RECEIPT', 'REFUND'] as const;
const DIRECT_COST_CATEGORIES = ['MATERIALS', 'LABOR', 'PACKAGING'] as const;

type Actor = { id: string; name: string };

export function isWithinLeadOrderConversionWindow(qualifiedAt: Date | null, orderCreatedAt = new Date()) {
  return qualifiedAt !== null
    && orderCreatedAt.getTime() >= qualifiedAt.getTime()
    && orderCreatedAt.getTime() - qualifiedAt.getTime() <= LEAD_ORDER_CONVERSION_WINDOW_DAYS * 86_400_000;
}

export function calculateKztDirectMargin(
  orderTotal: Prisma.Decimal | number | string,
  orderCurrency: string | null,
  costs: Array<{ amount: Prisma.Decimal | number | string; currency: string; category: string }>,
) {
  if (orderCurrency !== SALES_ANALYTICS_CURRENCY || costs.length === 0) return null;
  if (costs.some((cost) => cost.currency !== SALES_ANALYTICS_CURRENCY)) return null;
  const recordedCategories = new Set(costs.map((cost) => cost.category));
  if (!DIRECT_COST_CATEGORIES.every((category) => recordedCategories.has(category))) return null;

  return costs.reduce(
    (total, cost) => total.minus(cost.amount),
    new Prisma.Decimal(orderTotal),
  );
}

export async function createOrderFromQualifiedLead(
  leadId: string,
  total: number,
  actor: Actor,
  client: PrismaClient = prisma,
) {
  if (!Number.isFinite(total) || total <= 0) throw new Error('Order total must be greater than zero.');

  return client.$transaction(async (transaction) => {
    const lead = await transaction.lead.findUnique({
      where: { id: leadId },
      include: {
        client: true,
        manager: { include: { user: true } },
        orders: { select: { id: true } },
      },
    });

    if (!lead) throw new Error('Lead not found.');
    if (!QUALIFIED_LEAD_STATUSES.includes(lead.status)) {
      throw new Error('Only qualified leads can be converted to orders.');
    }
    if (lead.orders.length > 0) throw new Error('An order already exists for this lead.');

    const firstQualifiedTransition = await transaction.leadStatusHistory.findFirst({
      where: { leadId: lead.id, toStatus: { in: QUALIFIED_LEAD_STATUSES } },
      orderBy: { changedAt: 'asc' },
      select: { changedAt: true },
    });
    const qualifiedAt = firstQualifiedTransition?.changedAt;
    if (!isWithinLeadOrderConversionWindow(qualifiedAt ?? null)) {
      throw new Error('The lead is outside the 30-day conversion window.');
    }

    const employee = lead.manager;
    const order = await transaction.order.create({
      data: {
        number: `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: 'NEW',
        total,
        currency: SALES_ANALYTICS_CURRENCY,
        clientId: lead.clientId,
        leadId: lead.id,
        managerId: employee?.id,
        attributedSalesEmployeeId: employee?.id,
        attributedSalesName: employee?.fullName,
        attributedSalesEmail: employee?.user.email,
      },
    });
    await transaction.activityLog.create({
      data: {
        userId: actor.id.startsWith('demo-') ? undefined : actor.id,
        action: 'ORDER_CREATED_FROM_LEAD',
        entity: 'Order',
        entityId: order.id,
        details: JSON.stringify({
          actor: actor.name,
          leadId: lead.id,
          attributedSalesEmployeeId: employee?.id ?? null,
        }),
      },
    });
    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordOrderPayment(input: {
  orderId: string;
  kind: (typeof PAYMENT_KINDS)[number];
  amount: Prisma.Decimal | number | string;
  currency?: string;
  occurredAt?: Date;
  reference?: string;
  note?: string;
}, actor: Pick<Actor, 'id'>, client: PrismaClient = prisma) {
  if (!PAYMENT_KINDS.includes(input.kind)) throw new Error('Payment kind is invalid.');
  const amount = parsePositiveAmount(input.amount, 'Payment');
  const currency = validateCurrency(input.currency);
  const occurredAt = input.occurredAt ?? new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error('Payment date is invalid.');

  return client.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, currency: true },
    });
    if (!order) throw new Error('Order not found.');
    if (order.currency !== currency) throw new Error('Payment currency must match the order currency.');

    if (input.kind === 'REFUND') {
      const [receipts, refunds] = await Promise.all([
        transaction.orderPayment.aggregate({
          where: { orderId: input.orderId, kind: 'RECEIPT', currency },
          _sum: { amount: true },
        }),
        transaction.orderPayment.aggregate({
          where: { orderId: input.orderId, kind: 'REFUND', currency },
          _sum: { amount: true },
        }),
      ]);
      const available = new Prisma.Decimal(receipts._sum.amount ?? 0)
        .minus(refunds._sum.amount ?? 0);
      if (amount.gt(available)) throw new Error('Refund cannot exceed recorded receipts.');
    }

    const payment = await transaction.orderPayment.create({
      data: {
        orderId: input.orderId,
        kind: input.kind,
        amount,
        currency,
        occurredAt,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        recordedById: actor.id.startsWith('demo-') ? undefined : actor.id,
      },
    });
    await transaction.activityLog.create({
      data: {
        userId: actor.id.startsWith('demo-') ? undefined : actor.id,
        action: input.kind === 'REFUND' ? 'ORDER_REFUND_RECORDED' : 'ORDER_PAYMENT_RECORDED',
        entity: 'Order',
        entityId: input.orderId,
        details: JSON.stringify({ amount: amount.toString(), currency, occurredAt: occurredAt.toISOString() }),
      },
    });
    return payment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordOrderDirectCost(input: {
  orderId: string;
  category: (typeof DIRECT_COST_CATEGORIES)[number];
  amount: Prisma.Decimal | number | string;
  currency?: string;
  incurredAt?: Date;
  description: string;
}, actor: Pick<Actor, 'id'>, client: PrismaClient = prisma) {
  if (!DIRECT_COST_CATEGORIES.includes(input.category)) throw new Error('Cost category is invalid.');
  const amount = parsePositiveAmount(input.amount, 'Cost');
  const description = input.description.trim();
  if (!description) throw new Error('Cost description is required.');
  const currency = validateCurrency(input.currency);
  const incurredAt = input.incurredAt ?? new Date();
  if (Number.isNaN(incurredAt.getTime())) throw new Error('Cost date is invalid.');

  return client.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, currency: true },
    });
    if (!order) throw new Error('Order not found.');
    if (order.currency !== currency) throw new Error('Cost currency must match the order currency.');

    const cost = await transaction.orderDirectCost.create({
      data: {
        orderId: input.orderId,
        category: input.category,
        amount,
        currency,
        incurredAt,
        description,
        recordedById: actor.id.startsWith('demo-') ? undefined : actor.id,
      },
    });
    await transaction.activityLog.create({
      data: {
        userId: actor.id.startsWith('demo-') ? undefined : actor.id,
        action: 'ORDER_DIRECT_COST_RECORDED',
        entity: 'Order',
        entityId: input.orderId,
        details: JSON.stringify({
          category: input.category,
          amount: amount.toString(),
          currency,
          incurredAt: incurredAt.toISOString(),
        }),
      },
    });
    return cost;
  });
}

export async function getKztOrderMargin(orderId: string, client: PrismaClient = prisma) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      total: true,
      currency: true,
      directCosts: { select: { amount: true, currency: true, category: true } },
    },
  });
  if (!order) throw new Error('Order not found.');
  return calculateKztDirectMargin(order.total, order.currency, order.directCosts);
}

function parsePositiveAmount(value: Prisma.Decimal | number | string, label: string) {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new Error(`${label} amount is invalid.`);
  }
  if (!amount.isFinite() || amount.lte(0)) throw new Error(`${label} amount must be greater than zero.`);
  return amount;
}

function validateCurrency(currency: string | undefined) {
  const value = currency ?? SALES_ANALYTICS_CURRENCY;
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('Currency must be a three-letter ISO code.');
  return value;
}
