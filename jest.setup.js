/* eslint-env jest */
// Native Firebase / config modules aren't available under Jest — stub the
// surface this app uses so component tests can render.
jest.mock('react-native-gesture-handler', () =>
  require('react-native-gesture-handler/jestSetup'),
);

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({ id: 'test-doc' })),
  addDoc: jest.fn(async () => ({ id: 'test-doc' })),
  updateDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  writeBatch: jest.fn(() => ({ delete: jest.fn(), commit: jest.fn(async () => undefined) })),
  query: jest.fn((...args) => args[0]),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: jest.fn(() => null),
  Timestamp: class Timestamp {},
}));

jest.mock('react-native-config', () => ({}));
