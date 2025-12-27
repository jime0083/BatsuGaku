import {initializeApp, getApps} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';

// TODO: Firebase コンソールで作成した Web アプリの設定を貼り付けてください
// - iOS ネイティブの GoogleService-Info.plist とは別物です（JS SDK 用）。
// - まだ用意できていない場合は空のままでもアプリは起動しますが、連携機能は動きません。
const firebaseConfig = {
  apiKey: 'AIzaSyChroAIgZ60g4Qlx46GOvukbRFTUpOH4wY',
  authDomain: 'batsugaku.firebaseapp.com',
  projectId: 'batsugaku',
  storageBucket: 'batsugaku.firebasestorage.app',
  messagingSenderId: '518497599552',
  appId: '1:518497599552:web:f2c5c1feab181d0e299fa5',
};

export const firebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}


