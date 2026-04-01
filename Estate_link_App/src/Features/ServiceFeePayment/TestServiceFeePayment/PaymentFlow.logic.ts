/**
 * Payment Flow Logic Implementation
 */

import { validateAmount } from './ServiceFeePayment.pure';

interface PaymentState {
  step: 'selection' | 'confirmation' | 'processing' | 'complete';
  selectedUnit?: number;
  selectedPayments: Set<string>;
  paymentMethod?: string;
  errors: string[];
  isProcessing: boolean;
  result?: any;
}

class PaymentFlow {
  state: PaymentState;

  constructor() {
    this.state = {
      step: 'selection',
      selectedPayments: new Set(),
      errors: [],
      isProcessing: false
    };
  }

  reset() {
    this.state = {
      step: 'selection',
      selectedPayments: new Set(),
      errors: [],
      isProcessing: false
    };
  }

  selectUnit(unitId: number) {
    this.state.selectedUnit = unitId;
    this.state.selectedPayments.clear();
    this.state.errors = [];
  }

  togglePayment(paymentId: string) {
    if (this.state.selectedPayments.has(paymentId)) {
      this.state.selectedPayments.delete(paymentId);
    } else {
      this.state.selectedPayments.add(paymentId);
    }
    this.state.errors = [];
  }

  validateSelectionStep(): boolean {
    this.state.errors = [];
    
    if (!this.state.selectedUnit) {
      this.state.errors.push('Unit selection is required');
    }
    
    // Allow advance payments: Don't require selected payments
    // If no payments selected and amount > 0, it will be treated as advance payment
    // Removed validation: if (this.state.selectedPayments.size === 0)

    return this.state.errors.length === 0;
  }

  proceedToConfirmation(): boolean {
    if (!this.validateSelectionStep()) {
      return false;
    }

    this.state.step = 'confirmation';
    return true;
  }

  setPaymentMethod(method: string) {
    if (!method) {
      this.state.errors.push('Payment method is required');
      return false;
    }

    this.state.paymentMethod = method;
    this.state.errors = [];
    return true;
  }

  validateConfirmationStep(): boolean {
    this.state.errors = [];

    if (!this.state.paymentMethod) {
      this.state.errors.push('Payment method is required');
    }

    // Allow advance payments: Don't require selected payments
    // If no payments selected and amount > 0, it will be treated as advance payment
    // Removed validation: if (this.state.selectedPayments.size === 0)

    if (!this.state.selectedUnit) {
      this.state.errors.push('Unit selection is required');
    }

    return this.state.errors.length === 0;
  }

  async confirmPayment(amount: string): Promise<boolean> {
    if (!this.validateConfirmationStep()) {
      return false;
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.isValid) {
      this.state.errors.push(amountValidation.error || 'Invalid amount');
      return false;
    }

    this.state.isProcessing = true;
    this.state.step = 'processing';

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.state.result = {
        success: true,
        transactionId: `TXN-${Date.now()}`,
        amount: amount,
        paymentMethod: this.state.paymentMethod,
      };
      
      this.state.step = 'complete';
      this.state.isProcessing = false;
      return true;
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Payment processing failed');
      this.state.isProcessing = false;
      return false;
    }
  }

  getCompletedState() {
    return {
      unit: this.state.selectedUnit,
      payments: Array.from(this.state.selectedPayments),
      paymentMethod: this.state.paymentMethod,
      result: this.state.result,
    };
  }
}

export default PaymentFlow;