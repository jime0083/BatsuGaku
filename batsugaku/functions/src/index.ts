import {setGlobalOptions} from 'firebase-functions/v2';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import crypto from 'crypto';
import {decrypt, encrypt} from './security/crypto';
import {OAuthStateDoc, newStateId} from './oauth/state';
import {onSchedule} from 'firebase-functions/v2/scheduler';

setGlobalOptions({
  region: 'asia-northeast1',
  maxInstances: 10,
});

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ===== Secrets (set via `firebase functions:secrets:set <NAME>`) =====
const GITHUB_CLIENT_ID = defineSecret('GITHUB_CLIENT_ID');
const GITHUB_CLIENT_SECRET = defineSecret('GITHUB_CLIENT_SECRET');
const X_CLIENT_ID = defineSecret('X_CLIENT_ID');
const X_CLIENT_SECRET = defineSecret('X_CLIENT_SECRET');
const SECRET_ENCRYPTION_KEY = defineSecret('SECRET_ENCRYPTION_KEY');

function nowTs() {
  return admin.firestore.Timestamp.now();
}

function ensureEncryptionKeyFromSecret() {
  if (!process.env.SECRET_ENCRYPTION_KEY) {
    process.env.SECRET_ENCRYPTION_KEY = SECRET_ENCRYPTION_KEY.value();
  }
}

function base64Url(input: Buffer) {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function createOAuthState(params: {
  provider: 'github' | 'x';
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

function getOAuthPublicBaseUrl(req: any): string {
  // Firebase Functions v2 は、アクセス経路によって URL の形が変わる:
  // - cloudfunctions.net 経由: https://<region>-<project>.cloudfunctions.net/oauth/<path>
  // - 直接 URL（a.run.app）:   https://oauth-xxxxx-xx.a.run.app/<path>
  //
  // 本関数は、プロバイダへ渡す redirect_uri を「実際に到達できる形」で生成する。
  const proto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = String(req.get('host') || '').trim();
  const root = `${proto}://${host}`;
  if (host.endsWith('.cloudfunctions.net')) {
    return `${root}/oauth`;
  }
  return root;
}

function redirectToApp(res: any, redirectUri: string, provider: string, status: string) {
  const url = new URL(redirectUri);
  url.searchParams.set('provider', provider);
  url.searchParams.set('status', status);
  res.redirect(302, url.toString());
}

function getRootUrl(req: any): string {
  const proto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = req.get('host');
  return `${proto}://${host}`;
}

function jstTodayKey(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

function jstMidnightTimestamp(year: number, month1to12: number, day: number) {
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.UTC(year, month1to12 - 1, day, 0, 0, 0)),
  );
}

function verifyGitHubSignature(rawBody: Buffer, secret: string, signatureHeader: string | undefined) {
  if (!signatureHeader) return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const expected = prefix + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function installGitHubWebhooksForUser(params: {
  req: any;
  uid: string;
  accessToken: string;
}) {
  // webhook secret (per-user)
  const secretPlain = base64Url(crypto.randomBytes(32));
  const secretEnc = encrypt(secretPlain);

  const webhookUrl = `${getRootUrl(params.req)}/githubWebhook?uid=${encodeURIComponent(params.uid)}`;

  // Store secret (encrypted) + url for debugging
  await db.collection('users').doc(params.uid).set(
    {
      github: {
        webhookSecretEncrypted: secretEnc,
        webhookUrl,
      },
      updatedAt: nowTs(),
    },
    {merge: true},
  );

  // List repos (paginate)
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const reposRes = await (globalThis.fetch as any)(
      `https://api.github.com/user/repos?per_page=100&page=${page}&visibility=all&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          Authorization: `token ${params.accessToken}`,
          'User-Agent': 'batsugaku',
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!reposRes.ok) {
      const body = await reposRes.text();
      throw new Error(`github repos failed: ${reposRes.status} ${body}`);
    }
    const repos: any[] = await reposRes.json();
    if (!Array.isArray(repos) || repos.length === 0) {
      hasMore = false;
      break;
    }

    for (const repo of repos) {
      const fullName = String(repo?.full_name ?? '');
      if (!fullName || !fullName.includes('/')) continue;

      // Create webhook (best-effort)
      const hooksRes = await (globalThis.fetch as any)(
        `https://api.github.com/repos/${fullName}/hooks`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${params.accessToken}`,
            'User-Agent': 'batsugaku',
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'web',
            active: true,
            events: ['push'],
            config: {
              url: webhookUrl,
              content_type: 'json',
              secret: secretPlain,
              insecure_ssl: '0',
            },
          }),
        },
      );

      // 201 created / 422 already exists / 404 no admin rights etc.
      if (hooksRes.status === 201 || hooksRes.status === 422) {
        continue;
      }
      // ignore failures per repo (permissions)
      // eslint-disable-next-line no-console
      continue;
    }

    if (repos.length < 100) {
      hasMore = false;
      break;
    }
    page += 1;
  }
}

