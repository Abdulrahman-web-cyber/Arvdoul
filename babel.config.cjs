// Maps `import.meta.env` (a Vite-only global) onto `process.env` for Jest.
// Without this, any module that reads an env var at import time throws
// "Cannot read properties of undefined" under babel-jest, so those modules
// cannot be loaded by a test at all.
const importMetaEnvPlugin = () => ({
  name: 'import-meta-env-to-process-env',
  visitor: {
    MemberExpression(path) {
      const { object, property } = path.node;
      if (
        object.type === 'MetaProperty' &&
        object.meta.name === 'import' &&
        object.property.name === 'meta' &&
        property.type === 'Identifier' &&
        property.name === 'env'
      ) {
        path.replaceWithSourceString('process.env');
      }
    },
  },
});

module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: [importMetaEnvPlugin],
};
