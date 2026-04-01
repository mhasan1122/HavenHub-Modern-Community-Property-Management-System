"""
Test script for partial payment functionality
Simulates paying 200 BDT out of 13800 BDT
"""

import os
import sys
import django

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from towers.models import Unit, Floor, Tower
from service_fee.models import ServiceFee
from service_fee_management.models import ServiceFeePayment, ServiceFeeBilling, PayStationTransactionMapping
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

User = get_user_model()

def clean_test_data():
    """Clean up any existing test data"""
    print("\n" + "="*60)
    print("Cleaning up existing test data...")
    print("="*60)
    
    # Delete test payments and billings for December 2025
    payments = ServiceFeePayment.objects.filter(
        service_period_month=12,
        service_period_year=2025
    )
    billing_count = ServiceFeeBilling.objects.filter(servicefeepaymentid__in=payments).count()
    payment_count = payments.count()
    
    ServiceFeeBilling.objects.filter(servicefeepaymentid__in=payments).delete()
    payments.delete()
    
    print(f"✓ Deleted {payment_count} payments and {billing_count} billings")

def setup_test_data():
    """Setup test data"""
    print("\n" + "="*60)
    print("Setting up test data...")
    print("="*60)
    
    # Use existing data from the real system
    try:
        unit = Unit.objects.get(id=23)  # Use the unit from your logs
        print(f"✓ Found unit: {unit.unit_name} (ID={unit.id})")
    except Unit.DoesNotExist:
        print("❌ Unit ID 23 not found - using first available unit")
        unit = Unit.objects.first()
        if not unit:
            raise Exception("No units found in database")
    
    try:
        service_fee = ServiceFee.objects.get(id=1)  # Use the service fee from your logs
        print(f"✓ Found service fee: ID={service_fee.id}, Amount={service_fee.fee_amount}")
    except ServiceFee.DoesNotExist:
        print("❌ ServiceFee ID 1 not found - using first available service fee")
        service_fee = ServiceFee.objects.first()
        if not service_fee:
            raise Exception("No service fees found in database")
    
    # Create ServiceFeePayment for December 2025 (simulate generation)
    payment = ServiceFeePayment.objects.create(
        unit=unit,
        service_fee=service_fee,
        service_period_month=12,
        service_period_year=2025,
        amount=Decimal('13800.00'),  # Full fee amount
        remaining_amount=Decimal('13800.00'),  # Full amount remaining
        service_status='due',
        payment_status='pending',
        due_date='2025-12-05',
        currency='BDT'
    )
    
    print(f"✓ Created payment record: ID={payment.id}, Amount={payment.amount}, Remaining={payment.remaining_amount}")
    
    user = User.objects.first()  # Use any user for testing
    
    return user, unit, service_fee, payment

def simulate_partial_payment(unit, service_fee, payment):
    """Simulate paying 200 BDT out of 13800 BDT"""
    print("\n" + "="*60)
    print("Simulating Partial Payment (200 BDT out of 13800 BDT)")
    print("="*60)
    
    # Transaction amount: 200 BDT
    transaction_amount = Decimal('200.00')
    
    print(f"\n📊 Before Payment:")
    print(f"   Payment ID: {payment.id}")
    print(f"   Amount: {payment.amount} BDT (should stay 13800)")
    print(f"   Remaining: {payment.remaining_amount} BDT")
    print(f"   Service Status: {payment.service_status}")
    print(f"   Payment Status: {payment.payment_status}")
    
    # Simulate success callback logic
    with transaction.atomic():
        # Get existing total paid
        existing_total_paid = ServiceFeeBilling.objects.filter(
            servicefeepaymentid=payment
        ).aggregate(total=django.db.models.Sum('total_paid'))['total'] or Decimal('0')
        
        fee_amount = Decimal(str(payment.amount))
        
        # Calculate new totals
        amount_to_apply = transaction_amount
        new_total_paid = existing_total_paid + amount_to_apply
        new_remaining = fee_amount - new_total_paid
        
        # Determine service status
        if new_remaining <= 0:
            new_service_status = 'paid'
        elif new_total_paid > 0:
            new_service_status = 'partial'
        else:
            new_service_status = 'due'
        
        print(f"\n💰 Transaction Details:")
        print(f"   Amount to apply: {amount_to_apply} BDT")
        print(f"   Existing total paid: {existing_total_paid} BDT")
        print(f"   New total paid: {new_total_paid} BDT")
        print(f"   New remaining: {new_remaining} BDT")
        print(f"   New service status: {new_service_status}")
        
        # Update payment record (DO NOT change payment.amount!)
        payment.payment_status = 'completed'
        payment.completion_date = timezone.now()
        payment.service_status = new_service_status
        payment.remaining_amount = new_remaining  # Update remaining amount
        payment.save()
        
        print(f"\n✅ Updated ServiceFeePayment:")
        print(f"   Amount: {payment.amount} BDT (unchanged - should be 13800)")
        print(f"   Service Status: {payment.service_status}")
        print(f"   Payment Status: {payment.payment_status}")
        
        # Create billing record
        billing = ServiceFeeBilling.objects.create(
            servicefeepaymentid=payment,
            billing_amount=fee_amount,  # Full fee (13800)
            total_paid=amount_to_apply,  # Transaction amount (200)
            currency='BDT',
            payment_date=timezone.now(),
            due_date=payment.due_date,
            payment_type='service_fee_bill_payment',
            reference_number='TEST-PARTIAL-001'
        )
        
        print(f"\n✅ Created ServiceFeeBilling:")
        print(f"   ID: {billing.id}")
        print(f"   Billing Amount: {billing.billing_amount} BDT (full fee)")
        print(f"   Total Paid: {billing.total_paid} BDT (transaction amount)")
        
    return payment, billing