// OAuth router:
// - /oauth/github/start
// - /oauth/github/callback
// - /oauth/x/start
// - /oauth/x/callback
export const oauth = onRequest(
  {secrets: [GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, X_CLIENT_ID, X_CLIENT_SECRET, SECRET_ENCRYPTION_KEY]},
  async (req, res) => {
    try {
      // crypto.ts は process.env を参照するので、secret を env に注入
      ensureEncryptionKeyFromSecret();

      const path = req.path || '/';
      if (req.method !== 'GET') {
        res.status(405).send('method not allowed');
        return;
      }

      if (path === '/github/start') {
        const uid = String(req.query.uid ?? '');
        const redirectUri = String(req.query.redirectUri ?? '');
        if (!uid || !redirectUri) {
          res.status(400).send('uid and redirectUri are required');
          return;
        }

        const stateId = await createOAuthState({
          provider: 'github',
          uid,
          redirectUri,
        });

        const callbackUrl = `${getOAuthPublicBaseUrl(req)}/github/callback`;
        const authorize = new URL('https://github.com/login/oauth/authorize');
        authorize.searchParams.set('client_id', GITHUB_CLIENT_ID.value());
        authorize.searchParams.set('redirect_uri', callbackUrl);
        authorize.searchParams.set('state', stateId);
        authorize.searchParams.set('scope', 'repo public_repo');

        res.redirect(302, authorize.toString());
        return;
      }

      if (path === '/github/callback') {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        if (!code || !state) {
          res
            .status(200)
            .send(
              [
                'GitHub OAuth callback endpoint',
                '',
                'このURLは GitHub が認可後にリダイレクトして呼び出すためのものです。',
                'ブラウザで直接開くと code/state が無いので処理できません。',
                '',
                'GitHub OAuth App の Authorization callback URL には次を登録してください:',
                `${getOAuthPublicBaseUrl(req)}/github/callback`,
              ].join('\n'),
            );
          return;
        }

        const stateDoc = await consumeOAuthState(state);
        if (stateDoc.provider !== 'github') throw new Error('provider mismatch');

        const tokenRes = await (globalThis.fetch as any)(
          'https://github.com/login/oauth/access_token',
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: GITHUB_CLIENT_ID.value(),
              client_secret: GITHUB_CLIENT_SECRET.value(),
              code,
            }),
          },
        );
        const tokenJson: any = await tokenRes.json();
        const accessToken = String(tokenJson.access_token ?? '');
        if (!accessToken) throw new Error('token exchange failed');

        const meRes = await (globalThis.fetch as any)('https://api.github.com/user', {
          headers: {
            Authorization: `token ${accessToken}`,
            'User-Agent': 'batsugaku',
            Accept: 'application/vnd.github+json',
          },
        });
        const me: any = await meRes.json();

        // Webhook を自動登録（push監視のA案）
        await installGitHubWebhooksForUser({
          req,
          uid: stateDoc.uid,
          accessToken,
        });

        await db.collection('users').doc(stateDoc.uid).set(
          {
            github: {
              id: String(me.id ?? ''),
              username: String(me.login ?? ''),
              accessTokenEncrypted: encrypt(accessToken),
            },
            'linked.github': true,
            updatedAt: nowTs(),
          },
          {merge: true},
        );

        redirectToApp(res, stateDoc.redirectUri, 'github', 'success');
        return;
      }

      if (path === '/x/start') {
        const uid = String(req.query.uid ?? '');
        const redirectUri = String(req.query.redirectUri ?? '');
        if (!uid || !redirectUri) {
          res.status(400).send('uid and redirectUri are required');
          return;
        }

        // PKCE (S256)
        const codeVerifier = base64Url(crypto.randomBytes(32));
        const codeChallenge = base64Url(
          crypto.createHash('sha256').update(codeVerifier).digest(),
        );

        const stateId = await createOAuthState({
          provider: 'x',
          uid,
          redirectUri,
          codeVerifier,
        });

        const callbackUrl = `${getOAuthPublicBaseUrl(req)}/x/callback`;

        const authorize = new URL('https://twitter.com/i/oauth2/authorize');
        authorize.searchParams.set('response_type', 'code');
        authorize.searchParams.set('client_id', X_CLIENT_ID.value());
        authorize.searchParams.set('redirect_uri', callbackUrl);
        authorize.searchParams.set(
          'scope',
          'tweet.read tweet.write users.read offline.access',
        );
        authorize.searchParams.set('state', stateId);
        authorize.searchParams.set('code_challenge', codeChallenge);
        authorize.searchParams.set('code_challenge_method', 'S256');

        res.redirect(302, authorize.toString());
        return;
      }

      if (path === '/x/callback') {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        if (!code || !state) {
          res
            .status(200)
            .send(
              [
                'X OAuth callback endpoint',
                '',
                'このURLは X が認可後にリダイレクトして呼び出すためのものです。',
                'ブラウザで直接開くと code/state が無いので処理できません。',
                '',
                'X Developer Portal の Callback/Redirect URL には次を登録してください:',
                `${getOAuthPublicBaseUrl(req)}/x/callback`,
              ].join('\n'),
            );
          return;
        }

        const stateDoc = await consumeOAuthState(state);
        if (stateDoc.provider !== 'x') throw new Error('provider mismatch');

        const callbackUrl = `${getOAuthPublicBaseUrl(req)}/x/callback`;

        const tokenRes = await (globalThis.fetch as any)(
          'https://api.twitter.com/2/oauth2/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization:
                'Basic ' +
                Buffer.from(`${X_CLIENT_ID.value()}:${X_CLIENT_SECRET.value()}`).toString('base64'),
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: callbackUrl,
              code_verifier: stateDoc.codeVerifier ?? '',
            }).toString(),
          },
        );
        const tokenJson: any = await tokenRes.json();
        const accessToken = String(tokenJson.access_token ?? '');
        if (!accessToken) throw new Error('token exchange failed');

        const meRes = await (globalThis.fetch as any)(
          'https://api.twitter.com/2/users/me',
          {
            headers: {Authorization: `Bearer ${accessToken}`},
          },
        );
        const meJson: any = await meRes.json();
        const me = meJson?.data ?? {};

        await db.collection('users').doc(stateDoc.uid).set(
          {
            twitter: {
              id: String(me.id ?? ''),
              username: String(me.username ?? ''),
              accessTokenEncrypted: encrypt(accessToken),
              accessTokenSecretEncrypted: '',
            },
            'linked.x': true,
            updatedAt: nowTs(),
          },
          {merge: true},
        );

        redirectToApp(res, stateDoc.redirectUri, 'x', 'success');
        return;
      }

      res.status(404).send('not found');
    } catch (e: any) {
      res.status(500).send(String(e?.message ?? e));
    }
  },
);

