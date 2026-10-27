/* eslint-env jest */
// Native Firebase / config modules aren't available under Jest — stub the
// surface this app uses so component tests can render.
jest.mock('react-native-gesture-handler', () =>
  require('react-native-gesture-handler/jestSetup'),
);

jest.mock('@react-native-firebase/auth', () => {
  const instance = { currentUser: null };
  return {
    __esModule: true,
    getAuth: jest.fn(() => instance),
    onAuthStateChanged: jest.fn(() => jest.fn()),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signInWithCredential: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: { credential: jest.fn(() => ({})) },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled' })),
    signOut: jest.fn(async () => null),
  },
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

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { GOOGLE_WEB_CLIENT_ID: 'test-client-id' },
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { CacheDir: '/tmp', DocumentDir: '/tmp', PictureDir: '/tmp' },
      writeFile: jest.fn(async () => undefined),
      unlink: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: { save: jest.fn(async () => 'file:///tmp/test.jpg') },
}));
