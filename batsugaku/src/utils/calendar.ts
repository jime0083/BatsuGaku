import {CalendarDay, DayStatus} from '../types/stats';

// studyLogs から当月カレンダーを構築するためのヘルパー
// - logs は「その日が学習日かどうか」を含む情報を date(YYYY-MM-DD) キーで渡す前提

export type DailyLogSummary = {
  date: string; // YYYY-MM-DD
  studied: boolean;
};

export function buildMonthlyCalendar(
  year: number,
  month: number, // 1-12
  logs: DailyLogSummary[],
  today: Date,
): CalendarDay[] {
  const result: CalendarDay[] = [];
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));

  const logMap = new Map<string, DailyLogSummary>();
  logs.forEach(log => logMap.set(log.date, log));

  for (let d = 1; d <= lastDay.getUTCDate(); d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

    let status: DayStatus;
    if (date > today) {
      status = 'future';
    } else {
      const log = logMap.get(dateStr);
      status = log && log.studied ? 'study' : 'skip';
    }

    result.push({date: dateStr, status});
  }

  return result;
}