export const healthCheck = onRequest((_req, res) => {
  res.status(200).send('OK');
});

function formatSkipPostText(goal: any): string {
  const income = goal?.targetIncome;
  const skill = goal?.skill;
  return `年収${income}万を目指し${skill}をすると宣言したにもかかわらず今日サボってしまった愚かな人間です`;
}

async function postTweet(accessToken: string, text: string) {
  const resp = await (globalThis.fetch as any)('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({text}),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`x tweet failed: ${resp.status} ${body}`);
  }
}

function jstYesterdayKey(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() - 1);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

export const checkDailyStudyAndPostSkip = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Tokyo',
    secrets: [SECRET_ENCRYPTION_KEY],
  },
  async () => {
    // crypto.ts は process.env を参照するので、secret を env に注入
    ensureEncryptionKeyFromSecret();

    const dateKey = jstYesterdayKey();
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const user: any = userDoc.data();

      const linkedX = Boolean(user?.linked?.x);
      const linkedGithub = Boolean(user?.linked?.github);
      const subscribed = Boolean(user?.subscription?.active);
      const goal = user?.goal;
      const hasGoal = Boolean(goal?.targetIncome) && Boolean(goal?.skill);
      const tokenEnc = user?.twitter?.accessTokenEncrypted;

      if (!linkedX || !linkedGithub || !subscribed || !hasGoal || !tokenEnc) {
        continue;
      }

      // push 監視は今後実装予定。現時点では studyLogs が無ければサボり扱い。
      const logId = `${userDoc.id}_${dateKey}`;
      const logSnap = await db.collection('studyLogs').doc(logId).get();
      const studied = logSnap.exists && Boolean((logSnap.data() as any)?.studied);

      if (studied) {
        continue;
      }

      const accessToken = decrypt(String(tokenEnc));
      const text = formatSkipPostText(goal);

      try {
        await postTweet(accessToken, text);
      } catch (e) {
        // TODO: リトライやログ基盤に送る（今は握りつぶして次ユーザーへ）
        continue;
      }
    }
  },
);

