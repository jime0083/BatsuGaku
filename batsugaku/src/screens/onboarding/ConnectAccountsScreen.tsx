import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  Text,
  View,
  Linking,
  Pressable,
  StyleSheet,
  Alert,
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
import {
  firebaseAuth,
  firestore,
  firebaseProjectId,
  isFirebaseConfigured,
  validateFirebaseConfig,
} from '../../config/firebase';
import {getFunctionsBaseUrl} from '../../config/functions';

type UserLinkState = {
  xLinked: boolean;
  githubLinked: boolean;
  subscribed: boolean;
  hasGoal: boolean;
};

type AuthInitStatus = 'idle' | 'initializing' | 'ready' | 'error';

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
  const [authStatus, setAuthStatus] = useState<AuthInitStatus>('idle');
  const [linkState, setLinkState] = useState<UserLinkState>({
    xLinked: false,
    githubLinked: false,
    subscribed: false,
    hasGoal: false,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const retryAnonymousAuth = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    setAuthStatus('initializing');
    setInitError(null);
    try {
      await signInAnonymously(firebaseAuth);
    } catch (e: any) {
      console.error('匿名認証に失敗しました', e);
      setInitError(String(e?.message ?? e));
      setAuthStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    setAuthStatus('initializing');
    const unsub = onAuthStateChanged(firebaseAuth, async (user: User | null) => {
      if (!user) {
        try {
          await signInAnonymously(firebaseAuth);
        } catch (e: any) {
          console.error('匿名認証に失敗しました', e);
          setInitError(String(e?.message ?? e));
          setAuthStatus('error');
        }
        return;
      }
      setUid(user.uid);
      setInitError(null);
      setAuthStatus('ready');
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
    // firestore.app.options.projectId に依存すると、初期化失敗時に空になるケースがあるため、
    // src/config/firebase.ts の projectId を正とする。
    return getFunctionsBaseUrl(firebaseProjectId);
  }, []);

  const isReadyToStartOAuth =
    authStatus === 'ready' && Boolean(uid) && Boolean(baseApi) && !isBusy;

  const startOAuth = useCallback(
    async (provider: 'x' | 'github') => {
      if (!uid) {
        Alert.alert('準備中', '認証の初期化中です。数秒待ってからもう一度お試しください。');
        return;
      }
      if (!baseApi) {
        const cfg = validateFirebaseConfig();
        Alert.alert(
          '設定エラー',
          cfg.ok
            ? 'Functions のURLを作れませんでした。`src/config/functions.ts` の FUNCTIONS_BASE_URL_OVERRIDE を設定してください。'
            : `Firebase 設定が不完全です:\n- ${cfg.problems.join('\n- ')}\n\nsrc/config/firebase.ts を確認してください。`,
        );
        return;
      }

      setIsBusy(true);
      try {
        const redirectUri = 'batsugaku://oauth/callback';
        const url = `${baseApi}/oauth/${provider}/start?uid=${encodeURIComponent(
          uid,
        )}&redirectUri=${encodeURIComponent(redirectUri)}`;
        const can = await Linking.canOpenURL(url);
        if (!can) {
          throw new Error(`canOpenURL returned false: ${url}`);
        }
        await Linking.openURL(url);
      } catch (e: any) {
        console.error('OAuth開始に失敗しました', e);
        Alert.alert(
          'エラー',
          'ブラウザを開けませんでした。端末のネットワーク状態と Firebase Functions のデプロイ状況を確認してください。',
        );
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
        {authStatus === 'initializing' && (
          <Text style={styles.subtleText}>認証を初期化しています…</Text>
        )}

        <Pressable
          style={[
            styles.button,
            {
              backgroundColor:
                linkState.xLinked || !isReadyToStartOAuth
                  ? disabledButtonColor
                  : enabledButtonColor,
            },
          ]}
          disabled={linkState.xLinked || !isReadyToStartOAuth}
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
                : !isReadyToStartOAuth
                  ? disabledButtonColor
                  : enabledButtonColor,
            },
          ]}
          disabled={linkState.githubLinked || !isReadyToStartOAuth}
          onPress={() => startOAuth('github')}>
          <Text style={styles.buttonText}>
            {linkState.githubLinked ? 'GitHub 連携済み' : 'Githubと連携する'}
          </Text>
        </Pressable>

        {!!initError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>認証初期化エラー</Text>
            <Text style={styles.errorMessage}>{initError}</Text>
            <Text style={styles.errorHint}>
              代表例: auth/configuration-not-found は Firebase Console 側の Authentication 未初期化 or 匿名認証OFF が原因です。
            </Text>
            <Text style={styles.errorHint}>
              Firebase Console → Authentication → 「始める」→ Sign-in method の Anonymous を有効化してから「再試行」を押してください。
            </Text>
            <Text style={styles.errorHint}>
              併せて、GCP の API キー制限（HTTPリファラ制限等）で Auth がブロックされていないかも確認してください。
            </Text>

            <Pressable
              style={[styles.button, { backgroundColor: enabledButtonColor }]}
              onPress={retryAnonymousAuth}
              disabled={isBusy}>
              <Text style={styles.buttonText}>再試行</Text>
            </Pressable>
          </View>
        )}
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
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    gap: 8,
  },
  errorTitle: {fontSize: 14, fontWeight: '700', color: '#111'},
  errorMessage: {fontSize: 12, color: '#111'},
  errorHint: {fontSize: 12, color: '#333'},
  subtleText: {fontSize: 12, color: '#666'},
});


