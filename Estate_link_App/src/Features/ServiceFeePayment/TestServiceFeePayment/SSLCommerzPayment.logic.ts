/**
 * SSLCommerz Payment Logic Implementation
 */

import { generateTransactionId, validateTransactionId } from './ServiceFeePayment.pure';

interface PaymentData {
  amount: string;
  unit_id: number;
  selected_payments: string[];
}

/**
 * Initialize SSLCommerz payment
 */
export const initializeSSLCommerzPayment = async (paymentData: PaymentData) => {
  // Validate input
  if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
    throw new Error('Invalid payment amount');
  }
  
  if (!paymentData.unit_id) {
    throw new Error('Unit ID is required');
  }
  
  // Allow advance payments: Don't require selected payments
  // If no payments selected, it will be treated as an advance payment
  // Removed validation: if (!paymentData.selected_payments || paymentData.selected_payments.length === 0)

  // Generate unique transaction ID with timestamp and random number
  const transactionId = generateTransactionId();

  // Simulate API call to SSLCommerz init endpoint
  return {
    success: true,
    transaction_id: transactionId,
    gateway_url: `https://sandbox.sslcommerz.com/gateway?token=test_${transactionId}`,
    message: 'Payment initialized successfully',
  };
};

/**
 * Parse SSLCommerz callback URL
 */
export const parseSSLCommerzCallback = (url: string) => {
  if (!url) return null;
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('/sslcommerz/success')) {
    return {
      type: 'success',
      status: 'completed',
      message: 'Payment successful',
    };
  } else if (lowerUrl.includes('/sslcommerz/fail')) {
    return {
      type: 'failure',
      status: 'failed',
      message: 'Payment failed',
    };
  } else if (lowerUrl.includes('/sslcommerz/cancel')) {
    return {
      type: 'cancel',
      status: 'cancelled',
      message: 'Payment cancelled',
    };
  }
  
  return null;
};

/**
 * Cancel SSLCommerz payment
 */
export const cancelSSLCommerzPayment = async (transactionId: string) => {
  if (!transactionId || !validateTransactionId(transactionId)) {
    throw new Error('Transaction ID is required');
  }
  
  // Simulate API call to cancel payment
  return {
    success: true,
    message: 'Payment cancelled successfully',
  };
};

/**
 * Validate SSLCommerz gateway URL
 */
export const validateGatewayUrl = (url: string): boolean => {
  if (!url) return false;
  
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol === 'https:' &&
      (parsedUrl.hostname === 'sandbox.sslcommerz.com' ||
       parsedUrl.hostname === 'securepay.sslcommerz.com')
    );
  } catch {
    return false;
  }
};