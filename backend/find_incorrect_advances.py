#!/usr/bin/env python
"""
Script to find incorrect advance payments where partial payments exist
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
)
from django.db.models import Sum, Q
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

def find_incorrect_advances():
    """
    Find advance payments that were created despite having partial payments
    """
    print("\n" + "="*80)
    print("FINDING INCORRECT ADVANCE PAYMENTS")
    print("="*80)
    
    # Get all advance payments created in the last 7 days
    recent_date = timezone.now() - timedelta(days=7)
    recent_advances = AdvancePayment.objects.filter(
        created_at__gte=recent_date,
        status__in=['available', 'partial']
    ).order_by('-created_at')
    
    print(f"\n📋 Found {recent_advances.count()} advance payments in last 7 days")
    
    incorrect_advances = []
    
    for advance in recent_advances:
        # Check if this unit has any partial payments
        partial_payments = ServiceFeePayment.objects.filter(
            unit_id=advance.unit_id,
            service_status='partial'
        )
        
        if partial_payments.exists():
            print(f"\n⚠️ INCORRECT ADVANCE DETECTED:")
            print(f"   Advance ID: {advance.id}")
            print(f"   Unit ID: {advance.unit_id}")
            print(f"   Amount: ৳{advance.amount}")
            print(f"   Remaining: ৳{advance.remaining_amount}")
            print(f"   Type: {advance.advance_type}")
            print(f"   Created: {advance.created_at}")
            print(f"   Notes: {advance.notes}")
            
            print(f"\n   Partial Payments Found:")
            for payment in partial_payments:
                print(f"   - ID={payment.id}, Period={payment.service_period_month}/{payment.service_period_year}")
                print(f"     Amount={payment.amount}, Remaining={payment.remaining_amount}, Status={payment.service_status}")
            
            incorrect_advances.append({
                'advance': advance,
                'partial_payments': list(partial_payments)
            })
    
    print(f"\n{'='*80}")
    print(f"SUMMARY")
    print(f"{'='*80}")
    print(f"Total Recent Advances: {recent_advances.count()}")
    print(f"Incorrect Advances: {len(incorrect_advances)}")
    
    if incorrect_advances:
        print(f"\n⚠️ Found {len(incorrect_advances)} incorrect advance payment(s)")
        print(f"\nThese advances should NOT have been created because partial payments exist.")
        print(f"\nWould you like to delete these incorrect advances? (This script is read-only)")
    else:
        print(f"\n✅ No incorrect advances found")
    
    # Also check all advances ever created
    print(f"\n{'='*80}")
    print(f"CHECKING ALL ADVANCES")
    print(f"{'='*80}")
    
    all_advances = AdvancePayment.objects.filter(
        status__in=['available', 'partial']
    ).order_by('-created_at')
    
    print(f"\n📋 Checking {all_advances.count()} total advance payments...")
    
    all_incorrect = []
    for advance in all_advances:
        partial_payments = ServiceFeePayment.objects.filter(
            unit_id=advance.unit_id,
            service_status='partial'
        )
        
        if partial_payments.exists():
            all_incorrect.append({
                'advance': advance,
                'partial_payments': list(partial_payments)
            })
    
    if all_incorrect:
        print(f"\n⚠️ Found {len(all_incorrect)} TOTAL incorrect advances (all time)")
        for item in all_incorrect[:5]:  # Show first 5
            advance = item['advance']
            print(f"\n   - Advance ID={advance.id}, Unit={advance.unit_id}, Amount=৳{advance.amount}, Created={advance.created_at.strftime('%Y-%m-%d')}")
    else:
        print(f"\n✅ No incorrect advances found (all time)")

if __name__ == '__main__':
    try:
        find_incorrect_advances()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
