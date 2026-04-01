import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Mock data for ServiceFeePayment testing
export const mockUser = {
  id: 1,
  username: 'johndoe',
  full_name: 'John Doe',
  tower: 'Tower A',
  unit: 'A-101',
  photo: 'user-photo.jpg',
  has_service_fee_access: true,
};

export const mockUnits = [
  {
    id: 'SF-1-6368-202510',
    unit_id: 6368,
    service_fee_id: 1,
    tower_name: 'Tower A',
    unit_name: 'A-101',
    service_period_month: 10,
    service_period_year: 2025,
    due_amount: '5000',
    fee_amount: '5000',
    original_amount: '5000',
    service_status: 'due',
    due_date: '2025-10-05',
  },
  {
    id: 'SF-1-6368-202509',
    unit_id: 6368,
    service_fee_id: 1,
    tower_name: 'Tower A',
    unit_name: 'A-101',
    service_period_month: 9,
    service_period_year: 2025,
    due_amount: '5000',
    fee_amount: '5000',
    original_amount: '5000',
    service_status: 'overdue',
    due_date: '2025-09-05',
  },
  {
    id: 'SF-1-6369-202510',
    unit_id: 6369,
    service_fee_id: 1,
    tower_name: 'Tower B',
    unit_name: 'B-201',
    service_period_month: 10,
    service_period_year: 2025,
    due_amount: '0',
    fee_amount: '4500',
    original_amount: '4500',
    service_status: 'paid',
    due_date: '2025-10-05',
  },
];

export const mockPartialPaymentUnit = {
  id: 'SF-1-6368-202510',
  unit_id: 6368,
  service_fee_id: 1,
  tower_name: 'Tower A',
  unit_name: 'A-101',
  service_period_month: 10,
  service_period_year: 2025,
  due_amount: '2500',
  fee_amount: '5000',
  original_amount: '5000',
  service_status: 'partial',
  due_date: '2025-10-05',
};

export const mockPayments = [
  {
    id: 1,
    receipt_id: 'RCP-000001',
    transaction_id: 'TXN-20251001-001',
    amount: '5000',
    payment_method: 'bkash',
    payment_date: '2025-10-01T10:30:00Z',
    service_period_display: 'October 2025',
    payment_status: 'completed',
    service_status_display: 'Paid',
    payment_result_display: 'Paid',
    is_overdue: false,
    is_fully_paid: true,
    service_fee_amount: '5000',
    unit_id: 6368,
    tower_name: 'Tower A',
    unit_name: 'A-101',
  },
  {
    id: 2,
    receipt_id: 'RCP-000002',
    transaction_id: 'TXN-20250901-002',
    amount: '5000',
    payment_method: 'nagad',
    payment_date: '2025-09-01T14:15:00Z',
    service_period_display: 'September 2025',
    payment_status: 'completed',
    service_status_display: 'Paid',
    payment_result_display: 'Paid',
    is_overdue: false,
    is_fully_paid: true,
    service_fee_amount: '5000',
    unit_id: 6368,
    tower_name: 'Tower A',
    unit_name: 'A-101',
  },
  {
    id: 3,
    receipt_id: 'RCP-000003',
    transaction_id: 'TXN-20250801-003',
    amount: '2500',
    payment_method: 'rocket',
    payment_date: '2025-08-01T09:00:00Z',
    service_period_display: 'August 2025',
    payment_status: 'completed',
    service_status_display: 'Partial',
    payment_result_display: 'Partial Payment',
    is_overdue: false,
    is_fully_paid: false,
    service_fee_amount: '5000',
    unit_id: 6368,
    tower_name: 'Tower A',
    unit_name: 'A-101',
  },
];

export const mockPaymentMethods = [
  {
    id: 1,
    name: 'bkash',
    display_name: 'bKash',
    logo: 'bkash-logo.png',
    is_active: true,
  },
  {
    id: 2,
    name: 'nagad',
    display_name: 'Nagad',
    logo: 'nagad-logo.png',
    is_active: true,
  },
  {
    id: 3,
    name: 'rocket',
    display_name: 'Rocket',
    logo: 'rocket-logo.png',
    is_active: true,
  },
];

