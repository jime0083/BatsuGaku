/**
 * Metro 設定ファイル
 *
 * React Native 0.73+ では `@react-native/metro-config` のデフォルト設定を継承するのが推奨です。
 * 空設定のままだと asset 解決が壊れ、Xcode の bundling フェーズで失敗することがあります。
 */

const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/** @type {import('metro-config').ConfigT} */
module.exports = mergeConfig(defaultConfig, {});


