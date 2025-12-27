module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    // 既存コードのスタイルに合わせ、シングルクォートを許可する
    "quotes": ["error", "single", { "avoidEscape": true }],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    // Google 既定の「JSDoc 必須」は今回の段階では不要（デプロイ阻害になるため）
    "require-jsdoc": "off",
    // 長い URL やトークン交換コードで引っかかりやすいので一旦無効化
    "max-len": "off",
    // google の既定で quote-props が入り、TS の headers でエラーになりやすいので無効化
    "quote-props": "off",
    // TS では any を使うことがあるため、警告に留める（必要なら後で厳格化）
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
