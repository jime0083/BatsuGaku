import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {DashboardScreen} from '../screens/main/DashboardScreen';
import {CalendarScreen} from '../screens/main/CalendarScreen';
import {BadgesScreen} from '../screens/main/BadgesScreen';
import {SettingsScreen} from '../screens/main/SettingsScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Badges: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Badges" component={BadgesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};


