import * as admin from 'firebase-admin';

export type OAuthProvider = 'github' | 'x';

export type OAuthStateDoc = {
  provider: OAuthProvider;
  uid: string;
  redirectUri: string;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  // for PKCE (X)
  codeVerifier?: string;
};

export function newStateId(): string {
  return admin.firestore().collection('_').doc().id;
}


