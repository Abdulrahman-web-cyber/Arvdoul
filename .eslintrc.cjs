module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "detect" } },
  extends: ["eslint:recommended", "plugin:react/recommended"],
  plugins: ["react"],
  rules: { "react/react-in-jsx-scope": "off", "no-console": "warn" }
};
