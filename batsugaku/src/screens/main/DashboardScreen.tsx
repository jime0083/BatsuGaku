import React from 'react';
import {SafeAreaView, Text, View} from 'react-native';
import {UserStats, GoalSummary} from '../../types/stats';

// NOTE: 実際には Firestore から取得したデータを用いる想定。
// ここではロジックと UI の骨組みのために仮データを置いている。
const mockStats: UserStats = {
  currentMonthStudyDays: 10,
  currentMonthSkipDays: 2,
  totalStudyDays: 40,
  totalSkipDays: 8,
  currentStreak: 5,
  longestStreak: 14,
};

const mockGoal: GoalSummary = {
  targetIncome: 800,
  incomeType: 'monthly',
  skill: 'React / TypeScript',
  daysRemaining: 120,
};

const DashboardRow: React.FC<{label: string; value: string | number}> = ({
  label,
  value,
}) => (
  <View>
    <Text>
      {label}: {value}
    </Text>
  </View>
);

export const DashboardScreen: React.FC = () => {
  const {currentMonthStudyDays, currentMonthSkipDays} = mockStats;
  const daysElapsed = currentMonthStudyDays + currentMonthSkipDays || 1;
  const monthlyRate = Math.round(
    (currentMonthStudyDays / daysElapsed) * 100,
  );
  const totalDays =
    mockStats.totalStudyDays + mockStats.totalSkipDays || 1;
  const totalRate = Math.round(
    (mockStats.totalStudyDays / totalDays) * 100,
  );

  return (
    <SafeAreaView>
      <Text>ダッシュボード</Text>

      <View>
        <Text>基本統計</Text>
        <DashboardRow
          label="今月の学習日数"
          value={mockStats.currentMonthStudyDays}
        />
        <DashboardRow
          label="今月のサボり日数"
          value={mockStats.currentMonthSkipDays}
        />
        <DashboardRow
          label="累計学習日数"
          value={mockStats.totalStudyDays}
        />
        <DashboardRow
          label="累計サボり日数"
          value={mockStats.totalSkipDays}
        />
        <DashboardRow
          label="現在の連続学習日数"
          value={mockStats.currentStreak}
        />
        <DashboardRow
          label="最長連続学習日数"
          value={mockStats.longestStreak}
        />
      </View>

      <View>
        <Text>目標情報</Text>
        <DashboardRow
          label="目標収入"
          value={
            mockGoal.incomeType === 'monthly'
              ? `月収 ${mockGoal.targetIncome} 万円`
              : `年収 ${mockGoal.targetIncome} 万円`
          }
        />
        <DashboardRow label="習得予定スキル" value={mockGoal.skill} />
        <DashboardRow
          label="目標達成期限までの残り日数"
          value={mockGoal.daysRemaining}
        />
      </View>

      <View>
        <Text>学習率</Text>
        <DashboardRow
          label="今月の学習達成率"
          value={`${monthlyRate}%`}
        />
        <DashboardRow
          label="全期間の学習達成率"
          value={`${totalRate}%`}
        />
      </View>
    </SafeAreaView>
  );
};

