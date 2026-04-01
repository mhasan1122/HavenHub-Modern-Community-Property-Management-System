/**
 * Additional Test Helpers for ServiceFeePayment Tests
 * 
 * Common patterns and utilities for testing ServiceFeePayment components
 */

import { fireEvent, waitFor } from '@testing-library/react-native';

/**
 * Helper to simulate pull-to-refresh
 */
export const triggerPullToRefresh = async (scrollView: any) => {
  const refreshControl = scrollView.props.refreshControl;
  await refreshControl.props.onRefresh();
};

/**
 * Helper to simulate navigation
 */
export const simulateNavigation = (tabBar: any, tabName: string) => {
  tabBar.props.onTabPress(tabName);
};

/**
 * Helper to find WebView and simulate navigation
 */
export const simulateWebViewNavigation = (webView: any, url: string) => {
  webView.props.onNavigationStateChange({
    url,
    canGoBack: false,
  });
};

/**
 * Helper to simulate form input
 */
export const fillInput = (input: any, value: string) => {
  fireEvent.changeText(input, value);
};

/**
 * Helper to simulate button press and wait for navigation
 */
export const pressButtonAndWaitForNavigation = async (
  button: any,
  mockNavigate: jest.Mock
) => {
  fireEvent.press(button);
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalled();
  });
};

/**
 * Helper to simulate async data loading
 */
export const simulateDataLoad = async (mockLoadFunction: jest.Mock, data: any) => {
  mockLoadFunction.mockResolvedValue(data);
  await waitFor(() => {
    expect(mockLoadFunction).toHaveBeenCalled();
  });
};

/**
 * Helper to verify modal visibility
 */
export const verifyModalVisible = (modal: any, shouldBeVisible: boolean) => {
  expect(modal.props.visible).toBe(shouldBeVisible);
};

/**
 * Helper to get payment status badge color
 */
export const getStatusBadgeColor = (status: string) => {
  const colorMap: Record<string, string> = {
    paid: '#D1FAE5',
    partial: '#FEF3C7',
    overdue: '#FEE2E2',
    due: '#DBEAFE',
    failed: '#FEE2E2',
    refunded: '#EDE9FE',
  };
  return colorMap[status.toLowerCase()] || '#F3F4F6';
};

/**
 * Helper to format date for testing
 */
export const formatTestDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Helper to calculate days between dates
 */
export const daysBetween = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Helper to create date range for testing
 */
export const createDateRange = (monthsAgo: number) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsAgo);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

/**
 * Helper to verify SSLCommerz payment request
 */
export const verifySSLCommerzRequest = (fetchMock: jest.Mock, expectedData: any) => {
  const callArgs = fetchMock.mock.calls[0];
  const requestBody = JSON.parse(callArgs[1].body);
  
  expect(requestBody).toMatchObject(expectedData);
  expect(callArgs[0]).toContain('/api/service-fee-management/payments/sslcommerz/init/');
};

/**
 * Helper to mock successful SSLCommerz response
 */
export const mockSSLCommerzSuccess = () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: async () => ({
        success: true,
        gateway_url: 'https://sandbox.sslcommerz.com/gateway?token=test',
        transaction_id: 'TXN' + Date.now(),
      }),
    } as Response)
  );
};

/**
 * Helper to mock SSLCommerz failure
 */
export const mockSSLCommerzFailure = (message: string) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: async () => ({
        success: false,
        message,
      }),
    } as Response)
  );
};

/**
 * Helper to verify PDF generation
 */
export const verifyPDFGeneration = async (
  printToFileAsync: jest.Mock,
  expectedContent: Record<string, any>
) => {
  await waitFor(() => {
    expect(printToFileAsync).toHaveBeenCalled();
  });
  
  const htmlContent = printToFileAsync.mock.calls[0][0].html;
  
  Object.entries(expectedContent).forEach(([key, value]) => {
    expect(htmlContent).toContain(value);
  });
};

/**
 * Helper to calculate partial payment percentage
 */
export const calculatePartialPercentage = (paidAmount: number, totalAmount: number) => {
  return Math.round((paidAmount / totalAmount) * 100);
};

/**
 * Helper to verify payment card details
 */
export const verifyPaymentCard = (
  getByText: any,
  payment: {
    period: string;
    amount: string;
    status?: string;
  }
) => {
  expect(getByText(payment.period)).toBeTruthy();
  expect(getByText(new RegExp(payment.amount))).toBeTruthy();
  if (payment.status) {
    expect(getByText(payment.status.toUpperCase())).toBeTruthy();
  }
};

/**
 * Helper to simulate payment selection
 */
export const selectPayments = async (
  getAllByText: any,
  count: number
) => {
  const selectButtons = getAllByText('Selected');
  
  for (let i = 0; i < Math.min(count, selectButtons.length); i++) {
    fireEvent.press(selectButtons[i]);
  }
  
  await waitFor(() => {
    expect(selectButtons.length).toBeGreaterThan(0);
  });
};

