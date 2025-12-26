import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {encrypt} from './security/crypto';
import {
  BadgeDocument,
  StudyLogDocument,
  UserDocument,
} from './types/firestore';
import {OAuthStateDoc, newStateId} from './oauth/state';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

type Provider = 'github' | 'x';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function buildRedirect(url: string): string {
  return url;
}

function nowTs() {
  return admin.firestore.Timestamp.now();
}

async function createOAuthState(params: {
  provider: Provider;
  uid: string;
  redirectUri: string;
  codeVerifier?: string;
}) {
  const stateId = newStateId();
  const createdAt = nowTs();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + 15 * 60 * 1000,
  );
  const doc: OAuthStateDoc = {
    provider: params.provider,
    uid: params.uid,
    redirectUri: params.redirectUri,
    createdAt,
    expiresAt,
    ...(params.codeVerifier ? {codeVerifier: params.codeVerifier} : {}),
  };
  await db.collection('oauthStates').doc(stateId).set(doc);
  return stateId;
}

async function consumeOAuthState(stateId: string): Promise<OAuthStateDoc> {
  const ref = db.collection('oauthStates').doc(stateId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('invalid state');
  const doc = snap.data() as OAuthStateDoc;
  await ref.delete();
  if (doc.expiresAt.toMillis() < Date.now()) throw new Error('state expired');
  return doc;
}

// シンプルなヘルスチェック
export const healthCheck = functions.https.onRequest((_req, res) => {
  res.status(200).send('OK');
});

// ===== OAuth start endpoints =====

export const startGitHubOAuth = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    try {
      const uid = String(req.query.uid ?? '');
      const redirectUri = String(req.query.redirectUri ?? '');
      if (!uid || !redirectUri) {
        res.status(400).send('uid and redirectUri are required');
        return;
      }

      const clientId = requireEnv('GITHUB_CLIENT_ID');
      const stateId = await createOAuthState({
        provider: 'github',
        uid,
        redirectUri,
      });

      const githubAuthorize = new URL('https://github.com/login/oauth/authorize');
      githubAuthorize.searchParams.set('client_id', clientId);
      githubAuthorize.searchParams.set('state', stateId);
      githubAuthorize.searchParams.set('scope', 'repo public_repo');

      res.redirect(302, githubAuthorize.toString());
    } catch (e: any) {
      res.status(500).send(String(e?.message ?? e));
    }
  });

export const startXOAuth = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    try {
      const uid = String(req.query.uid ?? '');
      const redirectUri = String(req.query.redirectUri ?? '');
      if (!uid || !redirectUri) {
        res.status(400).send('uid and redirectUri are required');
        return;
      }

      // OAuth2 (PKCE)
      const clientId = requireEnv('X_CLIENT_ID');
      const callbackUrl = requireEnv('X_REDIRECT_URI'); // functions callback URL

      const codeVerifier = admin.firestore().collection('_').doc().id + admin.firestore().collection('_').doc().id;
      const codeChallenge = codeVerifier; // TODO: S256 にする（本番必須）
      const codeChallengeMethod = 'plain';

      const stateId = await createOAuthState({
        provider: 'x',
        uid,
        redirectUri,
        codeVerifier,
      });

      const authorize = new URL('https://twitter.com/i/oauth2/authorize');
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('client_id', clientId);
      authorize.searchParams.set('redirect_uri', callbackUrl);
      authorize.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
      authorize.searchParams.set('state', stateId);
      authorize.searchParams.set('code_challenge', codeChallenge);
      authorize.searchParams.set('code_challenge_method', codeChallengeMethod);

      res.redirect(302, authorize.toString());
    } catch (e: any) {
      res.status(500).send(String(e?.message ?? e));
    }
  });

// ===== OAuth callback endpoints =====

export const githubOAuthCallback = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    try {
      const code = String(req.query.code ?? '');
      const state = String(req.query.state ?? '');
      if (!code || !state) {
        res.status(400).send('missing code/state');
        return;
      }

      const stateDoc = await consumeOAuthState(state);
      if (stateDoc.provider !== 'github') throw new Error('provider mismatch');

      const clientId = requireEnv('GITHUB_CLIENT_ID');
      const clientSecret = requireEnv('GITHUB_CLIENT_SECRET');

      // Exchange code -> token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const tokenJson: any = await tokenRes.json();
      const accessToken = String(tokenJson.access_token ?? '');
      if (!accessToken) throw new Error('token exchange failed');

      // Fetch user profile
      const meRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'batsugaku',
          Accept: 'application/vnd.github+json',
        },
      });
      const me: any = await meRes.json();

      await db.collection('users').doc(stateDoc.uid).set(
        {
          github: {
            id: String(me.id ?? ''),
            username: String(me.login ?? ''),
            accessTokenEncrypted: encrypt(accessToken),
          },
          linked: {github: true},
          updatedAt: nowTs(),
        },
        {merge: true},
      );

      res.redirect(
        302,
        buildRedirect(
          `${stateDoc.redirectUri}?provider=github&status=success`,
        ),
      );
    } catch (e: any) {
      res.status(500).send(String(e?.message ?? e));
    }
  });

