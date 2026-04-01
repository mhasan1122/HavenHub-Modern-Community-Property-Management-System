export const useNavigation = jest.fn(() => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
}));

export const useRoute = jest.fn(() => ({
  params: {
    gatewayUrl: 'https://sandbox.sslcommerz.com/gateway?token=test123',
    transactionId: 'TXN-123456',
    amount: '5000',
    unitName: 'A-101',
  },
}));

export const useFocusEffect = jest.fn();