// ===== GitHub Webhook (push監視) =====
export const githubWebhook = onRequest(
  {secrets: [SECRET_ENCRYPTION_KEY]},
  async (req, res) => {
    try {
      ensureEncryptionKeyFromSecret();

      const uid = String(req.query.uid ?? '');
      if (!uid) {
        res.status(400).send('missing uid');
        return;
      }

      const event = String(req.get('x-github-event') ?? '');
      if (event !== 'push') {
        res.status(200).send('ignored');
        return;
      }

      const userSnap = await db.collection('users').doc(uid).get();
      if (!userSnap.exists) {
        res.status(404).send('user not found');
        return;
      }
      const user: any = userSnap.data();
      const secretEnc = user?.github?.webhookSecretEncrypted;
      if (!secretEnc) {
        res.status(403).send('missing webhook secret');
        return;
      }
      const secretPlain = decrypt(String(secretEnc));

      const sig = String(req.get('x-hub-signature-256') ?? '');
      const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      if (!verifyGitHubSignature(rawBody, secretPlain, sig)) {
        res.status(401).send('invalid signature');
        return;
      }

      const dateKey = jstTodayKey();
      const now = new Date();
      const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const y = jst.getUTCFullYear();
      const m = jst.getUTCMonth() + 1;
      const d = jst.getUTCDate();
      const midnight = jstMidnightTimestamp(y, m, d);
      const nowTimestamp = nowTs();

      const logId = `${uid}_${dateKey}`;
      const logRef = db.collection('studyLogs').doc(logId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(logRef);
        if (!snap.exists) {
          tx.set(logRef, {
            userId: uid,
            date: midnight,
            studied: true,
            pushCount: 1,
            firstPushAt: nowTimestamp,
            createdAt: nowTimestamp,
          });
        } else {
          const data: any = snap.data();
          const updates: any = {
            studied: true,
            pushCount: admin.firestore.FieldValue.increment(1),
          };
          if (!data?.firstPushAt) {
            updates.firstPushAt = nowTimestamp;
          }
          tx.update(logRef, updates);
        }
        tx.set(
          db.collection('users').doc(uid),
          {
            'stats.lastStudyDate': midnight,
            updatedAt: nowTimestamp,
          },
          {merge: true},
        );
      });

      res.status(200).send('ok');
    } catch (e: any) {
      res.status(500).send(String(e?.message ?? e));
    }
  },
);
