module.exports = {
  overrides: [
    {
      files: ["**/*.js","**/*.jsx","**/*.ts","**/*.tsx"],
      parser: "@babel/eslint-parser",
      parserOptions: { requireConfigFile: false, ecmaVersion: 2021, sourceType: "module", ecmaFeatures: { jsx: true } },
      env: { browser: true, node: true, es2021: true },
      plugins: ["react","jsx-a11y"],
      rules: {},
      settings: { react: { version: "detect" } }
    }
  ]
};
