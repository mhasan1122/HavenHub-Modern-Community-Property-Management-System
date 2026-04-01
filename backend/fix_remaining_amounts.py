#!/usr/bin/env python
"""
Script to fix remaining_amount inconsistencies in ServiceFeePayment records.
Run this after making payments to ensure remaining_amount = amount - total_paid
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'OFFICE.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment
from decimal import Decimal

def fix_remaining_amounts(dry_run=True):
    """
    Fix remaining_amount for all ServiceFeePayment records.
    
    Args:
        dry_run: If True, only show what would be fixed without making changes
    """
    print("\n" + "="*80)
    print("FIXING REMAINING AMOUNTS FOR SERVICE FEE PAYMENTS")
    print("="*80)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will update database)'}\n")
    
    payments = ServiceFeePayment.objects.all()
    total_checked = 0
    total_fixed = 0
    
    for payment in payments:
        total_checked += 1
        
        # Calculate correct remaining
        correct_remaining = payment.amount - payment.total_paid
        correct_remaining = max(Decimal('0.00'), correct_remaining)
        
        # Check if there's a mismatch
        if payment.remaining_amount != correct_remaining:
            diff = float(payment.remaining_amount - correct_remaining)
            
            print(f"\n❌ MISMATCH FOUND:")
            print(f"   Payment ID: {payment.id}")
            print(f"   Unit: {payment.unit.unit_name if payment.unit else 'N/A'}")
            print(f"   Period: {payment.service_period_month}/{payment.service_period_year}")
            print(f"   Total Amount: ৳{payment.amount}")
            print(f"   Total Paid: ৳{payment.total_paid}")
            print(f"   Current Remaining: ৳{payment.remaining_amount} (WRONG)")
            print(f"   Correct Remaining: ৳{correct_remaining}")
            print(f"   Difference: ৳{diff:.2f}")
            
            if not dry_run:
                payment.remaining_amount = correct_remaining
                payment.save(update_fields=['remaining_amount'])
                print(f"   ✅ FIXED!")
            else:
                print(f"   ⏭️  Would fix in live mode")
            
            total_fixed += 1
    
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total payments checked: {total_checked}")
    print(f"Payments with mismatched remaining_amount: {total_fixed}")
    
    if dry_run and total_fixed > 0:
        print(f"\n💡 To fix these issues, run: python backend/fix_remaining_amounts.py --live")
    elif not dry_run and total_fixed > 0:
        print(f"\n✅ All mismatches have been corrected!")
    else:
        print(f"\n✅ All payments have correct remaining_amount!")
    
    print("="*80 + "\n")

if __name__ == '__main__':
    # Check if --live flag is provided
    dry_run = '--live' not in sys.argv
    fix_remaining_amounts(dry_run=dry_run)
