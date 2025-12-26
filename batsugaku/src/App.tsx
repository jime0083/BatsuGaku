import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SplashScreen} from './screens/SplashScreen';
import {LoginScreen} from './screens/auth/LoginScreen';
import {GoalSetupScreen} from './screens/goal/GoalSetupScreen';
import {MainTabNavigator} from './navigation/MainTabNavigator';
import {ConnectAccountsScreen} from './screens/onboarding/ConnectAccountsScreen';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  ConnectAccounts: undefined;
  GoalSetup: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  // 初回起動時は必ず「X/GitHub 連携」画面に入れる。
  // - 両方連携できていないとアプリを使えない仕様（要件）
  // - 連携状態の判定は ConnectAccountsScreen が Firestore を購読して行う
  const initialRouteName: keyof RootStackParamList = 'ConnectAccounts';

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{headerShown: false}}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login">
          {() => <LoginScreen />}
        </Stack.Screen>
        <Stack.Screen
          name="ConnectAccounts"
          component={ConnectAccountsScreen}
        />
        <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;