export const xOAuthCallback = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    try {
      const code = String(req.query.code ?? '');
      const state = String(req.query.state ?? '');
      if (!code || !state) {
        res.status(400).send('missing code/state');
        return;
      }
      const stateDoc = await consumeOAuthState(state);
      if (stateDoc.provider !== 'x') throw new Error('provider mismatch');

      const clientId = requireEnv('X_CLIENT_ID');
      const clientSecret = requireEnv('X_CLIENT_SECRET');
      const callbackUrl = requireEnv('X_REDIRECT_URI');

      // Exchange code -> token
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
          code_verifier: stateDoc.codeVerifier ?? '',
        }),
      });
      const tokenJson: any = await tokenRes.json();
      const accessToken = String(tokenJson.access_token ?? '');
      if (!accessToken) throw new Error('token exchange failed');

      // Fetch user profile
      const meRes = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const meJson: any = await meRes.json();
      const me = meJson?.data ?? {};

      await db.collection('users').doc(stateDoc.uid).set(
        {
          twitter: {
            id: String(me.id ?? ''),
            username: String(me.username ?? ''),
            accessTokenEncrypted: encrypt(accessToken),
            accessTokenSecretEncrypted: '', // OAuth2 のため空
          },
          linked: {x: true},
          updatedAt: nowTs(),
        },
        {merge: true},
      );

      res.redirect(
        302,
        buildRedirect(`${stateDoc.redirectUri}?provider=x&status=success`),
      );
    } catch (e: any) {
      res.status(500).send(String(e?.message ?? e));
    }
  });

// GitHub Webhook: push イベントを受け取り学習ログ・統計を更新し、初回 push 時に通知を送信
export const onGitHubPush = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    const event = req.header('x-github-event');
    if (event !== 'push') {
      res.status(200).send('ignored');
      return;
    }

    const body = req.body as any;
    const sender = body.sender;
    const githubId = String(sender?.id ?? '');
    if (!githubId) {
      res.status(400).send('missing sender id');
      return;
    }

    const userSnap = await db
      .collection('users')
      .where('github.id', '==', githubId)
      .limit(1)
      .get();

    if (userSnap.empty) {
      res.status(200).send('user not found');
      return;
    }

    const userDoc = userSnap.docs[0];
    const user = userDoc.data() as UserDocument;

    // JST 基準で「今日」のキーを作成
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth() + 1;
    const d = jst.getUTCDate();
    const dateKey = `${y}${String(m).padStart(2, '0')}${String(d).padStart(
      2,
      '0',
    )}`;

    const logId = `${user.userId}_${dateKey}`;
    const logRef = db.collection('studyLogs').doc(logId);

    const logSnap = await logRef.get();
    const nowTs = admin.firestore.Timestamp.now();

    let isFirstPushOfDay = false;

    if (!logSnap.exists) {
      const log: StudyLogDocument = {
        userId: user.userId,
        date: admin.firestore.Timestamp.fromDate(
          new Date(Date.UTC(y, m - 1, d, 0, 0, 0)),
        ),
        studied: true,
        pushCount: 1,
        firstPushAt: nowTs,
        createdAt: nowTs,
      };
      await logRef.set(log);
      isFirstPushOfDay = true;
    } else {
      await logRef.update({
        studied: true,
        pushCount: admin.firestore.FieldValue.increment(1),
      });
    }

    if (isFirstPushOfDay) {
      // 学習完了通知
      if (
        user.notificationSettings?.studyCompleted &&
        user.notificationSettings.fcmToken
      ) {
        await messaging.send({
          token: user.notificationSettings.fcmToken,
          notification: {
            title: '今日も学習お疲れさまです',
            body: 'これで連続学習日数が更新されました！',
          },
        });
      }

      // stats の連続日数などは日次バッチでも更新するが、
      // 最低限「最終学習日」を即時で更新しておく
      await userDoc.ref.update({
        'stats.lastStudyDate': admin.firestore.Timestamp.fromDate(
          new Date(Date.UTC(y, m - 1, d, 0, 0, 0)),
        ),
        updatedAt: nowTs,
      });
    }

    res.status(200).send('ok');
  });

