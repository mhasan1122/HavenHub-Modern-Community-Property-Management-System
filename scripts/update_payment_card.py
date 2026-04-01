#!/usr/bin/env python3
"""
Update RecordPaymentModal to use ServiceFeeItemsTable in payment cards
Replace the flex layout with the table layout
"""

import re

file_path = 'frontend/src/Features/ServiceFeeManagement/Payments/components/RecordPaymentModal.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Add import
if 'import ServiceFeeItemsTable from' not in content:
    # Find the WaivePenaltyModal import and add our import after it
    old_import = "import WaivePenaltyModal from './WaivePenaltyModal';"
    new_import = "import WaivePenaltyModal from './WaivePenaltyModal';\nimport ServiceFeeItemsTable from './ServiceFeeItemsTable';"
    
    content = content.replace(old_import, new_import)
    print("✅ Step 1: Added ServiceFeeItemsTable import")
else:
    print("ℹ️ Step 1: Import already exists")

# Step 2: Add service_fee_items to the mapping if not present
if "service_fee_items: period.service_fee_items || []," not in content:
    old_mapping = "waiver_data: period.waiver_data || [],\n          isSelected: false"
    new_mapping = "waiver_data: period.waiver_data || [],\n          service_fee_items: period.service_fee_items || [],\n          isSelected: false"
    
    if old_mapping in content:
        content = content.replace(old_mapping, new_mapping)
        print("✅ Step 2: Added service_fee_items to period mapping")
    else:
        print("⚠️ Step 2: Mapping pattern not found")

# Step 3: Replace the financial details section with the table component
old_financial = '''                          {/* Financial Details Section */}
                          <div className="space-y-3 mb-4">
                            {/* Original Amount */}
                            <div className="flex justify-between items-center">
                              <span className="text-base text-gray-600">Original Amount</span>
                              <span className="text-base font-medium text-gray-900">
                                ৳{parseFloat(month.original_amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>

                            {/* Additional Charges Amount */}
                            {parseFloat(month.bill_category_amount || 0) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-base text-gray-600">Additional Charges</span>
                                <span className="text-base font-medium text-gray-900">
                                  ৳{parseFloat(month.bill_category_amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            )}

                            {/* Penalty Fee */}
                            <div className="flex justify-between items-center">
                              <span className="text-base text-gray-600">Penalty Fee</span>
                              {penaltyFee > 0 ? (
                                totalWaivedAmount > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-medium text-gray-400 line-through">
                                      ৳{penaltyFee.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-base font-medium text-red-600">
                                      ৳{Math.max(0, penaltyFee - totalWaivedAmount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-base font-medium text-red-600">
                                    ৳{penaltyFee.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                )
                              ) : (
                                <span className="text-base font-medium text-gray-400">
                                  ৳0
                                </span>
                              )}
                            </div>

                            {/* Paid Amount */}
                            <div className="flex justify-between items-center">
                              <span className="text-base text-gray-600">Paid Amount</span>
                              {(() => {
                                // Handle both old format (string: "24880.00|2025-11-22,110.00|2025-11-20")
                                // and new format (number: 10 or 10.00)
                                if (!month.paid_amount || month.paid_amount === '0' || month.paid_amount === 0 || month.paid_amount === '') {
                                  return (
                                    <span className="text-base font-medium text-gray-900">
                                      ৳0
                                    </span>
                                  );
                                }

                                // Check if paid_amount is a string (old format with pipes)
                                if (typeof month.paid_amount === 'string' && month.paid_amount.includes('|')) {
                                  const payments = month.paid_amount.split(',').map(item => {
                                    const [amount, date] = item.split('|');
                                    return {
                                      amount: parseFloat(amount || 0),
                                      date: date || 'N/A'
                                    };
                                  });

                                  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

                                  return (
                                    <span className="text-base font-medium text-gray-900">
                                      ৳{totalPaid.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  );
                                }

                                // Handle new format (direct number)
                                const totalPaid = parseFloat(month.paid_amount || 0);
                                return (
                                  <span className="text-base font-medium text-gray-900">
                                    ৳{totalPaid.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>'''

new_financial = '''                          {/* Payment Summary Table */}
                          <div className="mb-4">
                            <ServiceFeeItemsTable month={month} />
                          </div>'''

if old_financial in content:
    content = content.replace(old_financial, new_financial)
    print("✅ Step 3: Replaced financial details section with ServiceFeeItemsTable")
else:
    print("⚠️ Step 3: Financial details pattern not found (may have been modified)")

# Write the updated content back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ RecordPaymentModal.jsx updated successfully!")
print("\nChanges made:")
print("1. Added ServiceFeeItemsTable import")
print("2. Added service_fee_items to period mapping")
print("3. Replaced flex layout with ServiceFeeItemsTable component in payment cards")
