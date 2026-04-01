import React from 'react';
import PropTypes from 'prop-types';

/**
 * Simple table to display ALL service fee data: Name and Amount only
 * Shows: Original Amount, Additional Charges with items breakdown, Penalty, Waived
 */
const ServiceFeeItemsTable = ({ 
  month = null
}) => {
  if (!month) {
    return null;
  }

  const originalAmount = parseFloat(month.original_amount || 0);
  const billCategoryAmount = parseFloat(month.bill_category_amount || 0);
  const billCategoryItems = Array.isArray(month.service_fee_items) ? month.service_fee_items : [];
  const penaltyAmount = parseFloat(month.penalty_amount || 0);
  const grossPenaltyAmount = parseFloat(month.gross_penalty_amount || 0);
  const waivedAmount = parseFloat(month.waived_amount || 0);
  const paidAmount = parseFloat(month.paid_amount || 0);

  // Build rows array
  const rows = [];

  // 1. Original Amount
  if (originalAmount > 0) {
    rows.push({
      name: 'Original Amount (Base Fee)',
      amount: originalAmount,
      type: 'base'
    });
  }

  // 2. Additional Charges - Total and Items
  if (billCategoryAmount > 0) {
    rows.push({
      name: 'Additional Charges',
      amount: billCategoryAmount,
      type: 'header'
    });

    // Add each bill category item
    billCategoryItems.forEach((item) => {
      rows.push({
        name: `  └─ ${item.bill_category_name || item.item_type || 'Item'}`,
        amount: parseFloat(item.amount || 0),
        type: 'item',
        indent: true
      });
    });
  }

  // 3. Penalty Fee
  if (grossPenaltyAmount > 0) {
    rows.push({
      name: 'Penalty Fee (Gross)',
      amount: grossPenaltyAmount,
      type: 'penalty'
    });
  }

  // 4. Waived Amount
  if (waivedAmount > 0) {
    rows.push({
      name: 'Waived Amount',
      amount: -waivedAmount,
      type: 'waived'
    });
  }

  // 5. Paid Amount
  if (paidAmount > 0) {
    rows.push({
      name: 'Paid Amount',
      amount: -paidAmount,
      type: 'paid'
    });
  }

  if (rows.length === 0) {
    return null;
  }

  // Calculate total due
  const totalDue = originalAmount + billCategoryAmount + penaltyAmount - waivedAmount - paidAmount;

  return (
    <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">
          Payment Summary {month.month_name ? `- ${month.month_name}` : ''}
        </h4>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200">
        {/* Column Headers */}
        <div className="grid grid-cols-2 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-700 uppercase">Item Name</div>
          <div className="text-xs font-semibold text-gray-700 uppercase text-right">Amount</div>
        </div>

        {/* Data Rows */}
        {rows.map((row, index) => {
          let textColor = 'text-gray-900';
          let amountColor = 'text-gray-900';

          if (row.type === 'header') {
            textColor = 'font-semibold text-gray-900';
            amountColor = 'font-semibold text-gray-900';
          } else if (row.type === 'item') {
            textColor = 'text-gray-600';
            amountColor = 'text-gray-600';
          } else if (row.type === 'penalty') {
            amountColor = 'text-red-600 font-medium';
          } else if (row.type === 'waived') {
            amountColor = 'text-emerald-600 font-medium';
          } else if (row.type === 'paid') {
            amountColor = 'text-blue-600 font-medium';
          }

          const displayAmount = row.amount < 0 
            ? `-৳${Math.abs(row.amount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : `৳${row.amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

          return (
            <div 
              key={index} 
              className={`grid grid-cols-2 gap-4 px-6 py-3 hover:bg-gray-50 transition-colors ${row.type === 'header' ? 'bg-blue-50' : ''}`}
            >
              <div className={`text-sm ${textColor}`}>
                {row.name}
              </div>
              <div className={`text-sm text-right ${amountColor}`}>
                {displayAmount}
              </div>
            </div>
          );
        })}

        {/* Total Due Row */}
        <div className="grid grid-cols-2 gap-4 px-6 py-4 bg-teal-50 border-t-2 border-teal-200">
          <div className="text-sm font-bold text-teal-900">Total Due</div>
          <div className="text-sm font-bold text-right text-teal-600">
            ৳{totalDue.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  );
};

ServiceFeeItemsTable.propTypes = {
  month: PropTypes.shape({
    original_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    bill_category_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    service_fee_items: PropTypes.array,
    penalty_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    gross_penalty_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    waived_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    paid_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    month_name: PropTypes.string
  })
};

export default ServiceFeeItemsTable;
