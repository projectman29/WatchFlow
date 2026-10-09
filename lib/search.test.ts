import { describe, expect, it } from 'vitest';
import { getDateRange, isValidDateFilter, normalizePhoneSearch } from './search';

describe('global search and order filter helpers', () => {
  it('normalizes phone input to digits only', () => {
    expect(normalizePhoneSearch('+7 (701) 123-45-67')).toBe('77011234567');
    expect(normalizePhoneSearch('AB-123')).toBe('123');
  });

  it('accepts only real ISO calendar dates', () => {
    expect(isValidDateFilter('2026-10-07')).toBe(true);
    expect(isValidDateFilter('2026-02-30')).toBe(false);
    expect(isValidDateFilter('07-10-2026')).toBe(false);
  });

  it('creates an inclusive user-selected date range', () => {
    const range = getDateRange('2026-10-01', '2026-10-07');
    expect(range?.gte?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(range?.lt?.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(getDateRange()).toBeUndefined();
  });
});
