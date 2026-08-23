module.exports = {
  preset: '@react-native/jest-preset',
  // RN's default preset doesn't transform these ESM-only packages
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-.*|@react-navigation)/)',
  ],
  setupFiles: ['./jest.setup.js'],
};
