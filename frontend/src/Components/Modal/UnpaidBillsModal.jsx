import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * UnpaidBillsModal Component
 * Displays unpaid bills table in a modal overlay
 */
const UnpaidBillsModal = ({
  isOpen,
  onClose,
  unpaidBills = [],
  formatCurrency,
  formatDate,
  calculateDaysOverdue,
}) => {
  // Handle escape key and body scroll
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle backdrop click to close modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Modal Container */}
      <div className="relative bg-white rounded-lg shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">Unpaid Bills</h2>
          <p className="text-sm text-gray-600 mt-1">
            {unpaidBills.length} {unpaidBills.length === 1 ? 'bill' : 'bills'} pending payment
          </p>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {unpaidBills.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#EBF5F5] sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Period</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Debit (Dr)</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Credit (Cr)</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Due Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Days Overdue</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-black">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                  {unpaidBills.map((bill) => {
                    const daysOverdue = calculateDaysOverdue(bill.dueDate);
                    const totalDebit = bill.debit;
                    const totalCredit = bill.totalCredit || 0;
                    return (
                      <tr key={bill.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {bill.description.replace('Service Fee - ', '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                          {formatCurrency(totalDebit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                          {totalCredit > 0 ? formatCurrency(totalCredit) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {bill.dueDate ? formatDate(bill.dueDate) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {daysOverdue !== null ? `${daysOverdue} days` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            bill.status === 'overdue' ? 'bg-red-50 text-red-600' :
                            bill.status === 'partial' ? 'bg-blue-50 text-blue-700' :
                            'bg-yellow-50 text-yellow-700'
                          }`}>
                            {bill.status?.charAt(0).toUpperCase() + bill.status?.slice(1) || 'Due'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-orange-600">
                          {formatCurrency(bill.remainingAmount || bill.debit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">No unpaid bills</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnpaidBillsModal;

