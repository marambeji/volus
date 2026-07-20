import type { CountryPolicy } from '../types/adminTypes';
import type { LeaveTypeKey } from '../../types';

export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  policy: CountryPolicy | undefined,
  holidays: Array<{ date: string; countryCode: string }>,
  countryCode: string
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;

  const weekendDays = policy?.weekendDays ?? [0, 6]; // default Sat+Sun
  const countryHolidayDates = holidays
    .filter(h => h.countryCode === countryCode)
    .map(h => h.date);

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    if (!weekendDays.includes(dayOfWeek) && !countryHolidayDates.includes(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function buildDailyAmounts(
  startDate: string,
  endDate: string,
  policy: CountryPolicy | undefined,
  holidays: Array<{ date: string; countryCode: string }>,
  countryCode: string
): Record<string, number> {
  if (!startDate || !endDate) return {};
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return {};

  const weekendDays = policy?.weekendDays ?? [0, 6];
  const countryHolidayDates = holidays
    .filter(h => h.countryCode === countryCode)
    .map(h => h.date);

  const result: Record<string, number> = {};
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    result[dateStr] = (!weekendDays.includes(dayOfWeek) && !countryHolidayDates.includes(dateStr)) ? 1 : 0;
    current.setDate(current.getDate() + 1);
  }
  return result;
}

export function getBalanceForType(
  balances: Array<{ employeeId: number; leaveType: LeaveTypeKey; amount: number }>,
  employeeId: number,
  leaveType: LeaveTypeKey
): number {
  return balances.find(b => b.employeeId === employeeId && b.leaveType === leaveType)?.amount ?? 0;
}
