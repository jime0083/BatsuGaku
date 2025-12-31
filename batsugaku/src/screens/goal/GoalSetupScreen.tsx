import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import {doc, serverTimestamp, updateDoc} from 'firebase/firestore';
import {onAuthStateChanged, User} from 'firebase/auth';
import {useNavigation} from '@react-navigation/native';
import {firebaseAuth, firestore} from '../../config/firebase';

export const GoalSetupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [uid, setUid] = useState<string | null>(null);
  const [targetIncomeMan, setTargetIncomeMan] = useState<string>(''); // 年収◯◯万円（万円単位）
  const [skill, setSkill] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user: User | null) => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  const parsedIncome = useMemo(() => {
    const n = Number(targetIncomeMan);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [targetIncomeMan]);

  const canSubmit =
    Boolean(uid) &&
    parsedIncome !== null &&
    parsedIncome >= 1 &&
    parsedIncome <= 9999 &&
    skill.trim().length > 0 &&
    skill.trim().length <= 50 &&
    !isSaving;

  const onSave = async () => {
    if (!uid) return;
    if (!canSubmit || parsedIncome === null) {
      Alert.alert('入力エラー', '年収（万円）と学習言語・フレームワークを正しく入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      const ref = doc(firestore, 'users', uid);
      await updateDoc(ref, {
        goal: {
          targetIncome: parsedIncome,
          incomeType: 'yearly',
          skill: skill.trim(),
          setAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      // 目標設定完了後はアプリ本体へ
      navigation.replace('MainTabs');
    } catch (e) {
      Alert.alert('保存に失敗しました', '通信状況を確認して、もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>目標設定</Text>

        <View style={styles.field}>
          <Text style={styles.label}>目標収入（年収◯◯万円）</Text>
          <View style={styles.row}>
            <TextInput
              value={targetIncomeMan}
              onChangeText={setTargetIncomeMan}
              placeholder="例: 800"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Text style={styles.suffix}>万円</Text>
          </View>
          <Text style={styles.hint}>1〜9999（万円）で入力してください</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>学習言語・フレームワーク</Text>
          <TextInput
            value={skill}
            onChangeText={setSkill}
            placeholder="例: React, TypeScript, AWS"
            style={styles.input}
            maxLength={50}
          />
          <Text style={styles.hint}>最大50文字</Text>
        </View>

        <Pressable
          style={[styles.button, {opacity: canSubmit ? 1 : 0.4}]}
          disabled={!canSubmit}
          onPress={onSave}>
          <Text style={styles.buttonText}>{isSaving ? '保存中…' : '保存して開始'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  inner: {flex: 1, padding: 16, gap: 16},
  title: {fontSize: 20, fontWeight: '700'},
  field: {gap: 8},
  label: {fontSize: 14, fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  suffix: {fontSize: 16, fontWeight: '600'},
  hint: {fontSize: 12, color: '#666'},
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


