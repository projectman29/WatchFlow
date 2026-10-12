import { describe, expect, it } from 'vitest';
import { buildAiSalesSummary, buildAiForecast, sumCollectedRevenue } from './ai-sales';

describe('AI sales analytics', () => {
  it('counts only the deposit for partially paid orders', () => {
    expect(sumCollectedRevenue([
      { total: 4200, deposit: 2100, paymentStatus: 'PARTIAL' },
      { total: 5600, deposit: 5600, paymentStatus: 'PAID' },
      { total: 1200, deposit: 0, paymentStatus: 'PENDING' },
    ])).toBe(7700);
  });

  it('builds a summary with revenue, conversion, and average check', () => {
    const summary = buildAiSalesSummary({
      totalRevenue: 300000,
      targetRevenue: 500000,
      paidOrders: 12,
      qualifiedLeads: 40,
    });

    expect(summary.totalRevenue).toBe(300000);
    expect(summary.achievementRate).toBeCloseTo(0.6, 4);
    expect(summary.conversionRate).toBeCloseTo(0.3, 4);
    expect(summary.averageOrderValue).toBeCloseTo(25000, 4);
  });

  it('builds a forecast using current revenue and average daily sales', () => {
    const forecast = buildAiForecast({
      actualRevenue: 240000,
      averageDailyRevenue: 18000,
      remainingWorkDays: 12,
      generatedAt: '2026-10-12T00:00:00.000Z',
    });

    expect(forecast.currentRevenue).toBe(240000);
    expect(forecast.forecastRevenue).toBe(456000);
    expect(forecast.method).toContain('fact');
    expect(forecast.generatedAt).toBe('2026-10-12T00:00:00.000Z');
  });
});
