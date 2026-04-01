/**
 * Payment Utilities for Service Fee Payment System
 * 
 * This module provides utilities for handling payment data, validation,
 * and ID management in the service fee payment system.
 */

export interface PaymentMonth {
  month: number;
  year: number;
  amount: number;
}

export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PaymentData {
  unitId: number;
  serviceFeeId: number;
  amount: number;
  selectedPayments: PaymentMonth[];
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
}

/**
 * Parse payment ID to extract unit and period information
 * Supports multiple ID formats:
 * - Direct unit_id (number)
 * - Composite ID (SF-{service_fee_id}-{unit_id}-{YYYYMM})
 * - String representation of unit_id
 */
export function parsePaymentId(paymentId: string | number): {
  unitId: number | null;
  serviceFeeId: number | null;
  month: number | null;
  year: number | null;
  isValid: boolean;
} {
  try {
    // Handle direct number ID
    if (typeof paymentId === 'number' || !isNaN(Number(paymentId))) {
      return {
        unitId: Number(paymentId),
        serviceFeeId: null,
        month: null,
        year: null,
        isValid: true
      };
    }

    const paymentIdStr = String(paymentId);
    
    // Check if it's a composite ID format (e.g., "SF-123-6377-202601")
    if (paymentIdStr.startsWith('SF-')) {
      const parts = paymentIdStr.split('-');
      if (parts.length === 4) {
        const serviceFeeId = parseInt(parts[1]);
        const unitId = parseInt(parts[2]);
        const yearMonthPart = parts[3]; // "202601"
        
        if (yearMonthPart.length === 6) {
          const year = parseInt(yearMonthPart.substring(0, 4)); // "2026"
          const month = parseInt(yearMonthPart.substring(4, 6)); // "01"
          
          return {
            unitId,
            serviceFeeId,
            month,
            year,
            isValid: true
          };
        }
      }
    }

    return {
      unitId: null,
      serviceFeeId: null,
      month: null,
      year: null,
      isValid: false
    };
  } catch (error) {
    console.error('Error parsing payment ID:', error);
    return {
      unitId: null,
      serviceFeeId: null,
      month: null,
      year: null,
      isValid: false
    };
  }
}

/**
 * Find payment data by ID using multiple strategies
 */
export function findPaymentDataById(
  paymentId: string | number,
  units: any[]
): any | null {
  const parsedId = parsePaymentId(paymentId);
  
  if (!parsedId.isValid) {
    return null;
  }

  // Strategy 1: Direct ID match (most reliable)
  let selectedPayment = units.find(u => u.id === paymentId);
  
  if (selectedPayment) {
    return selectedPayment;
  }

  // Strategy 2: Match by unit_id
  if (parsedId.unitId) {
    selectedPayment = units.find(u => u.unit_id === parsedId.unitId);
    if (selectedPayment) {
      return selectedPayment;
    }
  }

  // Strategy 3: Match by composite ID components
  if (parsedId.unitId && parsedId.month && parsedId.year) {
    selectedPayment = units.find(u => 
      u.unit_id === parsedId.unitId && 
      u.service_period_month === parsedId.month && 
      u.service_period_year === parsedId.year
    );
    if (selectedPayment) {
      return selectedPayment;
    }
  }

  return null;
}

/**
 * Process selected payments and extract payment months
 */
export function processSelectedPayments(
  selectedPayments: Set<string | number>,
  units: any[]
): PaymentMonth[] {
  const paymentMonths: PaymentMonth[] = [];
  
  selectedPayments.forEach(paymentId => {
    const paymentData = findPaymentDataById(paymentId, units);
    
    if (paymentData && paymentData.service_period_month && paymentData.service_period_year) {
      const dueAmount = parseFloat(paymentData.due_amount || '0');
      paymentMonths.push({
        month: paymentData.service_period_month,
        year: paymentData.service_period_year,
        amount: dueAmount
      });
    }
  });

  // Sort by date (oldest first) - CRITICAL for partial payment distribution
  paymentMonths.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return paymentMonths;
}

/**
 * Validate payment data before processing
 */
export function validatePaymentData(paymentData: Partial<PaymentData>): PaymentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!paymentData.unitId) {
    errors.push('Unit ID is required');
  }

  if (!paymentData.serviceFeeId) {
    errors.push('Service fee ID is required');
  }

  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }

  // Allow advance payments: Don't require selected payments if user wants to make an advance payment
  // The backend will create an advance payment record when no months are selected
  // Only show this as a warning, not an error
  if (!paymentData.selectedPayments || paymentData.selectedPayments.length === 0) {
    warnings.push('No payment months selected - this will be treated as an advance payment');
  }

  // Customer info validation
  if (!paymentData.customerInfo?.name) {
    warnings.push('Customer name is missing - using default');
  }

  if (!paymentData.customerInfo?.email) {
    warnings.push('Customer email is missing - using default');
  }

  if (!paymentData.customerInfo?.phone) {
    warnings.push('Customer phone is missing - using default');
  }

  // Amount validation - ALLOW ANY POSITIVE AMOUNT
  // The backend will handle distribution across bills and create advance if needed
  // No need to validate "exceeds" here - customer can pay any amount (advance payment)

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate payment summary for display
 */
export function generatePaymentSummary(
  selectedPayments: PaymentMonth[],
  totalAmount: number
): {
  totalMonths: number;
  totalAmount: number;
  oldestMonth: string;
  newestMonth: string;
  summary: string;
} {
  if (selectedPayments.length === 0) {
    return {
      totalMonths: 0,
      totalAmount: 0,
      oldestMonth: 'N/A',
      newestMonth: 'N/A',
      summary: 'No payments selected'
    };
  }

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const oldest = selectedPayments[0];
  const newest = selectedPayments[selectedPayments.length - 1];
  
  const oldestMonth = `${monthNames[oldest.month - 1]} ${oldest.year}`;
  const newestMonth = `${monthNames[newest.month - 1]} ${newest.year}`;
  
  let summary = `${selectedPayments.length} month${selectedPayments.length > 1 ? 's' : ''}`;
  if (selectedPayments.length > 1) {
    summary += ` (${oldestMonth} - ${newestMonth})`;
  } else {
    summary += ` (${oldestMonth})`;
  }
  summary += ` - Tk ${totalAmount.toFixed(2)}`;

  return {
    totalMonths: selectedPayments.length,
    totalAmount,
    oldestMonth,
    newestMonth,
    summary
  };
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `Tk ${numAmount.toFixed(2)}`;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN-${timestamp}-${random}`.toUpperCase();
}

/**
 * Sanitize customer data for payment processing
 */
export function sanitizeCustomerData(customerInfo: any): {
  name: string;
  email: string;
  phone: string;
  address: string;
} {
  return {
    name: (customerInfo?.name || 'Customer').trim().substring(0, 100),
    email: (customerInfo?.email || 'customer@example.com').trim().toLowerCase(),
    phone: (customerInfo?.phone || '01700000000').replace(/\D/g, '').substring(0, 15),
    address: (customerInfo?.address || 'Dhaka, Bangladesh').trim().substring(0, 200)
  };
}
