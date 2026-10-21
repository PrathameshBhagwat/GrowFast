import { describe, it, expect } from 'vitest';
import {
  formatKolkataDate,
  getDateRangeForPreset,
  validateCustomRange,
  formatDateDisplay,
  formatPeriodLabel,
} from './dashboard-date';

describe('dashboard-date utilities', () => {
  it('formats date in Asia/Kolkata timezone correctly around midnight', () => {
    // 2026-10-20 19:00:00 UTC is 2026-10-21 00:30:00 IST (+05:30)
    const lateUtc = new Date('2026-10-20T19:00:00Z');
    expect(formatKolkataDate(lateUtc)).toBe('2026-10-21');

    // 2026-10-20 18:29:59 UTC is 2026-10-20 23:59:59 IST
    const justBeforeMidnightUtc = new Date('2026-10-20T18:29:59Z');
    expect(formatKolkataDate(justBeforeMidnightUtc)).toBe('2026-10-20');
  });

  describe('getDateRangeForPreset', () => {
    it('calculates TODAY range correctly', () => {
      const fixedDate = new Date('2026-10-21T10:00:00+05:30');
      const range = getDateRangeForPreset('TODAY', fixedDate);
      expect(range).toEqual({
        startDate: '2026-10-21',
        endDate: '2026-10-21',
      });
    });

    it('calculates YESTERDAY range correctly for ordinary day', () => {
      const fixedDate = new Date('2026-10-21T10:00:00+05:30');
      const range = getDateRangeForPreset('YESTERDAY', fixedDate);
      expect(range).toEqual({
        startDate: '2026-10-20',
        endDate: '2026-10-20',
      });
    });

    it('calculates YESTERDAY across month boundary', () => {
      const firstOfMonth = new Date('2026-05-01T10:00:00+05:30');
      const range = getDateRangeForPreset('YESTERDAY', firstOfMonth);
      expect(range).toEqual({
        startDate: '2026-04-30',
        endDate: '2026-04-30',
      });
    });

    it('calculates YESTERDAY across leap year boundary (Feb 2024)', () => {
      const marchFirstLeap = new Date('2024-03-01T10:00:00+05:30');
      const range = getDateRangeForPreset('YESTERDAY', marchFirstLeap);
      expect(range).toEqual({
        startDate: '2024-02-29',
        endDate: '2024-02-29',
      });
    });

    it('calculates YESTERDAY across non-leap year boundary (Feb 2025)', () => {
      const marchFirstNonLeap = new Date('2025-03-01T10:00:00+05:30');
      const range = getDateRangeForPreset('YESTERDAY', marchFirstNonLeap);
      expect(range).toEqual({
        startDate: '2025-02-28',
        endDate: '2025-02-28',
      });
    });

    it('calculates YESTERDAY across year boundary (Jan 1)', () => {
      const janFirst = new Date('2026-01-01T10:00:00+05:30');
      const range = getDateRangeForPreset('YESTERDAY', janFirst);
      expect(range).toEqual({
        startDate: '2025-12-31',
        endDate: '2025-12-31',
      });
    });

    it('calculates THIS_WEEK starting on Monday (when today is Wednesday)', () => {
      // 2026-10-21 is a Wednesday
      const wednesday = new Date('2026-10-21T10:00:00+05:30');
      const range = getDateRangeForPreset('THIS_WEEK', wednesday);
      expect(range).toEqual({
        startDate: '2026-10-19', // Monday
        endDate: '2026-10-21',
      });
    });

    it('calculates THIS_WEEK starting on Monday (when today is Monday)', () => {
      // 2026-10-19 is Monday
      const monday = new Date('2026-10-19T10:00:00+05:30');
      const range = getDateRangeForPreset('THIS_WEEK', monday);
      expect(range).toEqual({
        startDate: '2026-10-19',
        endDate: '2026-10-19',
      });
    });

    it('calculates THIS_WEEK starting on Monday (when today is Sunday)', () => {
      // 2026-10-25 is Sunday
      const sunday = new Date('2026-10-25T10:00:00+05:30');
      const range = getDateRangeForPreset('THIS_WEEK', sunday);
      expect(range).toEqual({
        startDate: '2026-10-19', // Prior Monday
        endDate: '2026-10-25',
      });
    });

    it('calculates THIS_WEEK across month boundary', () => {
      // 2026-03-01 is a Sunday. Monday of that week was 2026-02-23!
      const sunday = new Date('2026-03-01T10:00:00+05:30');
      const range = getDateRangeForPreset('THIS_WEEK', sunday);
      expect(range).toEqual({
        startDate: '2026-02-23',
        endDate: '2026-03-01',
      });
    });

    it('calculates THIS_MONTH starting on day 1 to today', () => {
      const midMonth = new Date('2026-10-21T10:00:00+05:30');
      const range = getDateRangeForPreset('THIS_MONTH', midMonth);
      expect(range).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-10-21',
      });
    });

    it('returns customRange when CUSTOM is specified', () => {
      const custom = { startDate: '2026-09-01', endDate: '2026-09-15' };
      const range = getDateRangeForPreset('CUSTOM', new Date(), custom);
      expect(range).toEqual(custom);
    });
  });

  describe('validateCustomRange', () => {
    const fixedNow = new Date('2026-10-21T10:00:00+05:30'); // Today in Kolkata is 2026-10-21

    it('validates a correct custom range', () => {
      const result = validateCustomRange('2026-10-01', '2026-10-20', fixedNow);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows same start and end date (single day custom range)', () => {
      const result = validateCustomRange('2026-10-15', '2026-10-15', fixedNow);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects reversed range (startDate after endDate)', () => {
      const result = validateCustomRange('2026-10-20', '2026-10-10', fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Start date cannot be after end date.');
    });

    it('rejects future start date', () => {
      const result = validateCustomRange('2026-10-22', '2026-10-25', fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Future dates are not permitted for historical reporting.');
    });

    it('rejects future end date', () => {
      const result = validateCustomRange('2026-10-15', '2026-10-22', fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Future dates are not permitted for historical reporting.');
    });

    it('rejects malformed dates', () => {
      const result = validateCustomRange('2026/10/01', '2026-10-20', fixedNow);
      expect(result.isValid).toBe(false);
    });
  });

  describe('formatDateDisplay & formatPeriodLabel', () => {
    it('formats display dates accurately without timezone drift', () => {
      expect(formatDateDisplay('2026-10-21')).toBe('21 Oct 2026');
      expect(formatDateDisplay('2026-01-01')).toBe('1 Jan 2026');
    });

    it('formats preset labels nicely', () => {
      expect(formatPeriodLabel('TODAY', '2026-10-21', '2026-10-21')).toBe('Today (21 Oct 2026)');
      expect(formatPeriodLabel('YESTERDAY', '2026-10-20', '2026-10-20')).toBe(
        'Yesterday (20 Oct 2026)',
      );
      expect(formatPeriodLabel('THIS_WEEK', '2026-10-19', '2026-10-21')).toBe(
        'This Week (19 Oct 2026 – 21 Oct 2026)',
      );
      expect(formatPeriodLabel('THIS_MONTH', '2026-10-01', '2026-10-21')).toBe(
        'This Month (1 Oct 2026 – 21 Oct 2026)',
      );
      expect(formatPeriodLabel('CUSTOM', '2026-09-01', '2026-09-15')).toBe(
        '1 Sep 2026 – 15 Sep 2026',
      );
    });
  });
});
