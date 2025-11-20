/**
 * React Native エントリーポイント
 * - Metro バンドラはデフォルトでこのファイルを読み込みます
 * - ブラウザ（Chrome）のデバッガ利用や iOS 実機テストでもここが起点になります
 */
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);


