export type AiSalesSummaryInput = {
  totalRevenue: number;
  targetRevenue?: number;
  paidOrders: number;
  qualifiedLeads?: number;
  generatedAt?: string;
};

export type CollectedOrder = {
  total: number;
  deposit: number;
  paymentStatus: string;
};

export function sumCollectedRevenue(orders: readonly CollectedOrder[]): number {
  return orders.reduce((sum, order) => {
    if (order.paymentStatus === 'PAID') return sum + order.total;
    if (order.paymentStatus === 'PARTIAL') return sum + order.deposit;
    return sum;
  }, 0);
}

export type AiSalesSummary = {
  totalRevenue: number;
  targetRevenue: number;
  achievementRate: number;
  conversionRate: number;
  averageOrderValue: number;
  paidOrders: number;
  qualifiedLeads: number;
  generatedAt: string;
};

export function buildAiSalesSummary(input: AiSalesSummaryInput): AiSalesSummary {
  const targetRevenue = input.targetRevenue ?? 0;
  const qualifiedLeads = input.qualifiedLeads ?? 0;
  const paidOrders = input.paidOrders ?? 0;
  const generationTime = input.generatedAt ?? new Date().toISOString();

  return {
    totalRevenue: Number(input.totalRevenue ?? 0),
    targetRevenue: Number(targetRevenue),
    achievementRate: targetRevenue > 0 ? Number((input.totalRevenue / targetRevenue).toFixed(4)) : 0,
    conversionRate: qualifiedLeads > 0 ? Number((paidOrders / qualifiedLeads).toFixed(4)) : 0,
    averageOrderValue: paidOrders > 0 ? Number((input.totalRevenue / paidOrders).toFixed(4)) : 0,
    paidOrders,
    qualifiedLeads,
    generatedAt: generationTime,
  };
}

export type AiForecastInput = {
  actualRevenue: number;
  averageDailyRevenue: number;
  remainingWorkDays: number;
  generatedAt?: string;
};

export type AiForecast = {
  currentRevenue: number;
  averageDailyRevenue: number;
  remainingWorkDays: number;
  forecastRevenue: number;
  method: string;
  generatedAt: string;
};

export function buildAiForecast(input: AiForecastInput): AiForecast {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const forecastRevenue = Number((input.actualRevenue + input.averageDailyRevenue * input.remainingWorkDays).toFixed(2));

  return {
    currentRevenue: Number(input.actualRevenue ?? 0),
    averageDailyRevenue: Number(input.averageDailyRevenue ?? 0),
    remainingWorkDays: Number(input.remainingWorkDays ?? 0),
    forecastRevenue,
    method: 'fact + average_daily_revenue * remaining_work_days',
    generatedAt,
  };
}
