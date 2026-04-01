import os
import django
import sys
import json

# Setup Django
sys.path.insert(0, '/Users/mirzahasan/Documents/Final/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Estate_link.settings')
django.setup()

from django.db import connection

# Test the payment history query for unit 102
sql = """
SELECT 
    spd.id,
    spd.billing_id,
    spd.transaction_id,
    spd.receipt_id,
    spd.total_paid,
    sfp.service_period_month,
    sfp.service_period_year,
    DATE_FORMAT(
        CONCAT(
            LPAD(sfp.service_period_year, 4, '0'), '-',
            LPAD(sfp.service_period_month, 2, '0'), '-01'
        ), 
        '%M %Y'
    ) AS month_name,
    JSON_ARRAY(
        JSON_OBJECT(
            'id', spd.id,
            'billing_id', spd.billing_id,
            'amount_paid', CAST(spd.total_paid AS CHAR),
            'service_period_month', sfp.service_period_month,
            'service_period_year', sfp.service_period_year,
            'month_name', DATE_FORMAT(
                CONCAT(
                    LPAD(sfp.service_period_year, 4, '0'), '-',
                    LPAD(sfp.service_period_month, 2, '0'), '-01'
                ), 
                '%M %Y'
            )
        )
    ) AS payment_details
FROM service_fee_payment_details spd
INNER JOIN service_fee_management_servicefeegenerate sfp ON sfp.id = spd.servicefeepaymentid_id
INNER JOIN towers_unit u ON u.id = sfp.unit_id
WHERE u.unit_name = '102' 
  AND spd.receipt_id LIKE 'RCP-2026-02-00060%'
ORDER BY spd.created_at DESC
LIMIT 5
"""

print("\n" + "="*80)
print("TESTING PAYMENT HISTORY QUERY")
print("="*80 + "\n")

with connection.cursor() as cursor:
    cursor.execute(sql)
    columns = [col[0] for col in cursor.description]
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} payment detail records:\n")
    
    for row in rows:
        data = dict(zip(columns, row))
        print(f"Record ID: {data['id']}")
        print(f"  Month: {data['month_name']} ({data['service_period_month']}/{data['service_period_year']})")
        print(f"  Billing ID: {data['billing_id']}")
        print(f"  Receipt ID: {data['receipt_id']}")
        print(f"  Amount: {data['total_paid']}")
        
        # Parse payment_details JSON
        try:
            payment_details = json.loads(data['payment_details']) if isinstance(data['payment_details'], str) else data['payment_details']
            print(f"  Payment Details: {json.dumps(payment_details, indent=4)}")
        except Exception as e:
            print(f"  Payment Details: {data['payment_details']}")
        print()

print("\nNow checking consolidated view (what API returns):\n")
print("="*80 + "\n")

# Group by receipt_id like the API does
consolidated = {}
for row in rows:
    data = dict(zip(columns, row))
    receipt_id = data['receipt_id']
    
    if receipt_id not in consolidated:
        consolidated[receipt_id] = {
            'receipt_id': receipt_id,
            'payment_details': []
        }
    
    # Parse and add payment details
    try:
        pd = json.loads(data['payment_details']) if isinstance(data['payment_details'], str) else data['payment_details']
        consolidated[receipt_id]['payment_details'].extend(pd if isinstance(pd, list) else [pd])
    except:
        pass

for receipt_id, data in consolidated.items():
    print(f"Receipt: {receipt_id}")
    print(f"  Payment Details Count: {len(data['payment_details'])}")
    print(f"  Details:")
    for idx, pd in enumerate(data['payment_details'], 1):
        print(f"    {idx}. {pd.get('month_name')} - Amount: {pd.get('amount_paid')}")
    print()

print("="*80)
