## 環境変数・秘密情報の管理方針

- **モバイルアプリ（React Native）**
  - Firebase のクライアント設定は標準の `GoogleService-Info.plist`（iOS）で管理し、ソースコード内や `.env` にはクライアントシークレットを置かない。
  - X / GitHub の **クライアントシークレットは一切アプリに配布しない**。OAuth の開始のみを行い、トークン取得やサボり投稿などの処理はすべて Firebase Functions 側で実行する。
  - 必要に応じて「環境名」などの非秘匿情報のみを、ビルド設定または設定ファイルで扱う。

- **Firebase Functions / バックエンド**
  - X API・GitHub API のクライアントシークレットやアクセストークンなどの機微情報は、Firebase の環境変数（`firebase functions:config:set` など）もしくは GCP Secret Manager に保存し、ソースコードには直接書かない。
  - Firestore へのアクセス権限は、Firebase Security Rules と Functions のサービスアカウント権限で制御する。
  - 開発環境でのみ使用するローカル用環境変数ファイルは `.env.local` などの名前で作成し、`.gitignore` によりリポジトリに含めない。


