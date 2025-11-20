import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SplashScreen} from './screens/SplashScreen';
import {LoginScreen} from './screens/auth/LoginScreen';
import {GoalSetupScreen} from './screens/goal/GoalSetupScreen';
import {MainTabNavigator} from './navigation/MainTabNavigator';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  GoalSetup: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  // TODO: Firebase Authentication と Firestore の状態に応じて
  // - 未ログイン: Splash -> Login
  // - ログイン済 & 目標未設定: GoalSetup
  // - ログイン済 & 目標設定済: MainTabs
  const isSignedIn = false;
  const hasGoal = false;

  const initialRouteName: keyof RootStackParamList = !isSignedIn
    ? 'Splash'
    : !hasGoal
    ? 'GoalSetup'
    : 'MainTabs';

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{headerShown: false}}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login">
          {() => <LoginScreen />}
        </Stack.Screen>
        <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;



