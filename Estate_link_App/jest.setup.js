// Jest setup file

// ============================================
// 🔧 Fix 1: Mock React Native Appearance API for NativeWind
// ============================================
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  removeChangeListener: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
}));

// Mock NativeWind specifically - completely disable it
jest.mock('nativewind', () => ({
  useColorScheme: () => 'light',
  styled: jest.fn((component) => component),
  __esModule: true,
  default: {
    useColorScheme: () => 'light',
    styled: jest.fn((component) => component),
  },
}));

// Mock all NativeWind related modules
jest.mock('nativewind/babel', () => ({
  __esModule: true,
  default: {},
}));

// Mock react-native-css-interop to prevent test failures
jest.mock('react-native-css-interop', () => {
  const mockComponent = (Component) => Component;
  const mockFn = jest.fn(() => ({ remove: jest.fn() }));
  return {
    __esModule: true,
    remapProps: mockComponent,
    cssInterop: mockComponent,
    addEventListener: mockFn,
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
    getColorScheme: jest.fn(() => 'light'),
    default: {
      remapProps: mockComponent,
      cssInterop: mockComponent,
      addEventListener: mockFn,
      removeEventListener: jest.fn(),
      resetAppearanceListeners: jest.fn(),
      getColorScheme: jest.fn(() => 'light'),
    },
  };
});

// Mock all CSS interop runtime modules
jest.mock('react-native-css-interop/src/runtime/native/appearance-observables', () => {
  const mockAppearance = {
    getColorScheme: jest.fn(() => 'light'),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
    addChangeListener: () => ({ remove: () => {} }),
    removeChangeListener: () => {},
  };
  
  return {
    __esModule: true,
    Appearance: mockAppearance,
    addEventListener: () => ({ remove: () => {} }),
    removeEventListener: () => {},
    resetAppearanceListeners: () => {},
    getColorScheme: () => 'light',
    setColorScheme: () => {},
    default: {
      Appearance: mockAppearance,
      addEventListener: () => ({ remove: () => {} }),
      removeEventListener: () => {},
      resetAppearanceListeners: () => {},
      getColorScheme: () => 'light',
      setColorScheme: () => {},
    },
  };
});


// ============================================
// 🔧 Fix 2: Mock react-native-css-interop (NativeWind) - Already handled in jest.setup.early.js
// ============================================
// CSS interop mocks are now handled in jest.setup.early.js to prevent conflicts

// NativeWind mock is handled in jest.setup.early.js

// Mock expo-device
jest.mock('expo-device', () => ({
  deviceType: 1, // TABLET
  brand: 'Apple',
  manufacturer: 'Apple Inc.',
  modelName: 'iPad',
  osVersion: '17.0',
  osBuildId: '21A329',
  osInternalBuildId: '21A329',
  deviceName: 'iPad',
  DeviceType: {
    PHONE: 0,
    TABLET: 1,
    DESKTOP: 2,
    TV: 3,
    UNKNOWN: 4,
  },
}));

// Mock expo modules
jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons/Entypo', () => ({
  __esModule: true,
  default: 'Icon',
}));

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: 'Icon',
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: 'Icon',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock React Native components with Appearance API
const mockAppearance = {
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  removeChangeListener: jest.fn(),
  setColorScheme: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};

jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Text: 'Text',
  View: 'View',
  Image: 'Image',
  StatusBar: 'StatusBar',
  RefreshControl: 'RefreshControl',
  TextInput: 'TextInput',
  Modal: 'Modal',
  Pressable: 'Pressable',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
    Version: 14,
  },
  Appearance: mockAppearance,
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
  },
  NativeModules: {
    RNVectorIconsManager: {},
    PlatformConstants: {
      forceTouchAvailable: false,
    },
    StatusBarManager: {
      HEIGHT: 20,
    },
    Appearance: mockAppearance,
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
  useRoute: () => ({
    params: {},
  }),
  NavigationContainer: ({ children }) => children,
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  }),
}));

// Mock Redux hooks
jest.mock('./src/store/hooks', () => ({
  useAppSelector: jest.fn(),
  useAppDispatch: jest.fn(),
}));

// Mock custom hooks
jest.mock('./src/hooks/useBulletinsRedux', () => ({
  useBulletinsRedux: jest.fn(),
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
    Videos: 'Videos',
    All: 'All',
  },
  ImagePickerResult: {},
}));

// Mock expo-media-library
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  createAssetAsync: jest.fn(() => Promise.resolve({ id: 'test-asset-id', uri: 'file://test.pdf' })),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
  getAlbumAsync: jest.fn(),
  createAlbumAsync: jest.fn(),
  addAssetsToAlbumAsync: jest.fn(),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(() => Promise.resolve()),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// Mock expo-file-system with proper exports
jest.mock('expo-file-system', () => ({
  __esModule: true,
  documentDirectory: 'file:///mock-document-directory/',
  cacheDirectory: 'file:///mock-cache-directory/',
  downloadAsync: jest.fn(() => Promise.resolve({ uri: 'file://test.pdf', status: 200, headers: {}, md5: '' })),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, isDirectory: false, size: 1024 })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  File: {},
  Directory: {},
  Paths: {},
  default: {
    documentDirectory: 'file:///mock-document-directory/',
    cacheDirectory: 'file:///mock-cache-directory/',
    downloadAsync: jest.fn(() => Promise.resolve({ uri: 'file://test.pdf', status: 200, headers: {}, md5: '' })),
    writeAsStringAsync: jest.fn(() => Promise.resolve()),
    readAsStringAsync: jest.fn(() => Promise.resolve('')),
    deleteAsync: jest.fn(() => Promise.resolve()),
    getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, isDirectory: false, size: 1024 })),
    makeDirectoryAsync: jest.fn(() => Promise.resolve()),
    File: {},
    Directory: {},
    Paths: {},
  },
}));

// Mock expo-print
jest.mock('expo-print', () => ({
  __esModule: true,
  printAsync: jest.fn(() => Promise.resolve()),
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: 'file://test.pdf' })),
  default: {
    printAsync: jest.fn(() => Promise.resolve()),
    printToFileAsync: jest.fn(() => Promise.resolve({ uri: 'file://test.pdf' })),
  },
}));

// Mock @react-native-community/datetimepicker
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
}));

// Mock react-native-image-viewing
jest.mock('react-native-image-viewing', () => ({
  ImageViewing: 'ImageViewing',
}));

// Mock react-native-modal
jest.mock('react-native-modal', () => 'Modal');

// Mock react-native-responsive-screen
jest.mock('react-native-responsive-screen', () => ({
  widthPercentageToDP: jest.fn((width) => width),
  heightPercentageToDP: jest.fn((height) => height),
  wp: jest.fn((width) => width),
  hp: jest.fn((height) => height),
}));

// Mock react-native-size-matters
jest.mock('react-native-size-matters', () => ({
  scale: jest.fn((size) => size),
  verticalScale: jest.fn((size) => size),
  moderateScale: jest.fn((size) => size),
}));


// Mock react-native-vector-icons
jest.mock('react-native-vector-icons', () => ({
  RNVectorIconsManager: {},
}));

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  EventEmitter: jest.fn(),
  NativeModule: jest.fn(),
  SharedObject: jest.fn(),
  SharedRef: jest.fn(),
}));

// Mock expo modules
jest.mock('expo', () => ({
  __esModule: true,
  default: {},
}));


// Global test setup
global.__DEV__ = true;
