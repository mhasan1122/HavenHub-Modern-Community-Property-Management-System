#!/usr/bin/env python
"""
Debug script to check the actual payment records after PayStation payment
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import (
    ServiceFeePayment, 
    ServiceFeeBilling, 
    AdvancePayment,
    PayStationTransactionMapping
)
from django.db.models import Sum
from decimal import Decimal

def check_payment_status():
    print("\n" + "="*80)
    print("CHECKING PAYMENT STATUS AFTER PAYSTATION PAYMENT")
    print("="*80)
    
    # Check for the PayStation transaction
    invoice = "PS-63855D404F4B"
    
    print(f"\n📋 Searching for invoice: {invoice}")
    
    mapping = PayStationTransactionMapping.objects.filter(invoice_number=invoice).first()
    
    if mapping:
        print(f"\n✅ Found PayStation mapping:")
        print(f"   Invoice: {mapping.invoice_number}")
        print(f"   Amount: ৳{mapping.amount}")
        print(f"   Unit ID: {mapping.unit_id}")
        print(f"   Service Fee ID: {mapping.service_fee_id}")
        print(f"   Is Advance: {mapping.is_advance_payment}")
        print(f"   Payment IDs: {mapping.payment_ids}")
        
        # Check the actual payments
        if mapping.payment_ids:
            payment_ids = mapping.payment_ids
            payments = ServiceFeePayment.objects.filter(id__in=payment_ids).order_by('service_period_year', 'service_period_month')
            
            print(f"\n📊 Payment Records ({payments.count()}):")
            for payment in payments:
                total_paid = ServiceFeeBilling.objects.filter(
                    servicefeepaymentid=payment
                ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
                
                print(f"\n   Payment ID: {payment.id}")
                print(f"   Period: {payment.service_period_month}/{payment.service_period_year}")
                print(f"   Amount: ৳{payment.amount}")
                print(f"   Remaining: ৳{payment.remaining_amount}")
                print(f"   Service Status: {payment.service_status}")
                print(f"   Total Paid (from billings): ৳{total_paid}")
        
        # Check for advance payments created
        unit_id = mapping.unit_id
        advances = AdvancePayment.objects.filter(
            unit_id=unit_id,
            status__in=['available', 'partial']
        ).order_by('-created_at')
        
        print(f"\n💰 Advance Payments for Unit {unit_id} ({advances.count()}):")
        for adv in advances:
            print(f"\n   ID: {adv.id}")
            print(f"   Amount: ৳{adv.amount}")
            print(f"   Remaining: ৳{adv.remaining_amount}")
            print(f"   Type: {adv.advance_type}")
            print(f"   Status: {adv.status}")
            print(f"   Notes: {adv.notes}")
            print(f"   Created: {adv.created_at}")
    else:
        print(f"\n❌ No PayStation mapping found for invoice: {invoice}")
    
    # Check ALL payments for unit 24
    print(f"\n" + "="*80)
    print(f"ALL PAYMENTS FOR UNIT 24")
    print("="*80)
    
    all_payments = ServiceFeePayment.objects.filter(
        unit_id=24,
        service_fee_id=1
    ).order_by('service_period_year', 'service_period_month')
    
    for payment in all_payments:
        total_paid = ServiceFeeBilling.objects.filter(
            servicefeepaymentid=payment
        ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
        
        print(f"\n   {payment.service_period_month}/{payment.service_period_year}:")
        print(f"   - ID: {payment.id}")
        print(f"   - Amount: ৳{payment.amount}")
        print(f"   - Remaining: ৳{payment.remaining_amount}")
        print(f"   - Status: {payment.service_status}")
        print(f"   - Total Paid: ৳{total_paid}")

if __name__ == '__main__':
    from django.db.models import Sum
    check_payment_status()
