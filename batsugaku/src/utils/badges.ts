import {BadgeDefinition, BadgeType, UserStats} from '../types/stats';

// 要件定義書に基づくバッジ定義
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // 連続学習日数バッジ
  {
    id: 'streak-3',
    type: 'streak',
    tier: 3,
    label: '🔥 3日連続',
    description: '3日連続で学習すると獲得',
  },
  {
    id: 'streak-7',
    type: 'streak',
    tier: 7,
    label: '🔥🔥 7日連続',
    description: '7日連続で学習すると獲得',
  },
  {
    id: 'streak-14',
    type: 'streak',
    tier: 14,
    label: '🔥🔥🔥 14日連続',
    description: '14日連続で学習すると獲得',
  },
  {
    id: 'streak-30',
    type: 'streak',
    tier: 30,
    label: '🏆 30日連続',
    description: '30日連続で学習すると獲得',
  },
  {
    id: 'streak-50',
    type: 'streak',
    tier: 50,
    label: '💎 50日連続',
    description: '50日連続で学習すると獲得',
  },
  {
    id: 'streak-100',
    type: 'streak',
    tier: 100,
    label: '👑 100日連続',
    description: '100日連続で学習すると獲得',
  },
  // 累計学習日数バッジ
  {
    id: 'total-10',
    type: 'total',
    tier: 10,
    label: '🌱 10日達成',
    description: '累計10日学習すると獲得',
  },
  {
    id: 'total-30',
    type: 'total',
    tier: 30,
    label: '🌿 30日達成',
    description: '累計30日学習すると獲得',
  },
  {
    id: 'total-50',
    type: 'total',
    tier: 50,
    label: '🌳 50日達成',
    description: '累計50日学習すると獲得',
  },
  {
    id: 'total-100',
    type: 'total',
    tier: 100,
    label: '🏔 100日達成',
    description: '累計100日学習すると獲得',
  },
  {
    id: 'total-200',
    type: 'total',
    tier: 200,
    label: '🌍 200日達成',
    description: '累計200日学習すると獲得',
  },
  {
    id: 'total-365',
    type: 'total',
    tier: 365,
    label: '⭐ 365日達成',
    description: '累計365日学習すると獲得',
  },
  // サボり関連バッジ
  {
    id: 'skip-10',
    type: 'skip',
    tier: 10,
    label: '💀 累計サボり10回',
    description: '累計サボり10回で獲得',
  },
  {
    id: 'skip-30',
    type: 'skip',
    tier: 30,
    label: '👻 累計サボり30回',
    description: '累計サボり30回で獲得',
  },
  {
    id: 'skip-50',
    type: 'skip',
    tier: 50,
    label: '😈 累計サボり50回',
    description: '累計サボり50回で獲得',
  },
];

export function getEarnedBadges(
  stats: UserStats,
  totalSkipDays: number,
): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(badge => {
    if (badge.type === 'streak') {
      return stats.longestStreak >= badge.tier;
    }
    if (badge.type === 'total') {
      return stats.totalStudyDays >= badge.tier;
    }
    if (badge.type === 'skip') {
      return totalSkipDays >= badge.tier;
    }
    return false;
  });
}


