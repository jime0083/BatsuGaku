import React from 'react';
import {SafeAreaView, Text, View} from 'react-native';
import {buildMonthlyCalendar, DailyLogSummary} from '../../utils/calendar';

export const CalendarScreen: React.FC = () => {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;

  // NOTE: 実際には Firestore の studyLogs から生成する。
  const mockLogs: DailyLogSummary[] = [
    {date: `${year}-${String(month).padStart(2, '0')}-01`, studied: true},
    {date: `${year}-${String(month).padStart(2, '0')}-02`, studied: false},
  ];

  const days = buildMonthlyCalendar(year, month, mockLogs, today);

  return (
    <SafeAreaView>
      <Text>カレンダー</Text>
      <View>
        {days.map(day => {
          let label = '未来';
          if (day.status === 'study') label = '学習';
          if (day.status === 'skip') label = 'サボり';
          return (
            <Text key={day.date}>
              {day.date}: {label}
            </Text>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

