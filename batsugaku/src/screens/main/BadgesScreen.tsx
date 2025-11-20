import React from 'react';
import {SafeAreaView, Text, View} from 'react-native';
import {UserStats} from '../../types/stats';
import {BADGE_DEFINITIONS, getEarnedBadges} from '../../utils/badges';

// NOTE: 実際には Firestore の badges コレクションから取得した情報で表示する。
const mockStats: UserStats = {
  currentMonthStudyDays: 10,
  currentMonthSkipDays: 2,
  totalStudyDays: 120,
  totalSkipDays: 15,
  currentStreak: 12,
  longestStreak: 30,
};

export const BadgesScreen: React.FC = () => {
  const earned = getEarnedBadges(mockStats, mockStats.totalSkipDays);

  return (
    <SafeAreaView>
      <Text>バッジ</Text>
      <View>
        {BADGE_DEFINITIONS.map(badge => {
          const hasBadge = earned.some(b => b.id === badge.id);
          return (
            <View key={badge.id}>
              <Text>
                {hasBadge ? '' : '[未獲得] '}
                {badge.label}
              </Text>
              <Text>{badge.description}</Text>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

