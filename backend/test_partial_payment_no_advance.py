#!/usr/bin/env python
"""
Test script to verify that advance payment is NOT created when there are partial payments
Scenario: User pays ৳12,000 for December (৳6,450) + January (৳6,450)
Expected: December = Paid, January = Partial (৳900 remaining), Advance = ৳0
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
from decimal import Decimal

def test_partial_payment_scenario():
    """
    Test the scenario where payment is less than total due
    Should NOT create advance payment
    """
    print("\n" + "="*80)
    print("TESTING PARTIAL PAYMENT SCENARIO - NO ADVANCE SHOULD BE CREATED")
    print("="*80)
    
    # Test configuration
    UNIT_ID = 23
    SERVICE_FEE_ID = 2
    DECEMBER_MONTH = 12
    DECEMBER_YEAR = 2025
    JANUARY_MONTH = 1
    JANUARY_YEAR = 2026
    PAYMENT_AMOUNT = Decimal('12000.00')  # Less than total due
    
    try:
        # Get unit and service fee
        unit = Unit.objects.get(id=UNIT_ID)
        service_fee = ServiceFee.objects.get(id=SERVICE_FEE_ID)
        
        print(f"\n📋 Test Setup:")
        print(f"   Unit: {unit.unit_name}")
        print(f"   Service Fee: {service_fee.fee_name}")
        print(f"   Payment Amount: ৳{PAYMENT_AMOUNT}")
        
        # Check December payment
        dec_payment = ServiceFeePayment.objects.filter(
            unit_id=UNIT_ID,
            service_fee_id=SERVICE_FEE_ID,
            service_period_month=DECEMBER_MONTH,
            service_period_year=DECEMBER_YEAR
        ).first()
        
        # Check January payment
        jan_payment = ServiceFeePayment.objects.filter(
            unit_id=UNIT_ID,
            service_fee_id=SERVICE_FEE_ID,
            service_period_month=JANUARY_MONTH,
            service_period_year=JANUARY_YEAR
        ).first()
        
        if not dec_payment or not jan_payment:
            print(f"\n⚠️ Test skipped - Payment records not found")
            print(f"   December payment: {'Found' if dec_payment else 'Not found'}")
            print(f"   January payment: {'Found' if jan_payment else 'Not found'}")
            return
        
        print(f"\n✅ Payment Records Found:")
        print(f"   December: ID={dec_payment.id}, Amount=৳{dec_payment.amount}, Status={dec_payment.service_status}")
        print(f"   January: ID={jan_payment.id}, Amount=৳{jan_payment.amount}, Status={jan_payment.service_status}")
        
        # Calculate totals
        dec_total_due = dec_payment.amount
        jan_total_due = jan_payment.amount
        total_due = dec_total_due + jan_total_due
        
        print(f"\n💰 Payment Analysis:")
        print(f"   December due: ৳{dec_total_due}")
        print(f"   January due: ৳{jan_total_due}")
        print(f"   Total due: ৳{total_due}")
        print(f"   Payment made: ৳{PAYMENT_AMOUNT}")
        print(f"   Difference: ৳{total_due - PAYMENT_AMOUNT}")
        
        # Calculate total paid
        dec_total_paid = ServiceFeeBilling.objects.filter(
            servicefeepaymentid=dec_payment
        ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
        
        jan_total_paid = ServiceFeeBilling.objects.filter(
            servicefeepaymentid=jan_payment
        ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
        
        print(f"\n📊 Current Payment Status:")
        print(f"   December paid: ৳{dec_total_paid}, Remaining: ৳{dec_total_due - dec_total_paid}, Status: {dec_payment.service_status}")
        print(f"   January paid: ৳{jan_total_paid}, Remaining: ৳{jan_total_due - jan_total_paid}, Status: {jan_payment.service_status}")
        
        # Check for advance payments
        advance_payments = AdvancePayment.objects.filter(
            unit_id=UNIT_ID,
            status__in=['available', 'partial']
        )
        
        total_advance = advance_payments.aggregate(
            total=Sum('remaining_amount')
        )['total'] or Decimal('0')
        
        print(f"\n🎯 Advance Payment Check:")
        print(f"   Number of advance records: {advance_payments.count()}")
        print(f"   Total advance balance: ৳{total_advance}")
        
        if advance_payments.exists():
            print(f"\n   Advance Details:")
            for adv in advance_payments:
                print(f"   - ID={adv.id}, Amount=৳{adv.amount}, Remaining=৳{adv.remaining_amount}, Type={adv.advance_type}")
        
        # Verify expectations
        print(f"\n✅ TEST RESULTS:")
        
        # Check if there's a partial payment
        has_partial = (dec_payment.service_status == 'partial' or jan_payment.service_status == 'partial')
        
        if has_partial and total_advance > 0:
            print(f"   ❌ FAIL: Advance payment exists (৳{total_advance}) despite partial payments")
            print(f"   This violates the rule: Advance only created when ALL bills fully paid")
        elif has_partial and total_advance == 0:
            print(f"   ✅ PASS: No advance payment created (partial payment exists)")
        elif not has_partial and total_advance > 0:
            print(f"   ✅ PASS: Advance payment created (all bills fully paid)")
        else:
            print(f"   ✅ PASS: No advance payment (no overpayment)")
        
    except Exception as e:
        print(f"\n❌ Test Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    from django.db.models import Sum
    test_partial_payment_scenario()
