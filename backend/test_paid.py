import os
import sys
sys.path.insert(0, '/Users/mirzahasan/Documents/Office/backend')
os.chdir('/Users/mirzahasan/Documents/Office/backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

import django
django.setup()

from service_fee_management.models import ServiceFeePayment, ServiceFeeBilling
from django.db import connection

# Find payment ID 5 (the one we've been testing)
payment = ServiceFeePayment.objects.get(id=5)

print("\n" + "="*80)
print(f"Testing Payment ID: {payment.id}")
print("="*80)
print(f"Amount: {payment.amount}")
print(f"Remaining: {payment.remaining_amount}")
print(f"Status: {payment.service_status}")

# Get billings
billings = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment)
total_paid = sum(b.total_paid for b in billings)
print(f"\nBilling count: {billings.count()}")
print(f"Total paid (from billings): {total_paid}")

# Test SQL
sql = """
SELECT CAST(COALESCE(payment_agg.total_paid_amount, 0) AS CHAR) AS paid_amount
FROM service_fee_management_servicefeegenerate sfp
LEFT JOIN (
    SELECT servicefeepaymentid_id, SUM(total_paid) as total_paid_amount
    FROM service_fee_payment_details spd
    GROUP BY servicefeepaymentid_id
) payment_agg ON payment_agg.servicefeepaymentid_id = sfp.id
WHERE sfp.id = %s
"""

with connection.cursor() as cursor:
    cursor.execute(sql, [payment.id])
    result = cursor.fetchone()
    print(f"API paid_amount: {result[0]}")
    print(f"Match: {str(total_paid) == result[0]}")
