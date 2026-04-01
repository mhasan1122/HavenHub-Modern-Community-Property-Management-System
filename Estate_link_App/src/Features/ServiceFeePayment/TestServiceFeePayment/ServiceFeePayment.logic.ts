/**
 * Service Fee Payment Logic Implementation
 */

import { validateAmount } from './ServiceFeePayment.pure';

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

interface PaymentState {
  selectedUnit?: number;
  selectedPayments: Set<string>;
  paymentMethod?: string;
  amount?: string;
  isProcessing: boolean;
  errors: Record<string, string>;
}

class ServiceFeePayment {
  state: PaymentState;

  constructor() {
    this.state = {
      selectedPayments: new Set(),
      isProcessing: false,
      errors: {}
    };
  }

  selectUnit(unitId: number) {
    this.state.selectedUnit = unitId;
    this.state.selectedPayments.clear();
    this.clearErrors();
  }

  togglePayment(paymentId: string) {
    if (this.state.selectedPayments.has(paymentId)) {
      this.state.selectedPayments.delete(paymentId);
    } else {
      this.state.selectedPayments.add(paymentId);
    }
    this.clearErrors();
  }

  setPaymentMethod(method: string) {
    this.state.paymentMethod = method;
    this.clearErrors();
  }

  clearErrors() {
    this.state.errors = {};
  }

  validate(): ValidationResult {
    const errors: Record<string, string> = {};

    if (!this.state.selectedUnit) {
      errors.unit = 'Unit is required';
    }

    // Allow advance payments: Don't require selected payments
    // If no payments selected and amount > 0, it will be treated as advance payment
    // Removed validation: if (this.state.selectedPayments.size === 0)

    if (!this.state.paymentMethod) {
      errors.paymentMethod = 'Payment method is required';
    }

    if (!this.state.amount) {
      errors.amount = 'Amount must be greater than zero';
    } else {
      const amountValidation = validateAmount(this.state.amount);
      if (!amountValidation.isValid) {
        errors.amount = amountValidation.error || 'Invalid amount';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  async processPayment(): Promise<boolean> {
    const validation = this.validate();
    if (!validation.isValid) {
      this.state.errors = validation.errors;
      return false;
    }

    this.state.isProcessing = true;

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.state.isProcessing = false;
      return true;
    } catch (error) {
      this.state.isProcessing = false;
      this.state.errors.processing = error instanceof Error ? error.message : 'Payment processing failed';
      return false;
    }
  }

  getPaymentData() {
    return {
      unit_id: this.state.selectedUnit,
      selected_payments: Array.from(this.state.selectedPayments),
      payment_method: this.state.paymentMethod,
      amount: this.state.amount
    };
  }
}

export default ServiceFeePayment;