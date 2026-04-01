#!/usr/bin/env python
"""
Script to update the unpaid periods query to include service fee items breakdown.
This adds the service_fee_items JSON column and LEFT JOIN to the SQL query.
"""

import os
import sys

# Read the file
views_file = os.path.join(os.path.dirname(__file__), 'service_fee_management', 'views.py')

with open(views_file, 'r', encoding='utf-8') as f:
    content = f.read()

# First modification: Add service_fee_items to SELECT clause
old_select = '''                    COALESCE(payment_agg.payment_details, JSON_ARRAY()) AS payment_details,
                    COALESCE(bill_cat_agg.category_details, JSON_ARRAY()) AS bill_category_details,
                    COALESCE(waiver_agg.waiver_details, JSON_ARRAY()) AS waiver_data'''

new_select = '''                    COALESCE(payment_agg.payment_details, JSON_ARRAY()) AS payment_details,
                    COALESCE(bill_cat_agg.category_details, JSON_ARRAY()) AS bill_category_details,
                    COALESCE(waiver_agg.waiver_details, JSON_ARRAY()) AS waiver_data,
                    COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items'''

if old_select in content:
    content = content.replace(old_select, new_select)
    print('✅ Added service_fee_items to SELECT clause')
else:
    print('❌ Could not find SELECT pattern')
    sys.exit(1)

# Second modification: Add the service_fee_items JOIN
old_join = '''                ) bill_cat_agg ON bill_cat_agg.servicefeepaymentid_id = sfp.id
                
                /* Join late penalty tiers - use subquery to get max penalty only */'''

new_join = '''                ) bill_cat_agg ON bill_cat_agg.servicefeepaymentid_id = sfp.id
                
                /* Pre-aggregated service fee items */
                LEFT JOIN (
                    SELECT 
                        sfi.service_fee_payment_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sfi.id,
                                'item_type', sfi.item_type,
                                'amount', CAST(sfi.amount AS CHAR),
                                'description', sfi.description,
                                'bill_category_id', sfi.bill_category_id,
                                'bill_category_name', COALESCE(bc_item.name, 'N/A')
                            )
                        ) as item_details
                    FROM service_fee_management_servicefeeitem sfi
                    LEFT JOIN bill_category bc_item ON sfi.bill_category_id = bc_item.id
                    GROUP BY sfi.service_fee_payment_id
                ) item_agg ON item_agg.service_fee_payment_id = sfp.id
                
                /* Join late penalty tiers - use subquery to get max penalty only */'''

if old_join in content:
    content = content.replace(old_join, new_join)
    print('✅ Added LEFT JOIN for service_fee_items aggregation')
else:
    print('❌ Could not find JOIN pattern')
    sys.exit(1)

# Write back
with open(views_file, 'w', encoding='utf-8') as f:
    f.write(content)

print('\n✅ Successfully updated views.py!')
print('Modified:')
print('  1. Added service_fee_items to SELECT clause')
print('  2. Added LEFT JOIN for service_fee_management_servicefeeitem aggregation')
print('\nThe unpaid-periods API will now return service_fee_items array with:')
print('  - id: Item ID')
print('  - item_type: base_fee, penalty, bill_category, or unit_specific')
print('  - amount: Amount for this item')
print('  - description: Item description')
print('  - bill_category_id: ID if bill category item')
print('  - bill_category_name: Name of the bill category')
