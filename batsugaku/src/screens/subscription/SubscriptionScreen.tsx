import React, {useEffect, useState} from 'react';
import {Alert, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {onAuthStateChanged, User} from 'firebase/auth';
import {doc, serverTimestamp, updateDoc} from 'firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import {firebaseAuth, firestore} from '../../config/firebase';

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [uid, setUid] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user: User | null) => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  const onSubscribe = async () => {
    if (!uid) return;
    setIsBusy(true);
    try {
      // NOTE: 本番は App Store IAP の購読確認に置き換える。
      // ここでは「購読した」状態を Firestore に保存して先に進める。
      await updateDoc(doc(firestore, 'users', uid), {
        subscription: {
          active: true,
          activatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      navigation.replace('GoalSetup');
    } catch (e) {
      Alert.alert('失敗しました', '通信状況を確認して、もう一度お試しください。');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>サブスクリプション</Text>
        <Text style={styles.text}>
          本アプリを利用するには月額サブスク契約が必要です。
        </Text>
        <Text style={styles.text}>価格: 300円 / 月</Text>

        <Pressable
          style={[styles.button, {opacity: isBusy ? 0.5 : 1}]}
          disabled={isBusy}
          onPress={onSubscribe}>
          <Text style={styles.buttonText}>
            {isBusy ? '処理中…' : 'サブスク契約する'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  inner: {flex: 1, padding: 16, gap: 12},
  title: {fontSize: 20, fontWeight: '700'},
  text: {fontSize: 14},
  button: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
});


