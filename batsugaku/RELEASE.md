## テスト戦略と実施内容（概要）

- **単体テスト（Jest）**
  - `src/utils/calendar.ts` の `buildMonthlyCalendar`：学習日・サボり日・未来日の区別ロジックを検証。
  - `src/utils/badges.ts` の `getEarnedBadges`：連続日数 / 累計日数 / サボり回数に応じたバッジ付与ロジックを検証。
  - `functions/src/security/crypto.ts` の `encrypt/decrypt`：アクセストークン暗号化の往復で値が変わらないことを検証。

- **結合テスト（手動想定）**
  - GitHub Webhook → `studyLogs` → `users.stats` 更新 → 通知送信までの流れを Firebase Emulator Suite 上で確認。
  - 日次スケジュール（`checkDailyStudy`）のロジックを、前日の `studyLogs` を用意して動作確認。

- **E2E テスト（手動想定）**
  - 初回ログイン → 目標設定 → 学習（GitHub push）→ ダッシュボード / カレンダー / バッジ表示を確認。
  - サボり日を発生させ、23:00 / 23:30 の予告通知と 0:00 の X サボり投稿が想定どおり動作するかを確認。

## App Store リリース準備チェックリスト

- **アプリ設定**
  - バンドルID・バージョン / ビルド番号の設定。
  - iOS プロビジョニングプロファイル / 証明書の設定。
  - プッシュ通知（APNs）・Firebase Cloud Messaging の連携確認。

- **サブスクリプション設定**
  - 月額 300円 の定期購読プロダクトを App Store Connect で作成。
  - 無料クーポン（プロモコード）発行手順の確認。

- **審査用情報**
  - プライバシーポリシー / 利用規約（X / GitHub 連携の説明を含む）の URL を用意。
  - スクリーンショット・アイコン・説明文（日英）の準備。
  - 審査用テストアカウント（X / GitHub / アプリ内アカウント）の用意。

- **リリース後運用**
  - X API 使用量監視（`monitorXAPIUsage`）のログ・アラート先を確認。
  - Firebase Crashlytics / Logging 等でエラーをモニタリング。


