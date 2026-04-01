#!/usr/bin/env python3
"""
Update RecordPaymentModal to show service_fee_items breakdown
Add the breakdown directly under Additional Charges Amount section
"""

import re

file_path = 'frontend/src/Features/ServiceFeeManagement/Payments/components/RecordPaymentModal.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Ensure service_fee_items is captured in the mapping
old_mapping = '''          waiver_applied: period.waiver_applied || false,
          waiver_data: period.waiver_data || [],
          isSelected: false'''

new_mapping = '''          waiver_applied: period.waiver_applied || false,
          waiver_data: period.waiver_data || [],
          service_fee_items: period.service_fee_items || [],
          isSelected: false'''

if old_mapping in content:
    content = content.replace(old_mapping, new_mapping)
    print("✅ Step 1: Added service_fee_items to fetchUnpaidPeriods mapping")
else:
    print("⚠️ Step 1: Mapping pattern not found (may already be updated)")

# Step 2: Add breakdown display under Additional Charges
# Find the Additional Charges section and add breakdown after it
old_charges = '''                            {parseFloat(month.bill_category_amount || 0) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-base text-gray-600">Additional Charges</span>
                                <span className="text-base font-medium text-gray-900">
                                  ৳{parseFloat(month.bill_category_amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            )}'''

new_charges = '''                            {parseFloat(month.bill_category_amount || 0) > 0 && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-base text-gray-600">Additional Charges</span>
                                  <span className="text-base font-medium text-gray-900">
                                    ৳{parseFloat(month.bill_category_amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                {month.service_fee_items && Array.isArray(month.service_fee_items) && month.service_fee_items.length > 0 && (
                                  <div className="ml-4 space-y-1 pt-2 border-t border-gray-100">
                                    {month.service_fee_items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{item.bill_category_name || 'Item'}</span>
                                        <span className="text-sm font-medium text-gray-900">৳{parseFloat(item.amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}'''

if old_charges in content:
    content = content.replace(old_charges, new_charges)
    print("✅ Step 2: Added service_fee_items breakdown under Additional Charges")
else:
    print("⚠️ Step 2: Additional Charges pattern not found")
    print("   This is expected if the code has already been modified")

# Write the updated content back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ RecordPaymentModal.jsx updated successfully!")
print("\nDisplay format:")
print("Additional Charges:           ৳1,500")
print("  hride                       ৳1,000")
print("  water                       ৳300")
print("  gas                         ৳200")
