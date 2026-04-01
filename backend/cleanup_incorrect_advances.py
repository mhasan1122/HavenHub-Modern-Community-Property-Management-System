#!/usr/bin/env python
"""
Cleanup script to fix incorrect advance payments that were created
despite having partial payments
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
from towers.models import Unit
from django.db.models import Sum, Q
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

def cleanup_incorrect_advances():
    """
    Find and fix all incorrect advance payments
    """
    print("\n" + "="*80)
    print("CLEANUP: FIXING INCORRECT ADVANCE PAYMENTS")
    print("="*80)
    
    # Find all units with both pending/partial payments AND advances
    issues_found = []
    
    all_advances = AdvancePayment.objects.filter(
        status__in=['available', 'partial'],
        remaining_amount__gt=0
    )
    
    print(f"\n📋 Checking {all_advances.count()} advance payments...")
    
    for advance in all_advances:
        # Check if this unit has any partial or due payments
        pending_payments = ServiceFeePayment.objects.filter(
            unit_id=advance.unit_id,
            service_status__in=['due', 'partial', 'overdue'],
            remaining_amount__gt=0
        ).order_by('service_period_year', 'service_period_month')
        
        if pending_payments.exists():
            unit = Unit.objects.select_related('floor', 'floor__tower').get(id=advance.unit_id)
            tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else 'Unknown'
            
            issues_found.append({
                'advance': advance,
                'unit': unit,
                'tower_name': tower_name,
                'pending_payments': list(pending_payments)
            })
            
            print(f"\n⚠️ ISSUE FOUND:")
            print(f"   Unit: {tower_name}, {unit.unit_name}")
            print(f"   Advance ID: {advance.id}")
            print(f"   Advance Amount: ৳{advance.remaining_amount}")
            print(f"   Pending Payments:")
            for payment in pending_payments:
                print(f"      - {payment.service_period_month:02d}/{payment.service_period_year}: ৳{payment.remaining_amount} ({payment.service_status})")
    
    if not issues_found:
        print(f"\n✅ No issues found - all advances are correct")
        return
    
    print(f"\n{'='*80}")
    print(f"SUMMARY")
    print(f"{'='*80}")
    print(f"Found {len(issues_found)} unit(s) with incorrect advances")
    
    response = input("\n⚠️ Do you want to fix these issues? (yes/no): ")
    if response.lower() != 'yes':
        print("\n❌ Cancelled")
        return
    
    print(f"\n{'='*80}")
    print(f"FIXING ISSUES")
    print(f"{'='*80}")
    
    fixed_count = 0
    for issue in issues_found:
        advance = issue['advance']
        unit = issue['unit']
        tower_name = issue['tower_name']
        pending_payments = issue['pending_payments']
        
        print(f"\n📝 Fixing {tower_name}, {unit.unit_name}...")
        
        try:
            with transaction.atomic():
                # Apply advance to pending payments (oldest first)
                remaining_advance = Decimal(str(advance.remaining_amount))
                
                for payment in pending_payments:
                    payment_remaining = Decimal(str(payment.remaining_amount))
                    
                    if remaining_advance >= payment_remaining:
                        # Full payment
                        amount_to_apply = payment_remaining
                        remaining_advance -= payment_remaining
                        new_remaining = Decimal('0')
                        new_status = 'paid'
                    elif remaining_advance > 0:
                        # Partial payment
                        amount_to_apply = remaining_advance
                        new_remaining = payment_remaining - remaining_advance
                        remaining_advance = Decimal('0')
                        new_status = 'partial'
                    else:
                        # No more advance to apply
                        break
                    
                    # Update payment
                    payment.remaining_amount = new_remaining
                    if new_status == 'paid':
                        payment.service_status = 'paid'
                        payment.payment_status = 'completed'
                        payment.completion_date = timezone.now()
                    else:
                        payment.service_status = new_status
                    payment.save()
                    
                    # Create billing record
                    billing = ServiceFeeBilling.objects.create(
                        servicefeepaymentid=payment,
                        billing_amount=payment.amount,
                        total_paid=amount_to_apply,
                        currency='BDT',
                        payment_date=timezone.now(),
                        due_date=payment.due_date,
                        payment_type='service_fee_bill_payment',
                        reference_number=f"FIX-ADV-{advance.id}",
                        created_by=None,
                        other_method_name='Advance Payment Correction',
                        notes=f"Applied incorrect advance (ID={advance.id}) to {payment.service_period_month}/{payment.service_period_year}"
                    )
                    
                    print(f"   ✅ Applied ৳{amount_to_apply} to {payment.service_period_month:02d}/{payment.service_period_year} - New status: {new_status}")
                
                # Update advance
                advance.remaining_amount = remaining_advance
                if remaining_advance <= 0:
                    advance.status = 'fully_used'
                advance.notes = f"Corrected: Applied to pending bills. Original amount: {advance.amount}"
                advance.save()
                
                print(f"   ✅ Advance updated - Remaining: ৳{remaining_advance}")
                fixed_count += 1
                
        except Exception as e:
            print(f"   ❌ Error fixing {tower_name}, {unit.unit_name}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*80}")
    print(f"✅ FIXED {fixed_count} out of {len(issues_found)} issues")
    print(f"{'='*80}")

if __name__ == '__main__':
    try:
        cleanup_incorrect_advances()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
