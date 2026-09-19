/**
 * Date Utilities
 * Helper functions for date calculations and formatting
 */

import type { MonthYear, TimeRange } from '../types/calendar.types';

// ============================================
// Constants (German locale for UI)
// ============================================

export const MONTH_NAMES_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export const MONTH_NAMES_SHORT_DE = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

export const DAY_NAMES_DE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

export const DAY_NAMES_SHORT_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// ============================================
// Time Range Calculations
// ============================================

/**
 * Calculates start/end date and month list for a time range
 */
export function calculateDateRange(timeRange: TimeRange): {
  startDate: Date;
  endDate: Date;
  months: MonthYear[];
} {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  switch (timeRange) {
    case 'previous': {
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return {
        startDate: getFirstDayOfMonth(prevYear, prevMonth),
        endDate: getLastDayOfMonth(prevYear, prevMonth),
        months: [{ month: prevMonth, year: prevYear }],
      };
    }

    case 'next': {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      return {
        startDate: getFirstDayOfMonth(nextYear, nextMonth),
        endDate: getLastDayOfMonth(nextYear, nextMonth),
        months: [{ month: nextMonth, year: nextYear }],
      };
    }

    case 'lastyear':
      return calculateYearRange(currentYear - 1);

    case 'year': {
      // January to December of the current year
      const months: MonthYear[] = [];
      for (let m = 1; m <= 12; m++) {
        months.push({ month: m, year: currentYear });
      }
      return {
        startDate: getFirstDayOfMonth(currentYear, 1),
        endDate: getLastDayOfMonth(currentYear, 12),
        months,
      };
    }

    case 'nextyear': {
      const nextYear = currentYear + 1;
      const months: MonthYear[] = [];
      for (let m = 1; m <= 12; m++) {
        months.push({ month: m, year: nextYear });
      }
      return {
        startDate: getFirstDayOfMonth(nextYear, 1),
        endDate: getLastDayOfMonth(nextYear, 12),
        months,
      };
    }

    default: // 'current'
      return {
        startDate: getFirstDayOfMonth(currentYear, currentMonth),
        endDate: getLastDayOfMonth(currentYear, currentMonth),
        months: [{ month: currentMonth, year: currentYear }],
      };
  }
}

/**
 * Calculates time range for a specific year (January-December)
 */
export function calculateYearRange(year: number): {
  startDate: Date;
  endDate: Date;
  months: MonthYear[];
} {
  const months: MonthYear[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push({ month: m, year });
  }
  return {
    startDate: getFirstDayOfMonth(year, 1),
    endDate: getLastDayOfMonth(year, 12),
    months,
  };
}

/**
 * Calculates time range for a user defined period.
 * The date range is exact; the month list covers every month touched by it.
 * @param start - Start date as YYYY-MM-DD (inclusive)
 * @param end - End date as YYYY-MM-DD (inclusive)
 * @returns null if a date is invalid or start is after end
 */
export function calculateCustomRange(start: string, end: string): {
  startDate: Date;
  endDate: Date;
  months: MonthYear[];
} | null {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate || startDate > endDate) {
    return null;
  }
  endDate.setHours(23, 59, 59, 999);

  const months: MonthYear[] = [];
  let year = startDate.getFullYear();
  let month = startDate.getMonth() + 1;
  const lastYear = endDate.getFullYear();
  const lastMonth = endDate.getMonth() + 1;
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push({ month, year });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return { startDate, endDate, months };
}

/**
 * Parses a YYYY-MM-DD string as local date (00:00)
 */
function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  // Reject overflowing dates like 2024-02-31
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

// ============================================
// Month Functions
// ============================================

/**
 * Returns the first day of a month
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/**
 * Returns the last day of a month
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  // Day 0 of next month = last day of current month
  const lastDay = new Date(year, month, 0);
  lastDay.setHours(23, 59, 59, 999);
  return lastDay;
}

/**
 * Returns the number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the weekday of the first day of a month
 * @param weekStarts - 0 = Sunday, 1 = Monday
 * @returns Index 0-6 relative to the chosen week start
 */
export function getFirstDayWeekday(year: number, month: number, weekStarts: 0 | 1 = 1): number {
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Sunday
  return (dayOfWeek + 7 - weekStarts) % 7;
}

/**
 * Calculates the number of weeks (rows) for a month calendar
 */
export function getWeeksInMonth(year: number, month: number, weekStarts: 0 | 1 = 1): number {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayWeekday = getFirstDayWeekday(year, month, weekStarts);
  return Math.ceil((daysInMonth + firstDayWeekday) / 7);
}

// ============================================
// Formatting
// ============================================

/**
 * Formats month name (e.g. "Januar 2024")
 */
export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES_DE[month - 1]} ${year}`;
}

/**
 * Formats date as German date (e.g. "15.01.2024")
 */
export function formatDateDE(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Formats time (e.g. "14:30" or "14h")
 */
export function formatTime(date: Date, showMinutes = true): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (!showMinutes || minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}:${String(minutes).padStart(2, '0')}h`;
}

/**
 * Formats date and time for display
 */
export function formatDateTime(date: Date): string {
  return `${formatDateDE(date)} ${formatTime(date)}`;
}

// ============================================
// Comparisons
// ============================================

/**
 * Checks if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Checks if a date is in a specific month
 */
export function isInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month - 1;
}

/**
 * Checks if a date is within a time range
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

// ============================================
// Iteration
// ============================================

/**
 * Iterates over all days of a month
 */
export function* iterateDaysOfMonth(year: number, month: number): Generator<Date> {
  const daysInMonth = getDaysInMonth(year, month);
  for (let day = 1; day <= daysInMonth; day++) {
    yield new Date(year, month - 1, day);
  }
}

/**
 * Iterates over a date range
 */
export function* iterateDateRange(start: Date, end: Date): Generator<Date> {
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endTime = new Date(end);
  endTime.setHours(23, 59, 59, 999);

  while (current <= endTime) {
    yield new Date(current);
    current.setDate(current.getDate() + 1);
  }
}

// ============================================
// All-Day Check
// ============================================

/**
 * Checks if an appointment is an all-day event
 */
export function isAllDayEvent(startDate: Date, endDate: Date | null): boolean {
  // Start time is midnight
  if (startDate.getHours() !== 0 || startDate.getMinutes() !== 0) {
    return false;
  }

  // No end date = all-day
  if (!endDate) {
    return true;
  }

  // End time is midnight or 23:59
  const endHours = endDate.getHours();
  const endMinutes = endDate.getMinutes();

  return (endHours === 0 && endMinutes === 0) || (endHours === 23 && endMinutes === 59);
}

/**
 * Checks if an appointment spans multiple days
 */
export function isMultiDayEvent(startDate: Date, endDate: Date | null): boolean {
  if (!endDate) {
    return false;
  }
  return !isSameDay(startDate, endDate);
}
