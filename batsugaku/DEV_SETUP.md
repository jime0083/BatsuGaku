## 開発環境セットアップ（ブラウザデバッグ & iPhone 実機テスト）

このドキュメントは、以下 2 パターンのテストができるようにするための手順をまとめたものです。

- Mac 上の **Chrome での動作確認（React Native DevTools / Chrome デバッガ）**
- Mac と iPhone をケーブル接続して **Xcode から iPhone 実機テスト**

> 注意: 現時点では `ios/` プロジェクトはまだ生成していません。  
> iPhone 実機テストを行う際は、後述の「5. iOS プロジェクトの作成（初回のみ）」の手順を一度だけ実施してください。

---

### 1. 前提ツールのインストール（Mac）

- Node.js（推奨: LTS）
- Watchman（任意ですが、React Native では推奨）
- Xcode（最新版）
- CocoaPods

Homebrew 例:

```bash
brew install node watchman
sudo gem install cocoapods
```

---

### 2. 依存パッケージのインストール

プロジェクトルートで以下を実行します:

```bash
cd /Users/jime0083/BatsuGaku/batsugaku
npm install
```

必要に応じて:

```bash
npx react-native doctor
```

で環境チェックを行い、警告に従って修正してください。

---

### 3. ブラウザ（Chrome）での動作テスト

React Native アプリ自体はネイティブで動作しますが、JavaScript 部分のデバッグは Chrome から行えます。

1. Metro バンドラを起動:

   ```bash
   cd /Users/jime0083/BatsuGaku/batsugaku
   npx react-native start
   ```

2. iOS シミュレータ または 実機上でアプリを起動した状態で、開発者メニューを開きます:
   - シミュレータ: `Cmd + D`
   - 実機: 端末をシェイク、または Xcode から「Debug」メニュー経由で呼び出し

3. 開発者メニューから **「Debug with Chrome」**（もしくは類似の表記）を選択します。

4. 自動的に Chrome が開き、`http://localhost:8081/debugger-ui/` に接続されます。
   - ここでコンソールログ、ブレークポイント、Network タブなどを利用してデバッグ可能です。

---

### 4. iPhone 実機テストの準備

> ここでは、すでに `ios/` プロジェクトが存在している前提での流れを記載します。  
> まだ `ios/` がない場合は、次章「5. iOS プロジェクトの作成（初回のみ）」を参照してください。

1. CocoaPods でネイティブ依存をインストール:

   ```bash
   cd /Users/jime0083/BatsuGaku/batsugaku/ios
   pod install
   ```

2. 実機インストール用ツール `ios-deploy` をインストール（React Native CLI から実機へ入れる場合に必要）:

   ```bash
   brew install ios-deploy
   ```

2. `*.xcworkspace` を Xcode で開く:
   - Finder で `ios/` フォルダを開き、`Batsugaku.xcworkspace`（仮）をダブルクリック。

3. Xcode 上部のターゲットで接続した iPhone 実機を選択。

4. 必要に応じて Bundle Identifier や Team の設定を行う（Apple Developer アカウント）。  

5. Xcode の「Run」ボタン ▶ を押してビルド & 実機インストール。

---

### 5. iOS プロジェクトの作成（初回のみ）

現在のリポジトリは、React Native アプリの JavaScript/TypeScript 部分が中心で、  
標準の React Native CLI プロジェクトが持つ `ios/` フォルダがまだ存在しません。

初回だけ、次のようにして iOS プロジェクトを生成することをおすすめします:

1. 一時的な新規 React Native プロジェクトを作成:

   ```bash
   cd /Users/jime0083/BatsuGaku
   npx react-native@latest init BatsuGakuTmp
   ```

2. 生成された `BatsuGakuTmp/ios` フォルダを、現在のプロジェクトにコピー:

   ```bash
   cp -R ./BatsuGakuTmp/ios ./batsugaku/ios
   ```

3. 不要になった `BatsuGakuTmp` を削除（任意）:

   ```bash
   rm -rf ./BatsuGakuTmp
   ```

4. `batsugaku/ios` 配下で Pod インストール:

   ```bash
   cd /Users/jime0083/BatsuGaku/batsugaku/ios
   pod install
   ```

5. Xcode で `batsugaku/ios/*.xcworkspace` を開き、Bundle Identifier・アプリ名などを `app.json` の `name` / `displayName` と整合するように調整してください。

---

### 6. よく使うコマンドまとめ

```bash
# 依存インストール
cd /Users/jime0083/BatsuGaku/batsugaku
npm install

# Metro バンドラ起動
npx react-native start

# （iOS シミュレータでの起動例）
npx react-native run-ios

# （iPhone 実機へインストールする例）
# 先に Metro を起動してから実行するのがおすすめ
npx react-native run-ios --device --no-packager
```

これらにより、Chrome での JavaScript デバッグと Xcode + iPhone 実機テストの両方を行える環境が整います。


