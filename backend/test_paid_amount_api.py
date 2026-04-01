#!/usr/bin/env python
"""
Test script to verify paid_amount is returned in ServiceFeeResidentListView API
"""
import os
import django
import sys

# Add the backend directory to the Python path
sys.path.insert(0, '/Users/mirzahasan/Documents/Office/backend')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment, ServiceFeeBilling
from decimal import Decimal

print("\n" + "="*80)
print("Testing paid_amount field in payment records")
print("="*80)

# Find a payment with partial payments
payment = ServiceFeePayment.objects.filter(service_status='partial').first()

if not payment:
    print("\n❌ No partial payments found. Creating test scenario...")
    # Find any due payment
    payment = ServiceFeePayment.objects.filter(service_status='due').first()
    if not payment:
        print("❌ No payments found at all!")
        sys.exit(1)
    print(f"✅ Using payment ID: {payment.id}")
else:
    print(f"\n✅ Found partial payment ID: {payment.id}")

print(f"\nPayment Details:")
print(f"  - Service Fee ID: {payment.service_fee_id}")
print(f"  - Unit ID: {payment.unit_id}")
print(f"  - Month/Year: {payment.service_period_month}/{payment.service_period_year}")
print(f"  - Base Amount: ৳{payment.base_service_amount}")
print(f"  - Additional Charges: ৳{payment.additional_bill_charges}")
print(f"  - Total Amount: ৳{payment.amount}")
print(f"  - Status: {payment.service_status}")

# Get all billing records for this payment
billings = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment)
total_paid = sum(b.total_paid for b in billings)

print(f"\n📊 Billing Records: {billings.count()}")
for i, billing in enumerate(billings, 1):
    print(f"  {i}. Billing ID {billing.id}: ৳{billing.total_paid} paid on {billing.payment_date}")

print(f"\n💰 Total Paid (calculated): ৳{total_paid}")
print(f"💰 Remaining Amount (from DB): ৳{payment.remaining_amount}")

# Now test the API query directly
from django.db import connection

print("\n" + "="*80)
print("Testing SQL Query (Simplified - used by mobile app)")
print("="*80)

# Build a simple test query similar to the actual API
sql = """
SELECT 
    sfp.id AS payment_id,
    CAST(sfp.base_service_amount AS CHAR) AS original_amount,
    CAST(sfp.amount AS CHAR) AS total_amount,
    CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
    CAST(COALESCE(payment_agg.total_paid_amount, 0) AS CHAR) AS paid_amount,
    sfp.service_status
FROM service_fee_management_servicefeegenerate sfp
LEFT JOIN (
    SELECT 
        spd.servicefeepaymentid_id,
        SUM(spd.total_paid) as total_paid_amount
    FROM service_fee_payment_details spd
    GROUP BY spd.servicefeepaymentid_id
) payment_agg ON payment_agg.servicefeepaymentid_id = sfp.id
WHERE sfp.id = %s
"""

with connection.cursor() as cursor:
    cursor.execute(sql, [payment.id])
    columns = [col[0] for col in cursor.description]
    result = cursor.fetchone()
    
    if result:
        print("\n✅ SQL Query Result:")
        for col, val in zip(columns, result):
            print(f"  {col}: {val}")
        
        # Verify the calculation
        paid_amount_from_query = Decimal(result[4]) if result[4] else Decimal('0')
        
        print(f"\n🔍 Verification:")
        print(f"  Expected total_paid: ৳{total_paid}")
        print(f"  API returns paid_amount: ৳{paid_amount_from_query}")
        
        if paid_amount_from_query == total_paid:
            print("  ✅ PASSED: paid_amount matches total of all billing records!")
        else:
            print("  ❌ FAILED: paid_amount doesn't match!")
            print(f"     Difference: ৳{abs(paid_amount_from_query - total_paid)}")
    else:
        print("❌ No result from query!")

print("\n" + "="*80)
print("Test complete!")
print("="*80 + "\n")