/**
 * Helper to verify date filter application
 */
export const verifyDateFilter = async (
  mockLoadPayments: jest.Mock,
  expectedParams: {
    start_date?: string;
    end_date?: string;
  }
) => {
  await waitFor(() => {
    expect(mockLoadPayments).toHaveBeenCalled();
  });
  
  const lastCall = mockLoadPayments.mock.calls[mockLoadPayments.mock.calls.length - 1][0];
  
  if (expectedParams.start_date) {
    expect(lastCall.start_date).toBe(expectedParams.start_date);
  }
  if (expectedParams.end_date) {
    expect(lastCall.end_date).toBe(expectedParams.end_date);
  }
};

/**
 * Helper to mock payment history data
 */
export const mockPaymentHistoryData = (count: number, status: string = 'completed') => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    receipt_id: `RCP-${String(i + 1).padStart(3, '0')}`,
    transaction_id: `TXN-${String(i + 1).padStart(3, '0')}`,
    amount: '5000',
    payment_method: 'bkash',
    payment_date: new Date(2025, 9 - i, 5).toISOString(),
    service_period_display: `${new Date(2025, 9 - i).toLocaleString('en-US', { month: 'long' })} 2025`,
    payment_status: status,
    service_status_display: status === 'completed' ? 'Paid' : 'Pending',
    payment_result_display: status === 'completed' ? 'Paid' : 'Pending',
    is_overdue: false,
    is_fully_paid: status === 'completed',
    service_fee_amount: '5000',
    unit_id: 6368,
  }));
};

/**
 * Helper to verify error alert
 */
export const verifyErrorAlert = (
  alertSpy: jest.SpyInstance,
  expectedTitle: string,
  expectedMessage?: string
) => {
  expect(alertSpy).toHaveBeenCalledWith(
    expectedTitle,
    expectedMessage ? expect.stringContaining(expectedMessage) : expect.any(String),
    expect.any(Array)
  );
};

/**
 * Helper to simulate time passing
 */
export const advanceTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
};

/**
 * Helper to reset all test mocks
 */
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
};

/**
 * Helper to create mock units for different scenarios
 */
export const createMockUnitsScenario = (scenario: 'all-paid' | 'all-overdue' | 'mixed') => {
  const baseUnit = {
    id: 'SF-1-6368-',
    unit_id: 6368,
    service_fee_id: 1,
    tower_name: 'Tower A',
    unit_name: 'A-101',
    fee_amount: '5000',
  };

  switch (scenario) {
    case 'all-paid':
      return [
        { ...baseUnit, id: baseUnit.id + '202510', service_period_month: 10, service_period_year: 2025, due_amount: '0', service_status: 'paid', due_date: '2025-10-05' },
        { ...baseUnit, id: baseUnit.id + '202509', service_period_month: 9, service_period_year: 2025, due_amount: '0', service_status: 'paid', due_date: '2025-09-05' },
      ];
    
    case 'all-overdue':
      return [
        { ...baseUnit, id: baseUnit.id + '202510', service_period_month: 10, service_period_year: 2025, due_amount: '5000', service_status: 'overdue', due_date: '2025-10-05' },
        { ...baseUnit, id: baseUnit.id + '202509', service_period_month: 9, service_period_year: 2025, due_amount: '5000', service_status: 'overdue', due_date: '2025-09-05' },
      ];
    
    case 'mixed':
    default:
      return [
        { ...baseUnit, id: baseUnit.id + '202510', service_period_month: 10, service_period_year: 2025, due_amount: '5000', service_status: 'due', due_date: '2025-10-05' },
        { ...baseUnit, id: baseUnit.id + '202509', service_period_month: 9, service_period_year: 2025, due_amount: '2500', service_status: 'partial', due_date: '2025-09-05' },
        { ...baseUnit, id: baseUnit.id + '202508', service_period_month: 8, service_period_year: 2025, due_amount: '0', service_status: 'paid', due_date: '2025-08-05' },
      ];
  }
};

/**
 * Export all helpers
 */
export default {
  triggerPullToRefresh,
  simulateNavigation,
  simulateWebViewNavigation,
  fillInput,
  pressButtonAndWaitForNavigation,
  simulateDataLoad,
  verifyModalVisible,
  getStatusBadgeColor,
  formatTestDate,
  daysBetween,
  createDateRange,
  verifySSLCommerzRequest,
  mockSSLCommerzSuccess,
  mockSSLCommerzFailure,
  verifyPDFGeneration,
  calculatePartialPercentage,
  verifyPaymentCard,
  selectPayments,
  verifyDateFilter,
  mockPaymentHistoryData,
  verifyErrorAlert,
  advanceTime,
  resetAllMocks,
  createMockUnitsScenario,
};

