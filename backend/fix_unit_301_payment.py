#!/usr/bin/env python
"""
Fix incorrect payment distribution for Payment Test Tower unit 301
After paying 15,000, January should show 500 remaining, not 7,750
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

def fix_unit_301():
    """
    Fix the payment distribution for unit 301
    """
    print("\n" + "="*80)
    print("FIXING PAYMENT TEST TOWER - UNIT 301")
    print("="*80)
    
    # Find the unit
    unit = Unit.objects.filter(unit_name='301').select_related('floor', 'floor__tower').first()
    
    if not unit:
        print("\n❌ Unit 301 not found")
        return
    
    tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else 'Unknown'
    print(f"\n✅ Found unit: {tower_name}, {unit.unit_name} (ID: {unit.id})")
    
    # Get current payment records
    payments = ServiceFeePayment.objects.filter(
        unit_id=unit.id
    ).order_by('service_period_year', 'service_period_month')
    
    print(f"\n📋 Current Payment Records:")
    for payment in payments:
        print(f"\n   {payment.service_period_month:02d}/{payment.service_period_year}:")
        print(f"      ID: {payment.id}")
        print(f"      Amount: ৳{payment.amount}")
        print(f"      Remaining: ৳{payment.remaining_amount}")
        print(f"      Status: {payment.service_status}")
        
        # Check billing records
        billings = ServiceFeeBilling.objects.filter(
            servicefeepaymentid_id=payment.id
        ).aggregate(total=Sum('total_paid'))
        
        total_paid = billings['total'] or Decimal('0')
        print(f"      Total Paid (from billings): ৳{total_paid}")
    
    # Check for advances
    advances = AdvancePayment.objects.filter(
        unit_id=unit.id,
        status__in=['available', 'partial']
    )
    
    if advances.exists():
        print(f"\n💰 Advance Payments Found:")
        for advance in advances:
            print(f"   ID={advance.id}: ৳{advance.remaining_amount} ({advance.advance_type})")
    
    # Analyze the issue
    print(f"\n{'='*80}")
    print(f"ANALYSIS")
    print(f"{'='*80}")
    
    dec_payment = payments.filter(service_period_month=12, service_period_year=2025).first()
    jan_payment = payments.filter(service_period_month=1, service_period_year=2026).first()
    
    if not dec_payment or not jan_payment:
        print("\n❌ December or January payment not found")
        return
    
    print(f"\n📊 Expected vs Actual:")
    print(f"\n   December 2025:")
    print(f"      Expected: PAID (৳0 remaining)")
    print(f"      Actual: {dec_payment.service_status.upper()} (৳{dec_payment.remaining_amount} remaining)")
    
    print(f"\n   January 2026:")
    print(f"      Expected: PARTIAL (৳500 remaining)")
    print(f"      Actual: {jan_payment.service_status.upper()} (৳{jan_payment.remaining_amount} remaining)")
    
    # Calculate what needs to be fixed
    total_billed = dec_payment.amount + jan_payment.amount
    total_paid_recorded = total_billed - (dec_payment.remaining_amount + jan_payment.remaining_amount)
    expected_paid = Decimal('15000')
    missing_payment = expected_paid - total_paid_recorded
    
    print(f"\n💰 Payment Calculation:")
    print(f"   Total Billed: ৳{total_billed}")
    print(f"   Payment Made: ৳15,000")
    print(f"   Recorded as Paid: ৳{total_paid_recorded}")
    print(f"   Missing Payment: ৳{missing_payment}")
    
    if missing_payment <= 0:
        print(f"\n✅ No fix needed - payments are correctly recorded")
        return
    
    # Determine the fix
    print(f"\n{'='*80}")
    print(f"FIX PLAN")
    print(f"{'='*80}")
    
    if dec_payment.remaining_amount > 0:
        # December needs to be paid first
        dec_fix_amount = min(missing_payment, dec_payment.remaining_amount)
        missing_payment -= dec_fix_amount
        print(f"\n1. Apply ৳{dec_fix_amount} to December")
    else:
        dec_fix_amount = Decimal('0')
        print(f"\n1. December already paid ✅")
    
    if missing_payment > 0 and jan_payment.remaining_amount > 0:
        # Apply remaining to January
        jan_fix_amount = min(missing_payment, jan_payment.remaining_amount)
        print(f"2. Apply ৳{jan_fix_amount} to January")
    else:
        jan_fix_amount = Decimal('0')
    
    print(f"\n⚠️ This will:")
    if dec_fix_amount > 0:
        new_dec_remaining = dec_payment.remaining_amount - dec_fix_amount
        new_dec_status = 'paid' if new_dec_remaining <= 0 else ('partial' if new_dec_remaining < dec_payment.amount else 'due')
        print(f"   - December: ৳{dec_payment.remaining_amount} → ৳{new_dec_remaining} ({new_dec_status})")
    
    if jan_fix_amount > 0:
        new_jan_remaining = jan_payment.remaining_amount - jan_fix_amount
        new_jan_status = 'paid' if new_jan_remaining <= 0 else ('partial' if new_jan_remaining < jan_payment.amount else 'due')
        print(f"   - January: ৳{jan_payment.remaining_amount} → ৳{new_jan_remaining} ({new_jan_status})")
    
    # Ask for confirmation
    response = input("\n⚠️ Apply this fix? (yes/no): ")
    if response.lower() != 'yes':
        print("\n❌ Cancelled")
        return
    
    # Apply the fix
    print(f"\n{'='*80}")
    print(f"APPLYING FIX")
    print(f"{'='*80}")
    
    try:
        with transaction.atomic():
            # Fix December
            if dec_fix_amount > 0:
                dec_payment.remaining_amount -= dec_fix_amount
                
                if dec_payment.remaining_amount <= 0:
                    dec_payment.service_status = 'paid'
                    dec_payment.payment_status = 'completed'
                    dec_payment.completion_date = timezone.now()
                elif dec_payment.remaining_amount < dec_payment.amount:
                    dec_payment.service_status = 'partial'
                
                dec_payment.save()
                
                # Create billing record
                billing_dec = ServiceFeeBilling.objects.create(
                    servicefeepaymentid=dec_payment,
                    billing_amount=dec_payment.amount,
                    total_paid=dec_fix_amount,
                    currency='BDT',
                    payment_date=timezone.now(),
                    due_date=dec_payment.due_date,
                    payment_type='service_fee_bill_payment',
                    reference_number='FIX-MANUAL-DEC',
                    created_by=None,
                    other_method_name='Manual Correction',
                    notes='Applied missing payment from first transaction'
                )
                
                print(f"\n✅ December fixed:")
                print(f"   New remaining: ৳{dec_payment.remaining_amount}")
                print(f"   New status: {dec_payment.service_status}")
                print(f"   Billing record created: ID={billing_dec.id}")
            
            # Fix January
            if jan_fix_amount > 0:
                jan_payment.remaining_amount -= jan_fix_amount
                
                if jan_payment.remaining_amount <= 0:
                    jan_payment.service_status = 'paid'
                    jan_payment.payment_status = 'completed'
                    jan_payment.completion_date = timezone.now()
                elif jan_payment.remaining_amount < jan_payment.amount:
                    jan_payment.service_status = 'partial'
                
                jan_payment.save()
                
                # Create billing record
                billing_jan = ServiceFeeBilling.objects.create(
                    servicefeepaymentid=jan_payment,
                    billing_amount=jan_payment.amount,
                    total_paid=jan_fix_amount,
                    currency='BDT',
                    payment_date=timezone.now(),
                    due_date=jan_payment.due_date,
                    payment_type='service_fee_bill_payment',
                    reference_number='FIX-MANUAL-JAN',
                    created_by=None,
                    other_method_name='Manual Correction',
                    notes='Applied missing payment from first transaction'
                )
                
                print(f"\n✅ January fixed:")
                print(f"   New remaining: ৳{jan_payment.remaining_amount}")
                print(f"   New status: {jan_payment.service_status}")
                print(f"   Billing record created: ID={billing_jan.id}")
            
            print(f"\n{'='*80}")
            print(f"✅ FIX COMPLETED SUCCESSFULLY")
            print(f"{'='*80}")
            
            print(f"\n📊 Final State:")
            print(f"   December 2025: {dec_payment.service_status.upper()} (৳{dec_payment.remaining_amount})")
            print(f"   January 2026: {jan_payment.service_status.upper()} (৳{jan_payment.remaining_amount})")
            print(f"   Current Balance: ৳{dec_payment.remaining_amount + jan_payment.remaining_amount}")
            
    except Exception as e:
        print(f"\n❌ Error applying fix: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    try:
        fix_unit_301()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
