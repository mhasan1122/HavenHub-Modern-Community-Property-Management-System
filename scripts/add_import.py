#!/usr/bin/env python3
import os

file_path = 'frontend/src/Features/ServiceFeeManagement/Payments/components/RecordPaymentModal.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the WaivePenaltyModal import line
old_import = "import WaivePenaltyModal from './WaivePenaltyModal';"
new_import = "import WaivePenaltyModal from './WaivePenaltyModal';\nimport ServiceFeeItemsBreakdown from './ServiceFeeItemsBreakdown';"

if old_import in content:
    content = content.replace(old_import, new_import)
    print("✅ Import statement added")
    
    # Also find where to add the component usage
    # Looking for "Additional Charges Amount"
    additional_charges_section = '{/* Additional Charges Amount */}'
    
    if additional_charges_section in content:
        # Find the next section to insert the breakdown component
        # Insert after the Additional Charges closing div
        insert_after = '''                            )}\n\n                            {/* Penalty Fee */}'''
        
        component_usage = '''                            )}\n\n                            {/* Service Fee Items Breakdown */}\n                            <ServiceFeeItemsBreakdown items={month.service_fee_items} />\n\n                            {/* Penalty Fee */}'''
        
        if insert_after in content:
            content = content.replace(insert_after, component_usage)
            print("✅ Component usage added")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ File updated successfully!")
else:
    print("❌ Could not find import line to replace")
