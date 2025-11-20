import {getEarnedBadges} from '../src/utils/badges';
import {UserStats} from '../src/types/stats';

describe('getEarnedBadges', () => {
  it('returns badges based on stats and skip count', () => {
    const stats: UserStats = {
      currentMonthStudyDays: 10,
      currentMonthSkipDays: 0,
      totalStudyDays: 365,
      totalSkipDays: 50,
      currentStreak: 100,
      longestStreak: 100,
    };

    const badges = getEarnedBadges(stats, stats.totalSkipDays);
    const ids = badges.map(b => b.id);

    expect(ids).toContain('streak-100');
    expect(ids).toContain('total-365');
    expect(ids).toContain('skip-50');
  });
});


