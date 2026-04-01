// Test payment calculation logic without React Native components

// Payment calculation utilities
const PaymentCalculations = {
  // Calculate total due amount
  calculateTotalDue(units) {
    return units.reduce((total, unit) => {
      const amount = parseFloat(unit.due_amount || '0');
      return total + (isNaN(amount) ? 0 : amount);
    }, 0);
  },

  // Calculate partial payment percentage
  calculatePartialPercentage(paidAmount, totalAmount) {
    if (totalAmount === 0) return 0;
    return Math.round((paidAmount / totalAmount) * 100);
  },

  // Calculate remaining amount
  calculateRemaining(totalAmount, paidAmount) {
    return Math.max(0, totalAmount - paidAmount);
  },

  // Calculate days overdue
  calculateDaysOverdue(dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  },

  // Calculate late fee (2% per month)
  calculateLateFee(amount, monthsOverdue) {
    const rate = 0.02; // 2% per month
    return amount * rate * monthsOverdue;
  },

  // Calculate total with late fee
  calculateTotalWithLateFee(amount, dueDate) {
    const daysOverdue = this.calculateDaysOverdue(dueDate);
    if (daysOverdue <= 0) return amount;
    
    const monthsOverdue = Math.ceil(daysOverdue / 30);
    const lateFee = this.calculateLateFee(amount, monthsOverdue);
    return amount + lateFee;
  },

  // Format currency
  formatCurrency(amount, currency = 'Tk') {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currency} 0.00`;
    return `${currency} ${numAmount.toFixed(2)}`;
  },

  // Parse currency string
  parseCurrency(currencyString) {
    if (typeof currencyString !== 'string') return 0;
    const match = currencyString.match(/[\d,]+\.?\d*/);
    if (!match) return 0;
    const cleanedString = match[0].replace(/,/g, '');
    const parsed = parseFloat(cleanedString);
    return isNaN(parsed) ? 0 : parsed;
  },

  // Calculate discount amount
  calculateDiscount(amount, discountPercentage) {
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    return amount * (discountPercentage / 100);
  },

  // Calculate amount after discount
  calculateAmountAfterDiscount(amount, discountPercentage) {
    const discount = this.calculateDiscount(amount, discountPercentage);
    return amount - discount;
  },

  // Split payment among multiple periods
  splitPayment(totalAmount, periods) {
    if (periods <= 0) {
      throw new Error('Periods must be greater than zero');
    }
    const amountPerPeriod = totalAmount / periods;
    return Array(periods).fill(amountPerPeriod);
  },

  // Calculate monthly payment for installment
  calculateMonthlyInstallment(totalAmount, months, interestRate = 0) {
    if (months <= 0) {
      throw new Error('Months must be greater than zero');
    }
    if (interestRate === 0) {
      return totalAmount / months;
    }
    const monthlyRate = interestRate / 12 / 100;
    const numerator = monthlyRate * Math.pow(1 + monthlyRate, months);
    const denominator = Math.pow(1 + monthlyRate, months) - 1;
    return (totalAmount * numerator) / denominator;
  },

  // Calculate compound total from monthly payments
  calculateCompoundTotal(monthlyPayment, months, interestRate = 0) {
    if (interestRate === 0) {
      return monthlyPayment * months;
    }
    const monthlyRate = interestRate / 12 / 100;
    return monthlyPayment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  },

  // Group payments by status
  groupByStatus(units) {
    return units.reduce((groups, unit) => {
      const status = unit.service_status || 'unknown';
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(unit);
      return groups;
    }, {});
  },

  // Calculate statistics
  calculateStatistics(units) {
    const total = this.calculateTotalDue(units);
    const grouped = this.groupByStatus(units);
    
    return {
      totalDue: total,
      totalUnits: units.length,
      paidCount: (grouped.paid || []).length,
      overdueCount: (grouped.overdue || []).length,
      dueCount: (grouped.due || []).length,
      partialCount: (grouped.partial || []).length,
      averageDue: units.length > 0 ? total / units.length : 0,
    };
  },
};

describe('Payment Calculation Logic Tests', () => {
  describe('Total Due Calculation', () => {
    it('should calculate total due amount correctly', () => {
      const units = [
        { due_amount: '5000' },
        { due_amount: '5000' },
        { due_amount: '2500' },
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBe(12500);
    });

    it('should handle empty array', () => {
      const total = PaymentCalculations.calculateTotalDue([]);
      expect(total).toBe(0);
    });

    it('should handle missing due_amount', () => {
      const units = [
        { due_amount: '5000' },
        {},
        { due_amount: '2500' },
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBe(7500);
    });

    it('should handle invalid amounts', () => {
      const units = [
        { due_amount: '5000' },
        { due_amount: 'invalid' },
        { due_amount: '2500' },
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBe(7500);
    });

    it('should handle decimal amounts', () => {
      const units = [
        { due_amount: '5000.50' },
        { due_amount: '5000.75' },
        { due_amount: '2500.25' },
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBe(12501.5);
    });
  });

  describe('Partial Payment Calculation', () => {
    it('should calculate partial payment percentage correctly', () => {
      expect(PaymentCalculations.calculatePartialPercentage(2500, 5000)).toBe(50);
      expect(PaymentCalculations.calculatePartialPercentage(1000, 5000)).toBe(20);
      expect(PaymentCalculations.calculatePartialPercentage(4500, 5000)).toBe(90);
    });

    it('should handle zero total amount', () => {
      const percentage = PaymentCalculations.calculatePartialPercentage(1000, 0);
      expect(percentage).toBe(0);
    });

    it('should handle full payment', () => {
      const percentage = PaymentCalculations.calculatePartialPercentage(5000, 5000);
      expect(percentage).toBe(100);
    });

    it('should handle overpayment', () => {
      const percentage = PaymentCalculations.calculatePartialPercentage(6000, 5000);
      expect(percentage).toBe(120);
    });

    it('should round to nearest integer', () => {
      const percentage = PaymentCalculations.calculatePartialPercentage(3333, 10000);
      expect(percentage).toBe(33); // 33.33 rounded to 33
    });
  });

  describe('Remaining Amount Calculation', () => {
    it('should calculate remaining amount correctly', () => {
      expect(PaymentCalculations.calculateRemaining(5000, 2500)).toBe(2500);
      expect(PaymentCalculations.calculateRemaining(5000, 0)).toBe(5000);
      expect(PaymentCalculations.calculateRemaining(5000, 5000)).toBe(0);
    });

    it('should not return negative amounts', () => {
      expect(PaymentCalculations.calculateRemaining(5000, 6000)).toBe(0);
    });

    it('should handle decimal amounts', () => {
      expect(PaymentCalculations.calculateRemaining(5000.75, 2500.25)).toBe(2500.5);
    });
  });

  describe('Days Overdue Calculation', () => {
    it('should calculate days overdue correctly', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      const daysOverdue = PaymentCalculations.calculateDaysOverdue(pastDate.toISOString());
      expect(daysOverdue).toBeGreaterThanOrEqual(10);
    });

    it('should return zero for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      const daysOverdue = PaymentCalculations.calculateDaysOverdue(futureDate.toISOString());
      expect(daysOverdue).toBe(0);
    });

    it('should return zero for today', () => {
      const today = new Date().toISOString();
      const daysOverdue = PaymentCalculations.calculateDaysOverdue(today);
      expect(daysOverdue).toBeLessThanOrEqual(1); // May be 0 or 1 depending on timing
    });
  });

  describe('Late Fee Calculation', () => {
    it('should calculate late fee correctly', () => {
      const lateFee = PaymentCalculations.calculateLateFee(5000, 1);
      expect(lateFee).toBe(100); // 2% of 5000
    });

    it('should calculate late fee for multiple months', () => {
      const lateFee = PaymentCalculations.calculateLateFee(5000, 3);
      expect(lateFee).toBe(300); // 2% * 3 months * 5000
    });

    it('should return zero for zero months', () => {
      const lateFee = PaymentCalculations.calculateLateFee(5000, 0);
      expect(lateFee).toBe(0);
    });

    it('should calculate total with late fee', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 35); // ~1 month overdue
      
      const totalWithFee = PaymentCalculations.calculateTotalWithLateFee(5000, pastDate.toISOString());
      expect(totalWithFee).toBeGreaterThan(5000);
    });

    it('should not add late fee for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      const totalWithFee = PaymentCalculations.calculateTotalWithLateFee(5000, futureDate.toISOString());
      expect(totalWithFee).toBe(5000);
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      expect(PaymentCalculations.formatCurrency(5000)).toBe('Tk 5000.00');
      expect(PaymentCalculations.formatCurrency('5000')).toBe('Tk 5000.00');
      expect(PaymentCalculations.formatCurrency(5000.5)).toBe('Tk 5000.50');
    });

    it('should handle custom currency symbol', () => {
      expect(PaymentCalculations.formatCurrency(5000, '$')).toBe('$ 5000.00');
      expect(PaymentCalculations.formatCurrency(5000, '৳')).toBe('৳ 5000.00');
    });

    it('should handle invalid amounts', () => {
      expect(PaymentCalculations.formatCurrency('invalid')).toBe('Tk 0.00');
      expect(PaymentCalculations.formatCurrency(NaN)).toBe('Tk 0.00');
    });

    it('should handle zero', () => {
      expect(PaymentCalculations.formatCurrency(0)).toBe('Tk 0.00');
    });

    it('should handle negative amounts', () => {
      expect(PaymentCalculations.formatCurrency(-5000)).toBe('Tk -5000.00');
    });
  });

  describe('Currency Parsing', () => {
    it('should parse currency string correctly', () => {
      expect(PaymentCalculations.parseCurrency('Tk 5000.00')).toBe(5000);
      expect(PaymentCalculations.parseCurrency('$ 1,234.56')).toBe(1234.56);
      expect(PaymentCalculations.parseCurrency('5000')).toBe(5000);
    });

    it('should handle invalid strings', () => {
      expect(PaymentCalculations.parseCurrency('invalid')).toBe(0);
      expect(PaymentCalculations.parseCurrency('')).toBe(0);
    });

    it('should handle non-string input', () => {
      expect(PaymentCalculations.parseCurrency(5000)).toBe(0);
      expect(PaymentCalculations.parseCurrency(null)).toBe(0);
      expect(PaymentCalculations.parseCurrency(undefined)).toBe(0);
    });

    it('should handle comma separators', () => {
      expect(PaymentCalculations.parseCurrency('Tk 1,234,567.89')).toBe(1234567.89);
    });
  });

  describe('Discount Calculation', () => {
    it('should calculate discount correctly', () => {
      expect(PaymentCalculations.calculateDiscount(5000, 10)).toBe(500);
      expect(PaymentCalculations.calculateDiscount(5000, 20)).toBe(1000);
      expect(PaymentCalculations.calculateDiscount(5000, 0)).toBe(0);
    });

    it('should throw error for invalid percentage', () => {
      expect(() => PaymentCalculations.calculateDiscount(5000, -10)).toThrow();
      expect(() => PaymentCalculations.calculateDiscount(5000, 110)).toThrow();
    });

    it('should calculate amount after discount', () => {
      expect(PaymentCalculations.calculateAmountAfterDiscount(5000, 10)).toBe(4500);
      expect(PaymentCalculations.calculateAmountAfterDiscount(5000, 20)).toBe(4000);
      expect(PaymentCalculations.calculateAmountAfterDiscount(5000, 0)).toBe(5000);
    });

    it('should handle 100% discount', () => {
      expect(PaymentCalculations.calculateAmountAfterDiscount(5000, 100)).toBe(0);
    });
  });

  describe('Payment Splitting', () => {
    it('should split payment equally', () => {
      const splits = PaymentCalculations.splitPayment(15000, 3);
      expect(splits).toHaveLength(3);
      expect(splits[0]).toBe(5000);
      expect(splits[1]).toBe(5000);
      expect(splits[2]).toBe(5000);
    });

    it('should throw error for zero periods', () => {
      expect(() => PaymentCalculations.splitPayment(15000, 0)).toThrow();
    });

    it('should throw error for negative periods', () => {
      expect(() => PaymentCalculations.splitPayment(15000, -1)).toThrow();
    });

    it('should handle uneven splits', () => {
      const splits = PaymentCalculations.splitPayment(10000, 3);
      expect(splits).toHaveLength(3);
      const total = splits.reduce((sum, amount) => sum + amount, 0);
      expect(total).toBeCloseTo(10000, 2);
    });
  });

  describe('Installment Calculation', () => {
    it('should calculate monthly installment without interest', () => {
      const monthly = PaymentCalculations.calculateMonthlyInstallment(12000, 12, 0);
      expect(monthly).toBe(1000);
    });

    it('should calculate monthly installment with interest', () => {
      const monthly = PaymentCalculations.calculateMonthlyInstallment(10000, 12, 12);
      expect(monthly).toBeGreaterThan(833.33); // More than simple division due to interest
      expect(monthly).toBeLessThan(1000);
    });

    it('should throw error for zero months', () => {
      expect(() => PaymentCalculations.calculateMonthlyInstallment(12000, 0)).toThrow();
    });

    it('should throw error for negative months', () => {
      expect(() => PaymentCalculations.calculateMonthlyInstallment(12000, -1)).toThrow();
    });

    it('should handle single month installment', () => {
      const monthly = PaymentCalculations.calculateMonthlyInstallment(5000, 1, 0);
      expect(monthly).toBe(5000);
    });
  });

  describe('Compound Total Calculation', () => {
    it('should calculate compound total without interest', () => {
      const total = PaymentCalculations.calculateCompoundTotal(1000, 12, 0);
      expect(total).toBe(12000);
    });

    it('should calculate compound total with interest', () => {
      const total = PaymentCalculations.calculateCompoundTotal(1000, 12, 12);
      expect(total).toBeGreaterThan(12000);
    });

    it('should handle single month', () => {
      const total = PaymentCalculations.calculateCompoundTotal(5000, 1, 0);
      expect(total).toBe(5000);
    });
  });

  describe('Grouping by Status', () => {
    it('should group payments by status', () => {
      const units = [
        { service_status: 'due', due_amount: '5000' },
        { service_status: 'paid', due_amount: '0' },
        { service_status: 'overdue', due_amount: '5000' },
        { service_status: 'due', due_amount: '2500' },
        { service_status: 'partial', due_amount: '2500' },
      ];

      const grouped = PaymentCalculations.groupByStatus(units);

      expect(grouped.due).toHaveLength(2);
      expect(grouped.paid).toHaveLength(1);
      expect(grouped.overdue).toHaveLength(1);
      expect(grouped.partial).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = PaymentCalculations.groupByStatus([]);
      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('should handle missing status', () => {
      const units = [
        { due_amount: '5000' },
        { service_status: 'paid', due_amount: '0' },
      ];

      const grouped = PaymentCalculations.groupByStatus(units);
      expect(grouped.unknown).toHaveLength(1);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate statistics correctly', () => {
      const units = [
        { service_status: 'due', due_amount: '5000' },
        { service_status: 'paid', due_amount: '0' },
        { service_status: 'overdue', due_amount: '5000' },
        { service_status: 'due', due_amount: '2500' },
        { service_status: 'partial', due_amount: '2500' },
      ];

      const stats = PaymentCalculations.calculateStatistics(units);

      expect(stats.totalDue).toBe(15000);
      expect(stats.totalUnits).toBe(5);
      expect(stats.paidCount).toBe(1);
      expect(stats.overdueCount).toBe(1);
      expect(stats.dueCount).toBe(2);
      expect(stats.partialCount).toBe(1);
      expect(stats.averageDue).toBe(3000);
    });

    it('should handle empty array', () => {
      const stats = PaymentCalculations.calculateStatistics([]);

      expect(stats.totalDue).toBe(0);
      expect(stats.totalUnits).toBe(0);
      expect(stats.averageDue).toBe(0);
    });

    it('should calculate average correctly', () => {
      const units = [
        { service_status: 'due', due_amount: '5000' },
        { service_status: 'due', due_amount: '5000' },
        { service_status: 'due', due_amount: '5000' },
      ];

      const stats = PaymentCalculations.calculateStatistics(units);
      expect(stats.averageDue).toBe(5000);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large numbers', () => {
      const units = [
        { due_amount: '999999999' },
        { due_amount: '999999999' },
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBe(1999999998);
    });

    it('should handle very small decimal amounts', () => {
      const units = [
        { due_amount: '0.01' },
        { due_amount: '0.01' },
        { due_amount: '0.01' },
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBeCloseTo(0.03, 2);
    });

    it('should handle mixed valid and invalid data', () => {
      const units = [
        { due_amount: '5000' },
        { due_amount: 'invalid' },
        { due_amount: null },
        { due_amount: '2500' },
        {},
      ];

      const total = PaymentCalculations.calculateTotalDue(units);
      expect(total).toBe(7500);
    });

    it('should handle precision in percentage calculations', () => {
      const percentage = PaymentCalculations.calculatePartialPercentage(3333.33, 10000);
      expect(percentage).toBeGreaterThanOrEqual(33);
      expect(percentage).toBeLessThanOrEqual(34);
    });
  });
});

