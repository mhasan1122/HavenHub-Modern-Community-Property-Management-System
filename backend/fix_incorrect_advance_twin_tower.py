#!/usr/bin/env python
"""
Fix incorrect advance payment for Twin Tower 1-4C
The advance of 4,440 should be applied to January's partial payment
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
from django.db.models import Sum
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

def fix_incorrect_advance():
    """
    Fix the incorrect advance payment for Twin Tower 1-4C
    """
    print("\n" + "="*80)
    print("FIXING INCORRECT ADVANCE PAYMENT FOR TWIN TOWER 1-4C")
    print("="*80)
    
    try:
        # Find the unit
        unit = Unit.objects.filter(unit_name='4C').select_related('floor', 'floor__tower').first()
        if not unit:
            unit = Unit.objects.filter(unit_name='1 - 4C').select_related('floor', 'floor__tower').first()
        
        if not unit:
            print("\n❌ Unit not found")
            return
        
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else 'Unknown'
        print(f"\n✅ Found unit: {tower_name}, {unit.unit_name} (ID: {unit.id})")
        
        # Find the incorrect advance
        advance = AdvancePayment.objects.filter(
            unit_id=unit.id,
            status__in=['available', 'partial'],
            advance_type='overpayment',
            amount=Decimal('4440')
        ).first()
        
        if not advance:
            print("\n❌ Advance payment not found")
            return
        
        print(f"\n✅ Found incorrect advance:")
        print(f"   ID: {advance.id}")
        print(f"   Amount: ৳{advance.amount}")
        print(f"   Remaining: ৳{advance.remaining_amount}")
        print(f"   Type: {advance.advance_type}")
        
        # Find January 2026 payment
        jan_payment = ServiceFeePayment.objects.filter(
            unit_id=unit.id,
            service_period_month=1,
            service_period_year=2026
        ).first()
        
        if not jan_payment:
            print("\n❌ January 2026 payment not found")
            return
        
        print(f"\n✅ Found January 2026 payment:")
        print(f"   ID: {jan_payment.id}")
        print(f"   Amount: ৳{jan_payment.amount}")
        print(f"   Remaining: ৳{jan_payment.remaining_amount}")
        print(f"   Status: {jan_payment.service_status}")
        
        # Calculate what the correct state should be
        advance_amount = Decimal(str(advance.remaining_amount))
        jan_remaining = Decimal(str(jan_payment.remaining_amount))
        
        print(f"\n📊 ANALYSIS:")
        print(f"   Advance to apply: ৳{advance_amount}")
        print(f"   January remaining: ৳{jan_remaining}")
        
        # The advance should have been applied to January
        # Current state: Advance=4440, Jan remaining=4560
        # Correct state: Advance=0, Jan remaining=120 (4560-4440)
        
        correct_jan_remaining = jan_remaining - advance_amount
        
        print(f"\n✅ CORRECT STATE:")
        print(f"   January remaining should be: ৳{correct_jan_remaining}")
        print(f"   Advance should be: ৳0")
        
        # Ask for confirmation
        response = input("\n⚠️ Do you want to fix this? (yes/no): ")
        if response.lower() != 'yes':
            print("\n❌ Cancelled")
            return
        
        with transaction.atomic():
            # Update January payment
            jan_payment.remaining_amount = correct_jan_remaining
            
            if correct_jan_remaining <= 0:
                jan_payment.service_status = 'paid'
                jan_payment.payment_status = 'completed'
                jan_payment.completion_date = timezone.now()
            elif correct_jan_remaining < jan_payment.amount:
                jan_payment.service_status = 'partial'
                jan_payment.payment_status = 'pending'
            else:
                jan_payment.service_status = 'due'
                jan_payment.payment_status = 'pending'
            
            jan_payment.save()
            
            # Create billing record for the advance amount being applied
            billing = ServiceFeeBilling.objects.create(
                servicefeepaymentid=jan_payment,
                billing_amount=jan_payment.amount,
                total_paid=advance_amount,
                currency='BDT',
                payment_date=timezone.now(),
                due_date=jan_payment.due_date,
                payment_type='service_fee_bill_payment',
                reference_number=f"FIX-ADV-{advance.id}",
                created_by=None,
                other_method_name='Advance Payment Correction',
                notes=f"Applied incorrect advance payment (ID={advance.id}) to January bill"
            )
            
            # Delete or mark advance as used
            advance.status = 'fully_used'
            advance.remaining_amount = Decimal('0')
            advance.notes = f"Corrected: Applied to January 2026 payment (SFP ID={jan_payment.id})"
            advance.save()
            
            print(f"\n✅ FIX APPLIED:")
            print(f"   January payment updated: ID={jan_payment.id}")
            print(f"   - New remaining: ৳{jan_payment.remaining_amount}")
            print(f"   - New status: {jan_payment.service_status}")
            print(f"   Billing record created: ID={billing.id}")
            print(f"   Advance marked as used: ID={advance.id}")
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    try:
        fix_incorrect_advance()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
