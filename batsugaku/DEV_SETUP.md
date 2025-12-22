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

### 3.5 Mac なしで動作確認できる形にする（Release ビルド）

結論として、**`npx react-native start` が必要なのは Debug ビルドのときだけ**です。  
Debug は JavaScript を Mac の Metro から読み込むため、iPhone が Mac に繋がっていないと動きません。

一方で **Release ビルド**は JavaScript（`main.jsbundle`）と画像等の asset を **アプリ内に同梱**するため、
一度 iPhone にインストールできれば **Mac なしでどこでも起動・動作確認**できます。

#### 手順（Xcode で Release 実行）

1. Xcode で `BatsuGakuNative.xcworkspace` を開く
2. 上部メニュー: `Product` → `Scheme` → `Edit Scheme...`
3. 左の `Run` を選び、`Build Configuration` を **Release** に変更
4. iPhone 実機を選択して ▶ Run

この状態で入ったアプリは、**Metro を起動していなくても単体で起動します。**

#### 注意点（重要）

- Release ビルドは **ホットリロード / Debug with Chrome などの開発機能が使えません**（代わりに“単体で動く”ことを検証できます）。
- **インストール自体は初回は Mac が必要**です。Mac なしで配布・再インストールまで行いたい場合は TestFlight が必要になります（後述）。
- Apple ID の **Personal Team** で署名している場合、インストールしたアプリは **数日で期限切れ**になることがあります。継続運用するなら Apple Developer Program が推奨です。

#### Mac なしで「配布・再インストール」までしたい場合（TestFlight）

- App Store Connect にアップロードして **TestFlight 配布**にすると、iPhone 側だけでインストール・更新ができます。
- 必要なもの:
  - Apple Developer Program（有料）
  - `Product` → `Archive` → `Distribute App` → TestFlight の手順

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

3. （重要）`Bundle React Native code and images` が失敗する場合の対策

`Command PhaseScriptExecution failed ...` の原因が `Bundle React Native code and images` の場合、以下が多いです。

- **`node` が見つからない / Xcode から PATH が通っていない**
  - 対策: `ios/.xcode.env` で `NODE_BINARY` を明示（本リポジトリでは追加済み）
  - node の場所確認: `which node`

- **`Error: EMFILE: too many open files, watch`**
  - Xcode から `watchman` が見えず Metro が NodeWatcher にフォールバックしていることが多いです
  - 対策: `ios/.xcode.env.local` で PATH / NODE_BINARY / WATCHMAN_BINARY を明示（本リポジトリでは追加済み）
  - 変更後は Xcode を一度終了し、`BatsuGakuNative.xcworkspace` を開き直して再ビルド

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


