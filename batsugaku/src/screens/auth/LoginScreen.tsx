import React from 'react';
import {SafeAreaView, Text, Button} from 'react-native';

type Props = {
  onLoginWithX?: () => void;
  onLoginWithGitHub?: () => void;
};

export const LoginScreen: React.FC<Props> = ({
  onLoginWithX,
  onLoginWithGitHub,
}) => {
  return (
    <SafeAreaView>
      <Text>ログイン</Text>
      <Button title="X でログイン" onPress={onLoginWithX} />
      <Button title="GitHub でログイン" onPress={onLoginWithGitHub} />
    </SafeAreaView>
  );
};


