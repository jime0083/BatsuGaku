export type DayStatus = 'study' | 'skip' | 'future';

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  status: DayStatus;
};

export type UserStats = {
  currentMonthStudyDays: number;
  currentMonthSkipDays: number;
  totalStudyDays: number;
  totalSkipDays: number;
  currentStreak: number;
  longestStreak: number;
};

export type GoalSummary = {
  targetIncome: number;
  incomeType: 'monthly' | 'yearly';
  skill: string;
  daysRemaining: number;
};

export type BadgeType = 'streak' | 'total' | 'skip';

export type BadgeDefinition = {
  id: string;
  type: BadgeType;
  tier: number;
  label: string;
  description: string;
};


