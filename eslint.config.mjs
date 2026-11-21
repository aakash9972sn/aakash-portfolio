import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: [
      'node_modules/**',
      'assets/**',
      'tests/**',
      'server.js',
      '*.js',
      'workshops/**',
    ],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
