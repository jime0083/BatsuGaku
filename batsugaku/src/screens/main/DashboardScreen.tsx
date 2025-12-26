import React from 'react';
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  Image,
  ImageBackground,
  ScrollView,
} from 'react-native';
import {UserStats} from '../../types/stats';

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

const ASSETS = {
  bg1: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/背景1.png'),
  bg2: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/背景2.png'),
  bg3: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/背景3.png'),
  bg4: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/背景4.png'),
  bg5: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/背景5.png'),
  check2: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/cheack2.png'),
  check1: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/cheack1.png'),
  tray: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/tray.png'),
  flag: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/flag.png'),
  calendar: require('../../../ios/BatsuGakuNative/Images.xcassets/AppIcon.appiconset/calendar.png'),
} as const;

type StatCardProps = {
  title: string;
  days: number;
  backgroundSource: any;
  iconSource: any;
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  days,
  backgroundSource,
  iconSource,
}) => {
  return (
    <ImageBackground
      source={backgroundSource}
      resizeMode="cover"
      style={styles.card}
      imageStyle={styles.cardImage}>
      <View style={styles.cardInner}>
        {/* アイコンとタイトルは中央揃え（縦方向） */}
        <View style={styles.cardTitleRow}>
          <Image source={iconSource} style={styles.cardIcon} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>

        {/* 日数はタイトル（文字）の左端に揃える */}
        <View style={styles.cardDaysOffset}>
          <View style={styles.cardDaysRow}>
            <Text style={styles.daysNumber}>{days}</Text>
            <Text style={styles.daysUnit}>日</Text>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export const DashboardScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerMenu}>☰</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}>
        <StatCard
          title="累計学習日数"
          days={mockStats.totalStudyDays}
          backgroundSource={ASSETS.bg1}
          iconSource={ASSETS.check2}
        />
        <StatCard
          title="連続学習日数"
          days={mockStats.currentStreak}
          backgroundSource={ASSETS.bg2}
          iconSource={ASSETS.check1}
        />
        <StatCard
          title="今月の学習日数"
          days={mockStats.currentMonthStudyDays}
          backgroundSource={ASSETS.bg3}
          iconSource={ASSETS.tray}
        />
        <StatCard
          title="今月のサボり日数"
          days={mockStats.currentMonthSkipDays}
          backgroundSource={ASSETS.bg4}
          iconSource={ASSETS.flag}
        />
        <StatCard
          title="累計サボり日数"
          days={mockStats.totalSkipDays}
          backgroundSource={ASSETS.bg5}
          iconSource={ASSETS.calendar}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    height: 60,
    backgroundColor: '#6b6b6b',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
  },
  headerMenu: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 28,
  },
  scroll: {
    flex: 1,
  },
  list: {
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 20,
    paddingBottom: 20,
  },
  card: {
    width: '100%',
    height: 140,
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardImage: {
    borderRadius: 22,
  },
  cardInner: {
    flex: 1,
    paddingTop: 20,
    paddingLeft: 20,
  },
  cardIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center', // アイコンとタイトルの中央揃え
  },
  cardTitle: {
    fontSize: 24,
    // NOTE: フォントファイルがプロジェクトに登録されている必要があります
    fontFamily: 'NotoSansJP-Black',
    fontWeight: '900',
    color: '#fff',
    marginLeft: 10, // アイコンとタイトルの間隔 10px
  },
  cardDaysOffset: {
    // タイトル文字の開始位置（アイコン24px + 間隔10px）に合わせる
    marginLeft: 34,
  },
  cardDaysRow: {
    flexDirection: 'row',
    // 「40」と「日」の下端が揃うようにする
    alignItems: 'baseline',
    marginTop: 0, // タイトルとの空白 0px
  },
  daysNumber: {
    fontSize: 80,
    fontFamily: 'NotoSansJP-Black',
    fontWeight: '900',
    color: '#fff',
  },
  daysUnit: {
    fontSize: 24,
    fontFamily: 'NotoSansJP-Black',
    fontWeight: '900',
    color: '#fff',
    marginLeft: 0, // 「◯」と「日」の空白 0px
  },
});

