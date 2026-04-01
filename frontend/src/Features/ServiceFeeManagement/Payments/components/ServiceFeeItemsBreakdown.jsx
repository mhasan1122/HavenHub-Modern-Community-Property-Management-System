import React from 'react';
import PropTypes from 'prop-types';

/**
 * Component to display service fee items breakdown
 * Shows individual items with their amounts
 */
const ServiceFeeItemsBreakdown = ({ items = [] }) => {
  // Handle both array and non-array inputs
  const itemsList = Array.isArray(items) ? items : [];

  if (itemsList.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
      {itemsList.map((item, index) => {
        // Determine label for item
        const getItemLabel = () => {
          if (item.bill_category_name && item.bill_category_name !== 'N/A') {
            return item.bill_category_name;
          }
          switch (item.item_type) {
            case 'base_fee':
              return 'Base Fee';
            case 'penalty':
              return 'Penalty';
            case 'bill_category':
              return 'Bill Category';
            case 'unit_specific':
              return 'Unit Specific';
            default:
              return 'Item';
          }
        };

        const amount = parseFloat(item.amount || 0);

        return (
          <div key={index} className="flex justify-between items-start text-sm">
            <span className="text-gray-600 flex-1">{getItemLabel()}</span>
            <span className="text-sm font-medium text-gray-900 ml-2 whitespace-nowrap">
              ৳{amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

ServiceFeeItemsBreakdown.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      item_type: PropTypes.string,
      amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      description: PropTypes.string,
      bill_category_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      bill_category_name: PropTypes.string
    })
  )
};

export default ServiceFeeItemsBreakdown;
