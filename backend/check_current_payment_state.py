#!/usr/bin/env python
"""
Script to check the current payment state for the unit with 9120 taka balance
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
    ServiceFee
)
from towers.models import Unit
from django.db.models import Sum, Q
from decimal import Decimal

def check_payment_state():
    """
    Check current payment state to understand the 9120 taka balance
    """
    print("\n" + "="*80)
    print("CHECKING CURRENT PAYMENT STATE")
    print("="*80)
    
    # Find units with approximately 9120 balance
    print("\n🔍 Searching for units with ~9120 taka balance...")
    
    # Get all pending/partial payments
    pending_payments = ServiceFeePayment.objects.filter(
        Q(service_status__in=['due', 'partial', 'overdue']) |
        Q(remaining_amount__gt=0)
    ).select_related('unit', 'service_fee').order_by('unit_id', 'service_period_year', 'service_period_month')
    
    # Group by unit and calculate total remaining
    unit_balances = {}
    for payment in pending_payments:
        tower_name = payment.unit.floor.tower.tower_name if payment.unit and payment.unit.floor and payment.unit.floor.tower else 'Unknown'
        unit_key = f"{tower_name}, {payment.unit.unit_name}"
        if unit_key not in unit_balances:
            unit_balances[unit_key] = {
                'unit_id': payment.unit_id,
                'unit_name': payment.unit.unit_name,
                'tower_name': tower_name,
                'service_fee_id': payment.service_fee_id,
                'total_remaining': Decimal('0'),
                'payments': []
            }
        
        remaining = Decimal(str(payment.remaining_amount or 0))
        unit_balances[unit_key]['total_remaining'] += remaining
        unit_balances[unit_key]['payments'].append({
            'id': payment.id,
            'month': payment.service_period_month,
            'year': payment.service_period_year,
            'amount': payment.amount,
            'remaining_amount': payment.remaining_amount,
            'service_status': payment.service_status,
            'payment_status': payment.payment_status
        })
    
    # Find units with balance close to 9120
    target_balance = Decimal('9120')
    tolerance = Decimal('500')  # ±500 taka
    
    matching_units = []
    for unit_key, data in unit_balances.items():
        if abs(data['total_remaining'] - target_balance) <= tolerance:
            matching_units.append((unit_key, data))
    
    if not matching_units:
        print(f"\n⚠️ No units found with balance ~{target_balance} taka")
        print(f"\nShowing all units with pending payments:")
        for unit_key, data in sorted(unit_balances.items(), key=lambda x: x[1]['total_remaining'], reverse=True)[:10]:
            print(f"\n   {unit_key}:")
            print(f"   Total Remaining: ৳{data['total_remaining']}")
    else:
        print(f"\n✅ Found {len(matching_units)} unit(s) with balance ~{target_balance}:")
        
        for unit_key, data in matching_units:
            print(f"\n{'='*80}")
            print(f"Unit: {unit_key}")
            print(f"Unit ID: {data['unit_id']}")
            print(f"Service Fee ID: {data['service_fee_id']}")
            print(f"Total Remaining: ৳{data['total_remaining']}")
            print(f"{'='*80}")
            
            print(f"\n📋 Payment Details:")
            for payment in data['payments']:
                print(f"\n   {payment['month']:02d}/{payment['year']}:")
                print(f"      Payment ID: {payment['id']}")
                print(f"      Total Amount: ৳{payment['amount']}")
                print(f"      Remaining: ৳{payment['remaining_amount']}")
                print(f"      Service Status: {payment['service_status']}")
                print(f"      Payment Status: {payment['payment_status']}")
                
                # Get billing history for this payment
                billings = ServiceFeeBilling.objects.filter(
                    servicefeepaymentid_id=payment['id']
                ).order_by('-payment_date')
                
                if billings.exists():
                    print(f"      Billing History:")
                    total_paid = Decimal('0')
                    for billing in billings:
                        print(f"         - Date: {billing.payment_date.strftime('%Y-%m-%d')}, Paid: ৳{billing.total_paid}, Method: {billing.other_method_name or 'N/A'}")
                        total_paid += Decimal(str(billing.total_paid))
                    print(f"      Total Paid (from billings): ৳{total_paid}")
            
            # Check for advance payments
            advance_payments = AdvancePayment.objects.filter(
                unit_id=data['unit_id'],
                status__in=['available', 'partial']
            ).order_by('-created_at')
            
            if advance_payments.exists():
                print(f"\n💰 Advance Payments:")
                total_advance = Decimal('0')
                for adv in advance_payments:
                    print(f"   - ID={adv.id}, Amount=৳{adv.amount}, Remaining=৳{adv.remaining_amount}, Type={adv.advance_type}")
                    total_advance += Decimal(str(adv.remaining_amount))
                print(f"   Total Advance: ৳{total_advance}")
            else:
                print(f"\n   No advance payments")
            
            # Simulate payment of 9000
            print(f"\n{'='*80}")
            print(f"SIMULATING PAYMENT OF ৳9,000")
            print(f"{'='*80}")
            
            remaining_to_distribute = Decimal('9000')
            print(f"\nAmount to distribute: ৳{remaining_to_distribute}")
            print(f"\nDistribution (oldest first):")
            
            for idx, payment in enumerate(sorted(data['payments'], key=lambda p: (p['year'], p['month']))):
                payment_remaining = Decimal(str(payment['remaining_amount']))
                
                if remaining_to_distribute >= payment_remaining:
                    # Full payment
                    amount_applied = payment_remaining
                    new_remaining = Decimal('0')
                    new_status = 'paid'
                    remaining_to_distribute -= payment_remaining
                elif remaining_to_distribute > 0:
                    # Partial payment
                    amount_applied = remaining_to_distribute
                    new_remaining = payment_remaining - remaining_to_distribute
                    new_status = 'partial'
                    remaining_to_distribute = Decimal('0')
                else:
                    # No payment
                    amount_applied = Decimal('0')
                    new_remaining = payment_remaining
                    new_status = payment['service_status']
                
                status_icon = "✅" if new_status == 'paid' else "⚠️" if new_status == 'partial' else "❌"
                print(f"\n   {status_icon} {payment['month']:02d}/{payment['year']}:")
                print(f"      Previous Remaining: ৳{payment_remaining}")
                print(f"      Amount Applied: ৳{amount_applied}")
                print(f"      New Remaining: ৳{new_remaining}")
                print(f"      New Status: {new_status.upper()}")
            
            print(f"\n🎯 RESULT:")
            print(f"   Remaining after distribution: ৳{remaining_to_distribute}")
            
            # Check if all bills are fully paid
            all_paid = all(
                Decimal(str(p['remaining_amount'])) <= remaining_to_distribute or 
                Decimal(str(p['remaining_amount'])) == Decimal('0')
                for p in data['payments']
            )
            
            if remaining_to_distribute > 0:
                # Calculate if all bills would be paid
                total_due = sum(Decimal(str(p['remaining_amount'])) for p in data['payments'])
                if Decimal('9000') >= total_due:
                    print(f"   ✅ All bills fully paid")
                    print(f"   ✅ Excess amount: ৳{remaining_to_distribute}")
                    print(f"   ✅ Advance payment SHOULD be created: ৳{remaining_to_distribute}")
                else:
                    print(f"   ⚠️ Partial payment exists")
                    print(f"   ⚠️ Advance payment should NOT be created")
            else:
                print(f"   ⚠️ All payment distributed, some bills may be partial")
                print(f"   ⚠️ Advance payment should NOT be created (partial payments exist)")

if __name__ == '__main__':
    try:
        check_payment_state()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
