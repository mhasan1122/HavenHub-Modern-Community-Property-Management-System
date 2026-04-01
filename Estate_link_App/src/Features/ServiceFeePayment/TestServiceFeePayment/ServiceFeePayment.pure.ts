/**
 * Pure logic functions for Service Fee Payment functionality
 */

export interface User {
  id: string;
  roles: string[];
  permissions: string[];
}

/**
 * Check if user has access to service fee functionality
 */
export const hasAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  const hasServiceFeeRole = user.roles.includes('service_fee_access');
  const hasServiceFeePermission = user.permissions.includes('service_fee.access');
  
  return hasServiceFeeRole || hasServiceFeePermission;
};

/**
 * Validate payment amount
 */
export const validateAmount = (amount: string | number): { isValid: boolean; error?: string } => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (!amount) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }
  
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }
  
  return { isValid: true };
};

/**
 * Generate transaction ID with timestamp to ensure uniqueness
 */
export const generateTransactionId = (): string => {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `TXN-${timestamp}-${random}`;
};

/**
 * Parse SSLCommerz callback URL
 */
export const parseCallbackUrl = (url: string) => {
  if (!url) return null;
  
  const lowerUrl = url.toLowerCase();
  
  // Handle relative and absolute URLs
  const path = lowerUrl.includes('://') ? new URL(url).pathname : url;
  
  if (path.includes('/sslcommerz/success')) {
    return {
      type: 'success',
      status: 'completed',
      message: 'Payment successful'
    };
  }
  
  if (path.includes('/sslcommerz/fail')) {
    return {
      type: 'failure',
      status: 'failed',
      message: 'Payment failed'
    };
  }
  
  if (path.includes('/sslcommerz/cancel')) {
    return {
      type: 'cancel',
      status: 'cancelled',
      message: 'Payment cancelled'
    };
  }
  
  return null;
};

/**
 * Validate transaction ID format
 */
export const validateTransactionId = (transactionId: string): boolean => {
  if (!transactionId) return false;
  return /^TXN-\d+-\d+$/.test(transactionId);
};