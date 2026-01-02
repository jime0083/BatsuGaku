import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  Text,
  View,
  Linking,
  Pressable,
  StyleSheet,
} from 'react-native';
import {onAuthStateChanged, signInAnonymously, User} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  DocumentData,
  DocumentSnapshot,
} from 'firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import {firebaseAuth, firestore, isFirebaseConfigured} from '../../config/firebase';

type UserLinkState = {
  xLinked: boolean;
  githubLinked: boolean;
  subscribed: boolean;
  hasGoal: boolean;
};

const disabledButtonColor = '#CCCCCC';
const enabledButtonColor = '#111111';

function parseDeepLink(url: string): Record<string, string> {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return {};
  const query = url.slice(qIndex + 1);
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  params.forEach((v, k) => {
    result[k] = v;
  });
  return result;
}

export const ConnectAccountsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [uid, setUid] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<UserLinkState>({
    xLinked: false,
    githubLinked: false,
    subscribed: false,
    hasGoal: false,
  });
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onAuthStateChanged(firebaseAuth, async (user: User | null) => {
      if (!user) {
        await signInAnonymously(firebaseAuth);
        return;
      }
      setUid(user.uid);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) return;
    const ref = doc(firestore, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap: DocumentSnapshot<DocumentData>) => {
        const data = snap.data() as any;
      setLinkState({
        xLinked: Boolean(data?.linked?.x),
        githubLinked: Boolean(data?.linked?.github),
        subscribed: Boolean(data?.subscription?.active),
        hasGoal: Boolean(data?.goal?.targetIncome) && Boolean(data?.goal?.skill),
      });
      },
    );
    // 初回作成（存在しない場合は作る）
    setDoc(
      ref,
      {
        userId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // NOTE:
        // linked / subscription / goal は Functions や各画面で更新されるため、
        // ここでデフォルト値を入れて上書きしてしまうと、連携済みを false に戻す事故が起きる。
      },
      {merge: true},
    ).catch(() => undefined);

    return unsub;
  }, [uid]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', event => {
      // OAuth callback: batsugaku://oauth/callback?provider=github&status=success
      const params = parseDeepLink(event.url);
      if (params.status === 'success') {
        // Firestore の onSnapshot が状態更新するので、ここでは何もしない
        return;
      }
    });
    return () => sub.remove();
  }, []);

  const canUseApp = linkState.xLinked && linkState.githubLinked;

  const baseApi = useMemo(() => {
    // TODO: Firebase の projectId を設定したら自動で base URL を生成
    // 例: https://asia-northeast1-<projectId>.cloudfunctions.net
    const projectId = (firestore.app.options as any)?.projectId as string | undefined;
    if (!projectId) return '';
    return `https://asia-northeast1-${projectId}.cloudfunctions.net`;
  }, []);

  const startOAuth = useCallback(
    async (provider: 'x' | 'github') => {
      if (!uid) return;
      if (!baseApi) return;

      setIsBusy(true);
      try {
        const redirectUri = 'batsugaku://oauth/callback';
        const url = `${baseApi}/oauth/${provider}/start?uid=${encodeURIComponent(
          uid,
        )}&redirectUri=${encodeURIComponent(redirectUri)}`;
        await Linking.openURL(url);
      } finally {
        setIsBusy(false);
      }
    },
    [uid, baseApi],
  );

  if (!isFirebaseConfigured()) {
    return (
      <SafeAreaView>
        <Text>Firebase 設定が未入力です。</Text>
        <Text>
          `src/config/firebase.ts` に firebaseConfig を設定してから再起動してください。
        </Text>
      </SafeAreaView>
    );
  }

  // 両方連携できたら「サブスク」→「目標設定」へ進める（両方連携しないと使えない）
  useEffect(() => {
    if (canUseApp) {
      if (!linkState.subscribed) {
        navigation.replace('Subscription');
        return;
      }
      if (!linkState.hasGoal) {
        navigation.replace('GoalSetup');
        return;
      }
      navigation.replace('MainTabs');
    }
  }, [canUseApp, linkState.subscribed, linkState.hasGoal, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text>最初に X と GitHub を連携してください（両方必須）</Text>

        <Pressable
          style={[
            styles.button,
            {backgroundColor: linkState.xLinked ? disabledButtonColor : enabledButtonColor},
          ]}
          disabled={linkState.xLinked || isBusy}
          onPress={() => startOAuth('x')}>
          <Text style={styles.buttonText}>
            {linkState.xLinked ? 'X 連携済み' : 'Xと連携する'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: linkState.githubLinked
                ? disabledButtonColor
                : enabledButtonColor,
            },
          ]}
          disabled={linkState.githubLinked || isBusy}
          onPress={() => startOAuth('github')}>
          <Text style={styles.buttonText}>
            {linkState.githubLinked ? 'GitHub 連携済み' : 'Githubと連携する'}
          </Text>
        </Pressable>

        <Text>状態: X={String(linkState.xLinked)} / GitHub={String(linkState.githubLinked)}</Text>
        <Text>両方連携完了: {String(canUseApp)}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  inner: {padding: 16, gap: 16},
  button: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
});