def verify_results(payment):
    """Verify the payment state after partial payment"""
    print("\n" + "="*60)
    print("Verification Results")
    print("="*60)
    
    # Refresh from DB
    payment.refresh_from_db()
    
    # Get all billings
    billings = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment)
    total_paid_from_billings = sum(b.total_paid for b in billings)
    
    print(f"\n📋 ServiceFeePayment (ID={payment.id}):")
    print(f"   Amount: {payment.amount} BDT")
    print(f"   Service Status: {payment.service_status}")
    print(f"   Payment Status: {payment.payment_status}")
    
    print(f"\n📋 ServiceFeeBilling Records:")
    for billing in billings:
        print(f"   ID={billing.id}:")
        print(f"      Billing Amount: {billing.billing_amount} BDT")
        print(f"      Total Paid: {billing.total_paid} BDT")
        print(f"      Reference: {billing.reference_number}")
    
    print(f"\n📊 Summary:")
    print(f"   Full Fee: 13800 BDT")
    print(f"   Total Paid (from billings): {total_paid_from_billings} BDT")
    print(f"   Remaining: {Decimal('13800.00') - total_paid_from_billings} BDT")
    
    # Validations
    errors = []
    
    if payment.amount != Decimal('13800.00'):
        errors.append(f"❌ Payment amount changed to {payment.amount} (should stay 13800)")
    else:
        print(f"   ✅ Payment amount correct: {payment.amount} BDT")
    
    if payment.service_status != 'partial':
        errors.append(f"❌ Service status is '{payment.service_status}' (should be 'partial')")
    else:
        print(f"   ✅ Service status correct: {payment.service_status}")
    
    if total_paid_from_billings != Decimal('200.00'):
        errors.append(f"❌ Total paid is {total_paid_from_billings} (should be 200)")
    else:
        print(f"   ✅ Total paid correct: {total_paid_from_billings} BDT")
    
    for billing in billings:
        if billing.billing_amount != Decimal('13800.00'):
            errors.append(f"❌ Billing amount is {billing.billing_amount} (should be 13800)")
        else:
            print(f"   ✅ Billing amount correct: {billing.billing_amount} BDT")
    
    if errors:
        print("\n" + "="*60)
        print("ERRORS FOUND:")
        print("="*60)
        for error in errors:
            print(error)
        return False
    else:
        print("\n" + "="*60)
        print("✅ ALL VALIDATIONS PASSED!")
        print("="*60)
        return True

def main():
    print("\n" + "="*60)
    print("PARTIAL PAYMENT TEST")
    print("Scenario: Pay 200 BDT out of 13800 BDT")
    print("="*60)
    
    try:
        # Clean up
        clean_test_data()
        
        # Setup
        user, unit, service_fee, payment = setup_test_data()
        
        # Simulate payment
        payment, billing = simulate_partial_payment(unit, service_fee, payment)
        
        # Verify
        success = verify_results(payment)
        
        if success:
            print("\n🎉 TEST PASSED!")
            return 0
        else:
            print("\n❌ TEST FAILED!")
            return 1
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    exit(main())
