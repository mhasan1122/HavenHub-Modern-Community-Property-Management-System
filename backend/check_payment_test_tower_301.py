#!/usr/bin/env python
"""
Check Payment Test Tower unit 301 - months and amounts
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

def check_unit_301():
    """
    Check Payment Test Tower unit 301
    """
    print("\n" + "="*80)
    print("CHECKING PAYMENT TEST TOWER - UNIT 301")
    print("="*80)
    
    # Find the unit
    unit = Unit.objects.filter(
        Q(unit_name='301') | Q(unit_name='3-01') | Q(unit_name='3 01')
    ).select_related('floor', 'floor__tower').first()
    
    if not unit:
        print("\n❌ Unit 301 not found")
        print("\nSearching for units with '301' in name...")
        units = Unit.objects.filter(unit_name__icontains='301').select_related('floor', 'floor__tower')
        if units.exists():
            print(f"\nFound {units.count()} unit(s):")
            for u in units:
                tower_name = u.floor.tower.tower_name if u.floor and u.floor.tower else 'Unknown'
                print(f"   - {tower_name}, {u.unit_name} (ID: {u.id})")
        return
    
    tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else 'Unknown'
    print(f"\n✅ Found unit: {tower_name}, {unit.unit_name}")
    print(f"   Unit ID: {unit.id}")
    
    # Get all payments for this unit
    all_payments = ServiceFeePayment.objects.filter(
        unit_id=unit.id
    ).order_by('service_period_year', 'service_period_month')
    
    print(f"\n📋 TOTAL PAYMENT RECORDS: {all_payments.count()}")
    
    if all_payments.count() == 0:
        print("\n⚠️ No payment records found for this unit")
        return
    
    # Separate by status
    paid_payments = all_payments.filter(service_status='paid')
    partial_payments = all_payments.filter(service_status='partial')
    due_payments = all_payments.filter(Q(service_status='due') | Q(service_status='overdue'))
    
    print(f"\n📊 PAYMENT STATUS BREAKDOWN:")
    print(f"   ✅ Paid: {paid_payments.count()} month(s)")
    print(f"   ⚠️ Partial: {partial_payments.count()} month(s)")
    print(f"   ❌ Due/Overdue: {due_payments.count()} month(s)")
    
    # Calculate totals
    total_billed = all_payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    total_remaining = all_payments.aggregate(total=Sum('remaining_amount'))['total'] or Decimal('0')
    total_paid = total_billed - total_remaining
    
    print(f"\n💰 FINANCIAL SUMMARY:")
    print(f"   Total Billed: ৳{total_billed}")
    print(f"   Total Paid: ৳{total_paid}")
    print(f"   Total Remaining: ৳{total_remaining}")
    
    # Show all months with details
    print(f"\n📅 DETAILED MONTH-BY-MONTH BREAKDOWN:")
    print(f"{'='*80}")
    
    for payment in all_payments:
        status_icon = "✅" if payment.service_status == 'paid' else "⚠️" if payment.service_status == 'partial' else "❌"
        
        print(f"\n{status_icon} {payment.service_period_month:02d}/{payment.service_period_year} - {payment.service_status.upper()}")
        print(f"   Payment ID: {payment.id}")
        print(f"   Total Amount: ৳{payment.amount}")
        print(f"   Remaining: ৳{payment.remaining_amount}")
        
        # Get payment details
        if payment.base_service_amount:
            print(f"   Base Service: ৳{payment.base_service_amount}")
        if payment.additional_bill_charges and payment.additional_bill_charges > 0:
            print(f"   Gas Fee: ৳{payment.additional_bill_charges}")
        if payment.penalty_amount and payment.penalty_amount > 0:
            print(f"   Late Fee: ৳{payment.penalty_amount}")
        
        # Get billing history
        billings = ServiceFeeBilling.objects.filter(
            servicefeepaymentid_id=payment.id
        ).order_by('payment_date')
        
        if billings.exists():
            print(f"   Payment History:")
            for billing in billings:
                print(f"      - {billing.payment_date.strftime('%Y-%m-%d')}: ৳{billing.total_paid} via {billing.other_method_name or 'N/A'}")
    
    # Check for advance payments
    print(f"\n{'='*80}")
    advances = AdvancePayment.objects.filter(
        unit_id=unit.id,
        status__in=['available', 'partial']
    ).order_by('-created_at')
    
    if advances.exists():
        print(f"\n💰 ADVANCE PAYMENTS: {advances.count()}")
        total_advance = Decimal('0')
        for advance in advances:
            print(f"\n   Advance ID: {advance.id}")
            print(f"   Amount: ৳{advance.amount}")
            print(f"   Remaining: ৳{advance.remaining_amount}")
            print(f"   Type: {advance.advance_type}")
            print(f"   Status: {advance.status}")
            print(f"   Created: {advance.created_at.strftime('%Y-%m-%d %H:%M')}")
            if advance.notes:
                print(f"   Notes: {advance.notes}")
            total_advance += Decimal(str(advance.remaining_amount))
        
        print(f"\n   Total Advance Balance: ৳{total_advance}")
    else:
        print(f"\n💰 ADVANCE PAYMENTS: None")
    
    # Summary
    print(f"\n{'='*80}")
    print(f"SUMMARY FOR {tower_name}, UNIT {unit.unit_name}")
    print(f"{'='*80}")
    print(f"Total Months: {all_payments.count()}")
    print(f"Months Paid: {paid_payments.count()}")
    print(f"Months Partial: {partial_payments.count()}")
    print(f"Months Due: {due_payments.count()}")
    print(f"Current Balance: ৳{total_remaining}")
    if advances.exists():
        print(f"Advance Balance: ৳{total_advance}")

if __name__ == '__main__':
    try:
        check_unit_301()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
