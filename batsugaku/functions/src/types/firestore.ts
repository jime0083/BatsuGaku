// Firestore スキーマ定義（要件定義書に基づく）

export type TwitterAuthInfo = {
  id: string;
  username: string;
  accessTokenEncrypted: string;
  accessTokenSecretEncrypted: string;
};

export type GitHubAuthInfo = {
  id: string;
  username: string;
  accessTokenEncrypted: string;
};

export type GoalInfo = {
  targetDate: FirebaseFirestore.Timestamp;
  skill: string;
  targetIncome: number;
  incomeType: 'monthly' | 'yearly';
  setAt: FirebaseFirestore.Timestamp;
};

export type StatsInfo = {
  currentMonthStudyDays: number;
  currentMonthSkipDays: number;
  totalStudyDays: number;
  totalSkipDays: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: FirebaseFirestore.Timestamp | null;
};

export type NotificationSettings = {
  studyCompleted: boolean;
  skipWarning: boolean;
  fcmToken: string | null;
};

export type UserDocument = {
  userId: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  twitter?: TwitterAuthInfo | null;
  github?: GitHubAuthInfo | null;
  goal?: GoalInfo | null;
  stats: StatsInfo;
  notificationSettings: NotificationSettings;
  language?: 'ja' | 'en';
};

export type StudyLogDocument = {
  userId: string;
  date: FirebaseFirestore.Timestamp; // その日の 0:00 JST のタイムスタンプ
  studied: boolean;
  pushCount: number;
  firstPushAt: FirebaseFirestore.Timestamp | null;
  createdAt: FirebaseFirestore.Timestamp;
};

export type BadgeType = 'streak' | 'total' | 'skip';

export type BadgeDocument = {
  userId: string;
  badgeType: BadgeType;
  badgeTier: number;
  achievedAt: FirebaseFirestore.Timestamp;
};


