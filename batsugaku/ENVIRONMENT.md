## 環境変数・秘密情報の管理方針

- **モバイルアプリ（React Native）**
  - Firebase のクライアント設定は標準の `GoogleService-Info.plist`（iOS）で管理し、ソースコード内や `.env` にはクライアントシークレットを置かない。
  - X / GitHub の **クライアントシークレットは一切アプリに配布しない**。OAuth の開始のみを行い、トークン取得やサボり投稿などの処理はすべて Firebase Functions 側で実行する。
  - 必要に応じて「環境名」などの非秘匿情報のみを、ビルド設定または設定ファイルで扱う。

- **Firebase Functions / バックエンド**
  - X API・GitHub API のクライアントシークレットやアクセストークンなどの機微情報は、Firebase の環境変数（`firebase functions:config:set` など）もしくは GCP Secret Manager に保存し、ソースコードには直接書かない。
  - Firestore へのアクセス権限は、Firebase Security Rules と Functions のサービスアカウント権限で制御する。
  - 開発環境でのみ使用するローカル用環境変数ファイルは `.env.local` などの名前で作成し、`.gitignore` によりリポジトリに含めない。

## Firebase Authentication（必須設定）

本アプリはオンボーディングの最初に `signInAnonymously`（匿名認証）で `uid` を確定させ、その `uid` を使って X / GitHub の OAuth を開始します。

そのため、Firebase Console 側で以下が未設定だと、iPhone側で次のようなエラーになり連携ボタンが押せません：

- `Firebase: Error (auth/configuration-not-found)`

### 設定手順

1) Firebase Console → プロジェクト `batsugaku` → Build → Authentication を開く  
2) まだの場合は「始める（Get started）」を押して Authentication を有効化  
3) Sign-in method で **Anonymous（匿名）** を **有効化**して保存  

### 併せて確認（APIキー制限）

Google Cloud Console → API とサービス → 認証情報 → Firebase Web SDK の API キーで、過度な制限（例: HTTP リファラ制限）がかかっていると iOS 端末から Auth API が呼べず失敗します。必要に応じて制限を緩めてください。