// 毎日 0:00 JST: 前日の学習状況を集計し、サボりユーザーに X へサボり投稿
export const checkDailyStudy = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async () => {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setDate(jst.getDate() - 1); // 前日
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth() + 1;
    const d = jst.getUTCDate();
    const dateKey = `${y}${String(m).padStart(2, '0')}${String(d).padStart(
      2,
      '0',
    )}`;

    const usersSnap = await db.collection('users').get();

    for (const doc of usersSnap.docs) {
      const user = doc.data() as UserDocument;
      const logId = `${user.userId}_${dateKey}`;
      const logSnap = await db.collection('studyLogs').doc(logId).get();

      const studied = logSnap.exists && (logSnap.data() as StudyLogDocument).studied;

      const statsUpdate: Partial<UserDocument['stats']> = {};
      if (studied) {
        statsUpdate.totalStudyDays = (user.stats.totalStudyDays || 0) + 1;
        statsUpdate.currentStreak = (user.stats.currentStreak || 0) + 1;
        statsUpdate.longestStreak = Math.max(
          statsUpdate.currentStreak,
          user.stats.longestStreak || 0,
        );
        if (jst.getUTCMonth() === now.getUTCMonth()) {
          statsUpdate.currentMonthStudyDays =
            (user.stats.currentMonthStudyDays || 0) + 1;
        }
      } else {
        statsUpdate.totalSkipDays = (user.stats.totalSkipDays || 0) + 1;
        statsUpdate.currentStreak = 0;
        if (jst.getUTCMonth() === now.getUTCMonth()) {
          statsUpdate.currentMonthSkipDays =
            (user.stats.currentMonthSkipDays || 0) + 1;
        }

        // TODO: X API を用いたサボり投稿（リトライ処理含む）を実装
      }

      await doc.ref.update({
        'stats.totalStudyDays': statsUpdate.totalStudyDays ?? user.stats.totalStudyDays,
        'stats.totalSkipDays': statsUpdate.totalSkipDays ?? user.stats.totalSkipDays,
        'stats.currentStreak': statsUpdate.currentStreak ?? user.stats.currentStreak,
        'stats.longestStreak': statsUpdate.longestStreak ?? user.stats.longestStreak,
        'stats.currentMonthStudyDays':
          statsUpdate.currentMonthStudyDays ?? user.stats.currentMonthStudyDays,
        'stats.currentMonthSkipDays':
          statsUpdate.currentMonthSkipDays ?? user.stats.currentMonthSkipDays,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  });

// 毎日 23:00 JST – サボり予告通知（第1回）
export const sendWarningNotification23 = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 23 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async () => {
    await sendSkipWarningForToday('first');
  });

// 毎日 23:30 JST – サボり予告通知（最終）
export const sendWarningNotification2330 = functions
  .region('asia-northeast1')
  .pubsub.schedule('30 23 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async () => {
    await sendSkipWarningForToday('last');
  });

async function sendSkipWarningForToday(kind: 'first' | 'last') {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const dateKey = `${y}${String(m).padStart(2, '0')}${String(d).padStart(
    2,
    '0',
  )}`;

  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const user = doc.data() as UserDocument;
    if (
      !user.notificationSettings?.skipWarning ||
      !user.notificationSettings.fcmToken
    ) {
      continue;
    }

    const logId = `${user.userId}_${dateKey}`;
    const logSnap = await db.collection('studyLogs').doc(logId).get();
    const studiedToday = logSnap.exists && (logSnap.data() as StudyLogDocument).studied;
    if (studiedToday) continue;

    const bodyText =
      kind === 'first'
        ? '今日はまだ学習していないようです。0:00 にサボり投稿がされます。'
        : '残り30分！0:00になるとXにサボり投稿されます。';

    await messaging.send({
      token: user.notificationSettings.fcmToken,
      notification: {
        title: '学習リマインド',
        body: bodyText,
      },
    });
  }
}

// 毎日 0:00 JST – 統計投稿（開発者アカウント）。ユーザー数が 20 人以上のときのみ。
export const postDailyStats = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async () => {
    const usersSnap = await db.collection('users').get();
    const userCount = usersSnap.size;
    if (userCount < 20) {
      return;
    }

    // TODO: 前日の学習・サボり人数を集計し、開発者 X アカウントから投稿
  });

// 毎日 1:00 JST – X API 使用量監視
export const monitorXAPIUsage = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 1 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async () => {
    // TODO: 月間投稿数を集計し、上限接近時に開発者へアラート送信
  });

