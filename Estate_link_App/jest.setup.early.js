// This file runs BEFORE jest.setup.js to mock critical modules early

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Mock the Appearance module at the lowest level
global.Appearance = {
  getColorScheme: () => 'light',
  addChangeListener: () => ({ remove: () => {} }),
  removeChangeListener: () => {},
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

// Also set it on the global object for React Native
if (typeof global !== 'undefined') {
  global.Appearance = global.Appearance || {
    getColorScheme: () => 'light',
    addEventListener: () => ({ remove: () => {} }),
    removeEventListener: () => {},
  };
}

// Mock the specific modules that are causing issues at the global level
global.mockAppearance = {
  getColorScheme: () => 'light',
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
  addChangeListener: () => ({ remove: () => {} }),
  removeChangeListener: () => {},
};

// Completely disable NativeWind by mocking it at the module level
jest.mock('nativewind', () => ({
  __esModule: true,
  styled: (component) => component,
  useColorScheme: () => 'light',
  default: {
    styled: (component) => component,
    useColorScheme: () => 'light',
  },
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

// Mock CSS interop runtime modules with virtual: true to ensure they're mocked before loading
jest.doMock('react-native-css-interop/src/runtime/native/appearance-observables', () => {
  const mockFn = jest.fn(() => ({ remove: jest.fn() }));
  return {
    __esModule: true,
    Appearance: global.mockAppearance,
    addEventListener: mockFn,
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
    getColorScheme: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
    default: {
      Appearance: global.mockAppearance,
      addEventListener: mockFn,
      removeEventListener: jest.fn(),
      resetAppearanceListeners: jest.fn(),
      getColorScheme: jest.fn(() => 'light'),
      setColorScheme: jest.fn(),
    },
  };
}, { virtual: true });

// Mock all NativeWind related modules
jest.mock('nativewind/babel', () => ({
  __esModule: true,
  default: {},
}));

// Mock additional CSS interop runtime modules with virtual: true
jest.doMock('react-native-css-interop/src/runtime/native/api', () => {
  const mockFn = jest.fn(() => ({ remove: jest.fn() }));
  return {
    __esModule: true,
    Appearance: global.mockAppearance,
    addEventListener: mockFn,
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
    getColorScheme: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
    default: {
      Appearance: global.mockAppearance,
      addEventListener: mockFn,
      removeEventListener: jest.fn(),
      resetAppearanceListeners: jest.fn(),
      getColorScheme: jest.fn(() => 'light'),
      setColorScheme: jest.fn(),
    },
  };
}, { virtual: true });

jest.doMock('react-native-css-interop/src/runtime/api.native', () => ({
  __esModule: true,
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  resetAppearanceListeners: jest.fn(),
  getColorScheme: jest.fn(() => 'light'),
  setColorScheme: jest.fn(),
  default: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
    getColorScheme: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
  },
}), { virtual: true });

jest.doMock('react-native-css-interop/src/runtime/api', () => ({
  __esModule: true,
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  resetAppearanceListeners: jest.fn(),
  getColorScheme: jest.fn(() => 'light'),
  setColorScheme: jest.fn(),
  default: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
    getColorScheme: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
  },
}), { virtual: true });

jest.doMock('react-native-css-interop/src/runtime/wrap-jsx', () => ({
  __esModule: true,
  default: (Component) => Component,
}), { virtual: true });

jest.doMock('react-native-css-interop/src/runtime/jsx-runtime', () => ({
  __esModule: true,
  default: {},
}), { virtual: true });

// Mock FontAwesome5 icons that are causing issues
jest.mock('@expo/vector-icons/FontAwesome5', () => ({
  __esModule: true,
  default: ({ name, testID, ...props } ) => null 
}));