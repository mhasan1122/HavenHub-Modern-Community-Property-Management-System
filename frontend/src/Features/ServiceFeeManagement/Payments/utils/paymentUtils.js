// Test data and utility functions for Service Fee Management

// Backend status choices mapping
export const PAYMENT_STATUS_CHOICES = {
  'pending': 'Pending',
  'completed': 'Completed',
  'failed': 'Failed',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
};

export const PAYMENT_METHOD_CHOICES = {
  'cash': 'Cash',
  'bkash': 'bKash',
  'nagad': 'Nagad',
  'rocket': 'Rocket',
  'bank_transfer': 'Bank Transfer',
  'sslcommerz': 'SSLCommerz',
};

export const SERVICE_STATUS_CHOICES = {
  'due': 'Due',
  'partial': 'Partial',
  'paid': 'Paid',
  'overdue': 'Overdue',
};

// Utility function to get status badge class and text
export const getServiceStatusBadge = (serviceStatus) => {
  const statusLower = serviceStatus?.toLowerCase() || 'due';
  
  switch (statusLower) {
    case 'paid':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-emerald-100 text-emerald-800',
        text: 'PAID'
      };
    case 'partial':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-blue-100 text-blue-800',
        text: 'PARTIAL'
      };
    case 'overdue':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-red-100 text-red-800',
        text: 'OVERDUE'
      };
    case 'due':
    default:
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-yellow-100 text-yellow-800',
        text: 'DUE'
      };
  }
};

export const getPaymentStatusBadge = (paymentStatus) => {
  const statusLower = paymentStatus?.toLowerCase() || 'pending';
  
  switch (statusLower) {
    case 'completed':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-green-100 text-green-800',
        text: 'Completed'
      };
    case 'failed':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-red-100 text-red-800',
        text: 'Failed'
      };
    case 'cancelled':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-gray-100 text-gray-800',
        text: 'Cancelled'
      };
    case 'refunded':
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-purple-100 text-purple-800',
        text: 'Refunded'
      };
    case 'pending':
    default:
      return {
        className: 'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-yellow-100 text-yellow-800',
        text: 'Pending'
      };
  }
};

// Utility function to calculate status based on due date (legacy - kept for compatibility)
export const calculatePaymentStatus = (dueDate, currentStatus) => {
  // If already paid, return paid
  if (currentStatus && currentStatus.toLowerCase() === 'paid') {
    return 'Paid';
  }
  
  // Parse due date (assuming format like "Aug 05")
  const currentYear = new Date().getFullYear();
  const currentDate = new Date();
  
  // Convert due date string to proper date
  const dueDateObj = new Date(`${dueDate} ${currentYear}`);
  
  // If due date has passed, it's overdue
  if (dueDateObj < currentDate) {
    return 'Overdue';
  }
  
  // If due date is today or in future, it's pending
  return 'Pending';
};

// Function to update payment data with calculated statuses
export const updatePaymentStatuses = (payments) => {
  return payments.map(payment => ({
    ...payment,
    status: calculatePaymentStatus(payment.dueDate, payment.status)
  }));
};

export const mockPaymentData = [
  {
    id: 1,
    towerId: 1,
    tower: 'Oasis A',
    unitId: 12,
    unit: 'A-12',
    name: 'Md. Mahafujul Islam',
    amount: '10,000',
    dueDate: 'Aug 05',
    method: 'SSLCommerz',
    status: 'Paid',
    selected: false
  },
  {
    id: 2,
    towerId: 2,
    tower: 'Oasis B',
    unitId: 8,
    unit: 'B-08',
    name: 'Mst. Sumaiya Akter',
    amount: '10,000',
    dueDate: 'Jul 15', // Past date to test overdue
    method: 'Nagad',
    status: 'Pending', // Will be calculated as overdue
    selected: false
  },
  {
    id: 3,
    towerId: 3,
    tower: 'Oasis C',
    unitId: 21,
    unit: 'C-21',
    name: 'Md. Ashiqur Rahman',
    amount: '10,000',
    dueDate: 'Dec 25', // Future date to test pending
    method: 'Cash',
    status: 'Pending', // Will be calculated as pending (future date)
    selected: false
  },
  {
    id: 4,
    towerId: 4,
    tower: 'Rose Tower',
    unitId: 15,
    unit: 'R-15',
    name: 'Mst. Fazilutunnesa',
    amount: '12,000',
    dueDate: 'Jul 10', // Past date to test overdue
    method: 'bKash',
    status: 'Pending', // Will be calculated as overdue
    selected: false
  },
  {
    id: 5,
    towerId: 5,
    tower: 'Lily Tower',
    unitId: 23,
    unit: 'L-23',
    name: 'Md. Sajal Islam',
    amount: '15,000',
    dueDate: 'Jun 15', // Past date to test overdue
    method: 'SSLCommerz',
    status: 'Pending', // Will be calculated as overdue
    selected: false
  },
  {
    id: 6,
    towerId: 6,
    tower: 'Palm Tower',
    unitId: 5,
    unit: 'P-05',
    name: 'Md. Shafiqul Islam',
    amount: '8,000',
    dueDate: 'Jan 12', // Past date - already paid
    method: 'Nagad',
    status: 'Paid',
    selected: false
  },
  {
    id: 7,
    towerId: 7,
    tower: 'Sunrise Tower',
    unitId: 18,
    unit: 'S-18',
    name: 'Md. Abdullah Rahman',
    amount: '11,000',
    dueDate: 'Aug 18',
    method: 'bKash',
    status: 'Paid',
    selected: false
  },
  {
    id: 8,
    towerId: 8,
    tower: 'Ocean View',
    unitId: 2,
    unit: 'O-02',
    name: 'Mst. Fatima Khatun',
    amount: '13,500',
    dueDate: 'Aug 20',
    method: 'Bank Transfer',
    status: 'Paid',
    selected: false
  }
];

export const paymentMethods = [
  'All Methods',
  'Cash',
  'SSLCommerz', 
  'Nagad',
  'bKash',
  'Bank Transfer'
];

export const paymentStatuses = [
  'All Status',
  'Paid',
  'Pending', 
  'Overdue'
];

export const towers = [
  'All Towers',
  'Oasis A',
  'Oasis B',
  'Oasis C', 
  'Rose Tower',
  'Lily Tower',
  'Palm Tower',
  'Sunrise Tower',
  'Ocean View'
];

// Utility functions
export const formatCurrency = (amount) => {
  return `৳ ${amount.toLocaleString()}`;
};

export const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return '#059669';
    case 'overdue':
      return '#DC2626';
    case 'pending':
      return '#D97706';
    default:
      return '#6B7280';
  }
};

export const exportToCSV = (payments) => {
  const headers = ['Tower', 'Unit', 'Invoice', 'Amount', 'Due Date', 'Method', 'Status'];
  const csvContent = [
    headers.join(','),
    ...payments.map(payment => [
      payment.tower,
      payment.unit,
      payment.invoice,
      payment.amount,
      payment.dueDate,
      payment.method,
      payment.status
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const sendBulkReminders = (selectedPayments) => {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: `Reminders sent to ${selectedPayments.length} residents`
      });
    }, 1000);
  });
};