// Mock store creator
export const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { 
        user: mockUser, 
        isAuthenticated: true, 
        accessToken: 'mock-token-123',
        isLoading: false 
      }, action) => state,
      serviceFee: (state = { 
        units: mockUnits,
        selectedUnit: mockUnits[0],
        hasAccess: true,
        accessChecked: true,
        isLoadingUnits: false,
        isLoading: false,
        error: null,
        payments: mockPayments,
        isLoadingPayments: false,
        paymentsError: null,
      }, action) => state,
    },
    preloadedState: initialState,
  });
};

// Test wrapper component
interface TestWrapperProps {
  children: React.ReactNode;
  store?: any;
}

export const TestWrapper: React.FC<TestWrapperProps> = ({ children, store }) => (
  <Provider store={store || createMockStore()}>
    <NavigationContainer>
      {children}
    </NavigationContainer>
  </Provider>
);

// Custom render function
export const renderWithProviders = (
  ui: React.ReactElement,
  {
    store = createMockStore(),
    ...renderOptions
  }: RenderOptions & { store?: any } = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestWrapper store={store}>{children}</TestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock navigation
export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();
export const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(() => 'test-id'),
  getParent: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

// Mock route
export const mockRoute = {
  params: {
    unit: mockUnits[0],
    amount: '5000.00',
    selectedPayments: new Set(['SF-1-6368-202510']),
  },
  key: 'test-route-key',
  name: 'ServiceFeePayment',
};

// Test scenarios
export const testScenarios = {
  loading: {
    serviceFee: { isLoadingUnits: true, units: [], hasAccess: true, accessChecked: false },
    auth: { isLoading: true },
  },
  error: {
    serviceFee: { error: 'Failed to load service fees', units: [] },
    auth: { error: 'Authentication failed' },
  },
  empty: {
    serviceFee: { units: [], hasAccess: true, accessChecked: true },
    auth: { user: null, isAuthenticated: false },
  },
  success: {
    serviceFee: { units: mockUnits, selectedUnit: mockUnits[0], hasAccess: true, accessChecked: true },
    auth: { user: mockUser, isAuthenticated: true, accessToken: 'token-123' },
  },
  noAccess: {
    serviceFee: { units: [], hasAccess: false, accessChecked: true },
    auth: { user: { ...mockUser, has_service_fee_access: false }, isAuthenticated: true },
  },
  allPaid: {
    serviceFee: { 
      units: [{ ...mockUnits[2], unit_id: 6368 }], 
      selectedUnit: { ...mockUnits[2], unit_id: 6368 },
      hasAccess: true,
      accessChecked: true
    },
    auth: { user: mockUser, isAuthenticated: true },
  },
};

// Helper functions
export const testHelpers = {
  // Calculate total due amount
  calculateTotalDue: (units: any[]) => {
    return units.reduce((total, unit) => total + parseFloat(unit.due_amount || '0'), 0);
  },

  // Format currency
  formatCurrency: (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `Tk ${numAmount.toFixed(2)}`;
  },

  // Calculate partial payment percentage
  calculatePercentage: (paidAmount: number, totalAmount: number) => {
    return Math.round((paidAmount / totalAmount) * 100);
  },

  // Format service period
  formatServicePeriod: (month: number, year: number) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[month - 1]} ${year}`;
  },

  // Calculate days overdue
  calculateDaysOverdue: (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  },

  // Get unique units
  getUniqueUnits: (units: any[]) => {
    const uniqueMap = new Map();
    units.forEach(unit => {
      if (!uniqueMap.has(unit.unit_id)) {
        uniqueMap.set(unit.unit_id, unit);
      }
    });
    return Array.from(uniqueMap.values());
  },

  // Filter by status
  filterByStatus: (units: any[], status: string) => {
    return units.filter(u => u.service_status === status);
  },

  // Get earliest due date
  getEarliestDueDate: (units: any[]) => {
    const unpaid = units.filter(u => u.service_status !== 'paid');
    if (unpaid.length === 0) return null;
    
    return unpaid.reduce((earliest, unit) => {
      const unitDate = new Date(unit.due_date);
      const earliestDate = new Date(earliest.due_date);
      return unitDate < earliestDate ? unit : earliest;
    }).due_date;
  },
};

// Mock data generators
export const generateMockUnits = (count: number, scenario: 'due' | 'overdue' | 'paid' | 'mixed' = 'mixed') => {
  return Array.from({ length: count }, (_, index) => {
    let status = 'due';
    let dueAmount = '5000';
    
    if (scenario === 'mixed') {
      status = index % 3 === 0 ? 'paid' : index % 3 === 1 ? 'overdue' : 'due';
      dueAmount = status === 'paid' ? '0' : '5000';
    } else {
      status = scenario;
      dueAmount = scenario === 'paid' ? '0' : '5000';
    }

    const month = 10 - index;
    const year = month > 0 ? 2025 : 2024;
    const actualMonth = month > 0 ? month : month + 12;

    return {
      id: `SF-1-6368-${year}${actualMonth.toString().padStart(2, '0')}`,
      unit_id: 6368,
      service_fee_id: 1,
      tower_name: 'Tower A',
      unit_name: 'A-101',
      service_period_month: actualMonth,
      service_period_year: year,
      due_amount: dueAmount,
      fee_amount: '5000',
      original_amount: '5000',
      service_status: status,
      due_date: `${year}-${actualMonth.toString().padStart(2, '0')}-05`,
    };
  });
};

export const generateMockPayments = (count: number, status: string = 'completed') => {
  return Array.from({ length: count }, (_, index) => {
    const month = 10 - index;
    const year = 2025;
    const date = new Date(year, month - 1, 1);

    return {
      id: index + 1,
      receipt_id: `RCP-${String(index + 1).padStart(6, '0')}`,
      transaction_id: `TXN-${year}${month.toString().padStart(2, '0')}01-${String(index + 1).padStart(3, '0')}`,
      amount: '5000',
      payment_method: ['bkash', 'nagad', 'rocket'][index % 3],
      payment_date: date.toISOString(),
      service_period_display: testHelpers.formatServicePeriod(month, year),
      payment_status: status,
      service_status_display: status === 'completed' ? 'Paid' : 'Pending',
      payment_result_display: status === 'completed' ? 'Paid' : 'Pending',
      is_overdue: false,
      is_fully_paid: status === 'completed',
      service_fee_amount: '5000',
      unit_id: 6368,
      tower_name: 'Tower A',
      unit_name: 'A-101',
    };
  });
};

// Assertion helpers
export const assertions = {
  // Verify navigation was called correctly
  expectNavigation: (mockNavigate: jest.Mock, route: string, params?: any) => {
    if (params) {
      expect(mockNavigate).toHaveBeenCalledWith(route, params);
    } else {
      expect(mockNavigate).toHaveBeenCalledWith(route);
    }
  },

  // Verify payment card details
  expectPaymentCard: (getByText: any, payment: { period: string; amount: string; status?: string }) => {
    expect(getByText(payment.period)).toBeTruthy();
    expect(getByText(new RegExp(payment.amount))).toBeTruthy();
    if (payment.status) {
      expect(getByText(payment.status)).toBeTruthy();
    }
  },

  // Verify total amount display
  expectTotalAmount: (getByText: any, amount: string) => {
    expect(getByText(new RegExp(amount))).toBeTruthy();
  },

  // Verify unit selector display
  expectUnitSelector: (getByText: any, towerName: string, unitName: string) => {
    expect(getByText(`${towerName}, ${unitName}`)).toBeTruthy();
  },

  // Verify status badge
  expectStatusBadge: (getByText: any, status: string) => {
    expect(getByText(status)).toBeTruthy();
  },

  // Verify error message
  expectErrorMessage: (getByText: any, message: string) => {
    expect(getByText(new RegExp(message, 'i'))).toBeTruthy();
  },
};

// Mock timers
export const mockTimers = {
  setup: () => {
    jest.useFakeTimers();
  },
  
  teardown: () => {
    jest.useRealTimers();
  },
  
  advanceBy: (ms: number) => {
    jest.advanceTimersByTime(ms);
  },
  
  runAll: () => {
    jest.runAllTimers();
  },
};

// Import fireEvent for use in helpers
import { fireEvent } from '@testing-library/react-native';

export { fireEvent };

