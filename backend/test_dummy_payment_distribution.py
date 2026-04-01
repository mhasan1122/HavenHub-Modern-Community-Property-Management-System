#!/usr/bin/env python
"""
Create dummy payment scenario and test distribution logic
Scenario: Dec (13,800) + Jan (13,800), Payment: 27,000
Expected: Dec PAID, Jan PARTIAL (600 remaining), Advance: 0
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
from towers.models import Unit, Tower
from django.db import transaction
from django.db.models import Sum
from decimal import Decimal
from django.utils import timezone

def create_dummy_scenario():
    print("\n" + "="*80)
    print("CREATING DUMMY PAYMENT SCENARIO")
    print("="*80)
    
    with transaction.atomic():
        # Use existing unit
        unit = Unit.objects.first()
        if not unit:
            print("❌ No unit found in database")
            return None, None, None, None
        
        # Use existing service fee
        service_fee = ServiceFee.objects.first()
        if not service_fee:
            print("❌ No service fee found in database")
            return None, None, None, None
        
        print(f"\n✅ Setup:")
        print(f"   Unit: {unit.unit_name} (ID: {unit.id})")
        print(f"   Service Fee: ID {service_fee.id} (Amount: ৳{service_fee.fee_amount})")
        
        # Clean up existing test payments for this scenario
        ServiceFeePayment.objects.filter(
            unit_id=unit.id, 
            service_fee_id=service_fee.id,
            service_period_month__in=[12, 1],
            service_period_year__in=[2025, 2026]
        ).delete()
        
        # Create December 2025 payment
        dec_payment = ServiceFeePayment.objects.create(
            unit_id=unit.id,
            service_fee_id=service_fee.id,
            service_period_month=12,
            service_period_year=2025,
            amount=Decimal('13800.00'),
            base_service_amount=Decimal('12000.00'),
            additional_bill_charges=Decimal('1200.00'),
            remaining_amount=Decimal('13800.00'),
            currency='BDT',
            payment_status='pending',
            service_status='due',
            due_date=timezone.now().date()
        )
        
        # Create January 2026 payment
        jan_payment = ServiceFeePayment.objects.create(
            unit_id=unit.id,
            service_fee_id=service_fee.id,
            service_period_month=1,
            service_period_year=2026,
            amount=Decimal('13800.00'),
            base_service_amount=Decimal('12000.00'),
            additional_bill_charges=Decimal('1200.00'),
            remaining_amount=Decimal('13800.00'),
            currency='BDT',
            payment_status='pending',
            service_status='due',
            due_date=timezone.now().date()
        )
        
        print(f"\n✅ Created Payment Records:")
        print(f"   December 2025: ID={dec_payment.id}, Amount=৳{dec_payment.amount}, Remaining=৳{dec_payment.remaining_amount}")
        print(f"   January 2026: ID={jan_payment.id}, Amount=৳{jan_payment.amount}, Remaining=৳{jan_payment.remaining_amount}")
        
        # Clean up any existing advance payments for this unit
        AdvancePayment.objects.filter(unit_id=unit.id).delete()
        
        return unit, service_fee, dec_payment, jan_payment


def test_payment_distribution():
    print("\n" + "="*80)
    print("TESTING PAYMENT DISTRIBUTION")
    print("="*80)
    
    try:
        # Create scenario
        unit, service_fee, dec_payment, jan_payment = create_dummy_scenario()
        
        # Payment amount
        total_payment = Decimal('27000.00')
        print(f"\n💰 Payment to Distribute: ৳{total_payment}")
        
        # Get payments in order (oldest first)
        payments = ServiceFeePayment.objects.filter(
            unit_id=unit.id,
            service_fee_id=service_fee.id
        ).order_by('service_period_year', 'service_period_month')
        
        print(f"\n📋 Processing {payments.count()} payments in order:")
        
        remaining_to_distribute = total_payment
        
        with transaction.atomic():
            for idx, payment in enumerate(payments, 1):
                print(f"\n{'='*60}")
                print(f"Payment {idx}: {payment.service_period_month}/{payment.service_period_year}")
                print(f"{'='*60}")
                
                # Get current state
                fee_amount = payment.amount
                existing_total_paid = ServiceFeeBilling.objects.filter(
                    servicefeepaymentid=payment
                ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
                
                actual_remaining = fee_amount - existing_total_paid
                
                print(f"   Fee Amount: ৳{fee_amount}")
                print(f"   Already Paid: ৳{existing_total_paid}")
                print(f"   Remaining: ৳{actual_remaining}")
                print(f"   Available to Distribute: ৳{remaining_to_distribute}")
                
                # Calculate how much to apply
                amount_to_apply = min(remaining_to_distribute, actual_remaining)
                
                print(f"   Amount to Apply: ৳{amount_to_apply}")
                
                if amount_to_apply <= 0:
                    print(f"   ⏩ Skipping (no amount to apply)")
                    continue
                
                # Calculate new state
                new_total_paid = existing_total_paid + amount_to_apply
                new_remaining = fee_amount - new_total_paid
                
                # Determine status
                if new_remaining <= 0:
                    new_status = 'paid'
                elif new_total_paid > 0:
                    new_status = 'partial'
                else:
                    new_status = 'due'
                
                print(f"   New Total Paid: ৳{new_total_paid}")
                print(f"   New Remaining: ৳{new_remaining}")
                print(f"   New Status: {new_status}")
                
                # Update payment
                payment.refresh_from_db()
                payment.service_status = new_status
                payment.remaining_amount = new_remaining
                if new_status == 'paid':
                    payment.payment_status = 'completed'
                    payment.completion_date = timezone.now()
                payment.save()
                
                # Create billing record
                billing = ServiceFeeBilling.objects.create(
                    servicefeepaymentid=payment,
                    billing_amount=fee_amount,
                    total_paid=amount_to_apply,
                    currency='BDT',
                    payment_date=timezone.now(),
                    payment_type='service_fee_bill_payment'
                )
                
                print(f"   ✅ Created billing record: ID={billing.id}")
                
                # Reduce remaining
                remaining_to_distribute -= amount_to_apply
                print(f"   Remaining to Distribute: ৳{remaining_to_distribute}")
            
            print(f"\n{'='*80}")
            print(f"FINAL DISTRIBUTION RESULT")
            print(f"{'='*80}")
            print(f"   Remaining to Distribute: ৳{remaining_to_distribute}")
            
            # Check if all payments are fully paid
            all_fully_paid = all(
                payment.service_status == 'paid' 
                for payment in payments
            )
            
            print(f"   All Payments Fully Paid: {all_fully_paid}")
            
            # Create advance if applicable
            if remaining_to_distribute > 0 and all_fully_paid:
                print(f"\n✅ Creating advance payment: ৳{remaining_to_distribute}")
                advance = AdvancePayment.objects.create(
                    unit_id=unit.id,
                    amount=remaining_to_distribute,
                    remaining_amount=remaining_to_distribute,
                    status='available',
                    advance_type='overpayment'
                )
                print(f"   Advance ID: {advance.id}")
            elif remaining_to_distribute > 0:
                print(f"\n⚠️ Partial payment exists - NO advance created")
                print(f"   Excess amount: ৳{remaining_to_distribute}")
            else:
                print(f"\n✅ No excess amount")
        
        # Display final results
        print(f"\n{'='*80}")
        print(f"FINAL PAYMENT STATUS")
        print(f"{'='*80}")
        
        for payment in payments:
            total_paid = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=payment
            ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
            
            status_icon = "✅" if payment.service_status == 'paid' else "⚠️" if payment.service_status == 'partial' else "❌"
            
            print(f"\n{status_icon} {payment.service_period_month}/{payment.service_period_year}:")
            print(f"   Amount: ৳{payment.amount}")
            print(f"   Total Paid: ৳{total_paid}")
            print(f"   Remaining: ৳{payment.remaining_amount}")
            print(f"   Status: {payment.service_status.upper()}")
        
        # Check advance
        advances = AdvancePayment.objects.filter(
            unit_id=unit.id,
            status='available'
        )
        
        total_advance = advances.aggregate(total=Sum('remaining_amount'))['total'] or Decimal('0')
        
        print(f"\n💰 Advance Balance: ৳{total_advance}")
        
        # Validation
        print(f"\n{'='*80}")
        print(f"VALIDATION")
        print(f"{'='*80}")
        
        dec_payment.refresh_from_db()
        jan_payment.refresh_from_db()
        
        assert dec_payment.service_status == 'paid', f"December should be PAID, got {dec_payment.service_status}"
        assert dec_payment.remaining_amount == 0, f"December remaining should be 0, got {dec_payment.remaining_amount}"
        
        assert jan_payment.service_status == 'partial', f"January should be PARTIAL, got {jan_payment.service_status}"
        assert jan_payment.remaining_amount == Decimal('600'), f"January remaining should be 600, got {jan_payment.remaining_amount}"
        
        assert total_advance == 0, f"Advance should be 0, got {total_advance}"
        
        print(f"✅ December: PAID (remaining ৳0)")
        print(f"✅ January: PARTIAL (remaining ৳600)")
        print(f"✅ Advance: ৳0 (correct - no advance created)")
        
        print(f"\n🎉 ALL VALIDATIONS PASSED!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_payment_distribution()
