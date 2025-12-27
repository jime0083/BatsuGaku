import {setGlobalOptions} from 'firebase-functions/v2';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import crypto from 'crypto';
import {encrypt} from './security/crypto';
import {OAuthStateDoc, newStateId} from './oauth/state';

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

function getFunctionBaseUrl(req: any): string {
  // 例: https://asia-northeast1-batsugaku.cloudfunctions.net/oauth/github/start
  // baseUrl は /oauth（関数名）になる
  const proto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = req.get('host');
  return `${proto}://${host}${req.baseUrl}`;
}

function redirectToApp(res: any, redirectUri: string, provider: string, status: string) {
  const url = new URL(redirectUri);
  url.searchParams.set('provider', provider);
  url.searchParams.set('status', status);
  res.redirect(302, url.toString());
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
      if (!process.env.SECRET_ENCRYPTION_KEY) {
        process.env.SECRET_ENCRYPTION_KEY = SECRET_ENCRYPTION_KEY.value();
      }

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

        const callbackUrl = `${getFunctionBaseUrl(req)}/github/callback`;
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
          res.status(400).send('missing code/state');
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

        const callbackUrl = `${getFunctionBaseUrl(req)}/x/callback`;

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
          res.status(400).send('missing code/state');
          return;
        }

        const stateDoc = await consumeOAuthState(state);
        if (stateDoc.provider !== 'x') throw new Error('provider mismatch');

        const callbackUrl = `${getFunctionBaseUrl(req)}/x/callback`;

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
            linked: {x: true},
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
