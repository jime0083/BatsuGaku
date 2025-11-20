import {buildMonthlyCalendar} from '../src/utils/calendar';

describe('buildMonthlyCalendar', () => {
  it('marks studied / skip / future correctly', () => {
    const year = 2024;
    const month = 1;
    const today = new Date(Date.UTC(year, month - 1, 10));

    const logs = [
      {date: '2024-01-01', studied: true},
      {date: '2024-01-02', studied: false},
    ];

    const days = buildMonthlyCalendar(year, month, logs, today);
    const day1 = days.find(d => d.date === '2024-01-01');
    const day2 = days.find(d => d.date === '2024-01-02');
    const dayFuture = days.find(d => d.date === '2024-01-20');

    expect(day1?.status).toBe('study');
    expect(day2?.status).toBe('skip');
    expect(dayFuture?.status).toBe('future');
  });
});


