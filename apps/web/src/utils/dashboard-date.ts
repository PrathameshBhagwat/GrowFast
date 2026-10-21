/**
 * Dashboard Date & Timezone Utilities
 *
 * Enforces Asia/Kolkata shop-local calendar boundaries for all dashboard reporting periods.
 */

export type DashboardDatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export const SHOP_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns a YYYY-MM-DD string representing the calendar date in Asia/Kolkata.
 */
export function formatKolkataDate(d: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Pads a number to 2 digits with leading zeros.
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Calculates calendar date range for the specified preset in Asia/Kolkata.
 */
export function getDateRangeForPreset(
  preset: DashboardDatePreset,
  now: Date = new Date(),
  customRange?: DateRange,
): DateRange {
  const todayStr = formatKolkataDate(now);
  const [year, month, day] = todayStr.split('-').map(Number);

  switch (preset) {
    case 'TODAY':
      return {
        startDate: todayStr,
        endDate: todayStr,
      };

    case 'YESTERDAY': {
      // Previous calendar day
      const yesterdayUtc = new Date(Date.UTC(year, month - 1, day - 1));
      const yesterdayStr = `${yesterdayUtc.getUTCFullYear()}-${pad2(yesterdayUtc.getUTCMonth() + 1)}-${pad2(yesterdayUtc.getUTCDate())}`;
      return {
        startDate: yesterdayStr,
        endDate: yesterdayStr,
      };
    }

    case 'THIS_WEEK': {
      // Monday of the current week to today
      const todayUtc = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = todayUtc.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      const mondayUtc = new Date(Date.UTC(year, month - 1, day - daysSinceMonday));
      const mondayStr = `${mondayUtc.getUTCFullYear()}-${pad2(mondayUtc.getUTCMonth() + 1)}-${pad2(mondayUtc.getUTCDate())}`;
      return {
        startDate: mondayStr,
        endDate: todayStr,
      };
    }

    case 'THIS_MONTH': {
      // First day of current month to today
      const firstDayStr = `${year}-${pad2(month)}-01`;
      return {
        startDate: firstDayStr,
        endDate: todayStr,
      };
    }

    case 'CUSTOM':
      if (customRange && customRange.startDate && customRange.endDate) {
        return customRange;
      }
      return {
        startDate: todayStr,
        endDate: todayStr,
      };

    default:
      return {
        startDate: todayStr,
        endDate: todayStr,
      };
  }
}

/**
 * Validates custom start and end date strings.
 */
export function validateCustomRange(
  startDateStr: string,
  endDateStr: string,
  now: Date = new Date(),
): { isValid: boolean; error?: string } {
  const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_ONLY_REGEX.test(startDateStr.trim())) {
    return { isValid: false, error: 'Start date must be in YYYY-MM-DD format.' };
  }
  if (!DATE_ONLY_REGEX.test(endDateStr.trim())) {
    return { isValid: false, error: 'End date must be in YYYY-MM-DD format.' };
  }

  const todayStr = formatKolkataDate(now);

  if (startDateStr > endDateStr) {
    return { isValid: false, error: 'Start date cannot be after end date.' };
  }

  if (startDateStr > todayStr || endDateStr > todayStr) {
    return { isValid: false, error: 'Future dates are not permitted for historical reporting.' };
  }

  return { isValid: true };
}

/**
 * Formats a YYYY-MM-DD date string into a friendly human-readable format e.g. "20 Oct 2026".
 */
export function formatDateDisplay(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthName = months[monthIndex] || monthStr;
  return `${day} ${monthName} ${year}`;
}

/**
 * Formats an active period descriptor with human readable dates.
 */
export function formatPeriodLabel(
  preset: DashboardDatePreset,
  startDate: string,
  endDate: string,
): string {
  switch (preset) {
    case 'TODAY':
      return `Today (${formatDateDisplay(startDate)})`;
    case 'YESTERDAY':
      return `Yesterday (${formatDateDisplay(startDate)})`;
    case 'THIS_WEEK':
      return `This Week (${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)})`;
    case 'THIS_MONTH':
      return `This Month (${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)})`;
    case 'CUSTOM':
      return `${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}`;
    default:
      return `${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}`;
  }
}
