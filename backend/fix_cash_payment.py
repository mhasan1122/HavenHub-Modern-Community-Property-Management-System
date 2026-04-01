#!/usr/bin/env python
"""
Fix payment_result_status for the 200 Tk cash payment
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling
from decimal import Decimal

# Find the 200 Tk cash payment
billing = ServiceFeeBilling.objects.filter(transaction_id='TXN-202602-C19F56E1').first()

if billing:
    print(f"\n{'='*80}")
    print(f"FIXING CASH PAYMENT RESULT STATUS")
    print(f"{'='*80}\n")
    print(f"Transaction ID: {billing.transaction_id}")
    print(f"Current payment_result_status: {billing.payment_result_status}")
    
    # Get the related payment to check cumulative total
    if billing.servicefeepaymentid:
        payment = billing.servicefeepaymentid
        
        # Get total paid from ALL billings for this payment
        from django.db.models import Sum
        total_paid = ServiceFeeBilling.objects.filter(
            servicefeepaymentid=payment
        ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
        
        bill_amount = payment.amount
        
        print(f"\nPayment Analysis:")
        print(f"  Bill Amount: {bill_amount}")
        print(f"  Total Paid (all billings): {total_paid}")
        print(f"  This billing amount: {billing.total_paid}")
        
        # Determine correct status
        if total_paid >= bill_amount:
            correct_status = 'full'
        else:
            correct_status = 'partial'
        
        print(f"\nCorrect payment_result_status should be: {correct_status}")
        
        if billing.payment_result_status != correct_status:
            print(f"✅ Updating from '{billing.payment_result_status}' to '{correct_status}'...")
            billing.payment_result_status = correct_status
            billing.save()
            print(f"✅ UPDATED!")
        else:
            print(f"✅ Already correct!")
    
    print(f"\n{'='*80}\n")
else:
    print("❌ Payment not found!")
