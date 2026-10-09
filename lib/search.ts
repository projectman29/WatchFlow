export function normalizePhoneSearch(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidDateFilter(value?: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getDateRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  const range: { gte?: Date; lt?: Date } = {};
  if (isValidDateFilter(from)) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (isValidDateFilter(to)) {
    const nextDay = new Date(`${to}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    range.lt = nextDay;
  }
  return Object.keys(range).length > 0 ? range : undefined;
}
