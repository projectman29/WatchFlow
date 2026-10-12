import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  calculateKztDirectMargin,
  isWithinLeadOrderConversionWindow,
  LEAD_ORDER_CONVERSION_WINDOW_DAYS,
} from './ai-sales-foundation';

describe('AI sales data foundation calculations', () => {
  it('requires a known first qualified transition and enforces the 30-day window', () => {
    const qualifiedAt = new Date('2026-01-01T00:00:00.000Z');
    const endOfWindow = new Date(qualifiedAt.getTime() + LEAD_ORDER_CONVERSION_WINDOW_DAYS * 86_400_000);

    expect(isWithinLeadOrderConversionWindow(null, endOfWindow)).toBe(false);
    expect(isWithinLeadOrderConversionWindow(qualifiedAt, endOfWindow)).toBe(true);
    expect(isWithinLeadOrderConversionWindow(qualifiedAt, new Date(endOfWindow.getTime() + 1))).toBe(false);
    expect(isWithinLeadOrderConversionWindow(endOfWindow, qualifiedAt)).toBe(false);
  });

  it('does not calculate margin for legacy currency or incomplete cost records', () => {
    const costs = [
      { category: 'MATERIALS', amount: 100, currency: 'KZT' },
      { category: 'LABOR', amount: 50, currency: 'KZT' },
    ];

    expect(calculateKztDirectMargin(500, null, costs)).toBeNull();
    expect(calculateKztDirectMargin(500, 'KZT', costs)).toBeNull();
  });

  it('calculates KZT margin with decimal arithmetic when all direct cost categories are recorded', () => {
    const margin = calculateKztDirectMargin('1000.00', 'KZT', [
      { category: 'MATERIALS', amount: '125.10', currency: 'KZT' },
      { category: 'LABOR', amount: '200.20', currency: 'KZT' },
      { category: 'PACKAGING', amount: '30.30', currency: 'KZT' },
    ]);

    expect(margin).toEqual(new Prisma.Decimal('644.40'));
    expect(calculateKztDirectMargin(1000, 'KZT', [
      { category: 'MATERIALS', amount: 100, currency: 'KZT' },
      { category: 'LABOR', amount: 100, currency: 'EUR' },
      { category: 'PACKAGING', amount: 10, currency: 'KZT' },
    ])).toBeNull();
  });
});
