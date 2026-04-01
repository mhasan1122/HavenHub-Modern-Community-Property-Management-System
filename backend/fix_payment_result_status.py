#!/usr/bin/env python
"""
Fix payment_result_status for the 600 Tk payment that completed the bill
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling
from decimal import Decimal

# Find the 600 Tk payment
billing = ServiceFeeBilling.objects.filter(transaction_id='TXN-202602-8EA03194').first()

if billing:
    print(f"\n{'='*80}")
    print(f"FOUND PAYMENT TO FIX")
    print(f"{'='*80}\n")
    print(f"Transaction ID: {billing.transaction_id}")
    print(f"Amount: {billing.total_paid}")
    print(f"Billing Amount: {billing.billing_amount}")
    print(f"Current payment_result_status: {billing.payment_result_status}")
    
    # Check if this payment completed the bill
    remaining = Decimal(str(billing.billing_amount)) - Decimal(str(billing.total_paid))
    print(f"Remaining after this payment: {remaining}")
    
    if remaining < 1:  # Completed the bill
        print(f"\n✅ This payment COMPLETED the bill!")
        print(f"Updating payment_result_status from '{billing.payment_result_status}' to 'full'...")
        
        billing.payment_result_status = 'full'
        billing.save()
        
        print(f"✅ UPDATED! payment_result_status is now: {billing.payment_result_status}")
    else:
        print(f"\n⚠️ This is a partial payment (remaining: {remaining})")
    
    print(f"\n{'='*80}\n")
else:
    print("❌ Payment not found!")
