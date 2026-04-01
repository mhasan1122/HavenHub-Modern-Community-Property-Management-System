#!/usr/bin/env python
"""
Test script to verify 2nd payment email calculation and send test email
Tests the progressive Original Amount calculation: (fee_amount - total_paid_before) - current_payment
"""
import os
import sys
import django
from decimal import Decimal

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db.models import Sum
from service_fee_management.models import ServiceFeePayment, ServiceFeeBilling, PaymentMethod
from service_fee.models import ServiceFee
from towers.models import Unit, Tower, Floor
from user.models import Member
from service_fee_management.serializers import ServiceFeePaymentSerializer
from service_fee_management.views import send_payment_email_if_enabled
from datetime import datetime

print("\n" + "="*80)
print("🧪 TESTING 2ND PAYMENT EMAIL CALCULATION")
print("="*80)

# Test email address
TEST_EMAIL = "mirzahasanlimon619@gmail.com"

try:
    # Step 1: Find or create test data
    print("\n📋 Step 1: Setting up test data...")
    
    # Find an existing unit (or create one)
    unit = Unit.objects.first()
    if not unit:
        print("❌ No units found in database. Please create a unit first.")
        sys.exit(1)
    
    print(f"   ✓ Using Unit: {unit.unit_name} (ID: {unit.id})")
    print(f"   ✓ Tower: {unit.floor.tower.tower_name if unit.floor else 'N/A'}")
    
    # Find or create a service fee
    service_fee = ServiceFee.objects.first()
    if not service_fee:
        print("❌ No service fees found in database. Please create a service fee first.")
        sys.exit(1)
    
    print(f"   ✓ Service Fee: {service_fee.fee_amount} {service_fee.currency} (ID: {service_fee.id})")
    
    # Find or create payment method
    payment_method = PaymentMethod.objects.filter(is_active=True).first()
    if not payment_method:
        payment_method = PaymentMethod.objects.create(
            method_name="Cash",
            is_active=True,
            display_order=1
        )
    
    print(f"   ✓ Payment Method: {payment_method.method_name}")
    
    # Step 2: Check for existing payments for October 2025
    test_month = 10  # October
    test_year = 2025
    
    print(f"\n📋 Step 2: Checking existing payments for {test_month}/{test_year}...")
    
    existing_payments = ServiceFeePayment.objects.filter(
        unit_id=unit.id,
        service_fee_id=service_fee.id,
        service_period_month=test_month,
        service_period_year=test_year
    ).order_by('created_at')
    
    print(f"   Found {existing_payments.count()} existing payment(s)")
    
    # If there are already 2+ payments, delete them for clean test
    if existing_payments.count() >= 2:
        print(f"   ⚠️  Found existing payments. Deleting for clean test...")
        for payment in existing_payments:
            # Delete billing records first
            ServiceFeeBilling.objects.filter(servicefeepaymentid=payment).delete()
            payment.delete()
        print(f"   ✓ Deleted existing payments")
        existing_payments = ServiceFeePayment.objects.filter(
            unit_id=unit.id,
            service_fee_id=service_fee.id,
            service_period_month=test_month,
            service_period_year=test_year
        ).order_by('created_at')
    
    # Step 3: Create first payment if it doesn't exist
    first_payment = None
    fee_amount = Decimal(str(service_fee.fee_amount))
    first_payment_amount = Decimal('20000.00')
    
    # Adjust first payment if fee is less
    if fee_amount < first_payment_amount:
        first_payment_amount = fee_amount * Decimal('0.5')  # 50% of fee
        print(f"   ⚠️  Service fee ({fee_amount}) is less than 20k, adjusting 1st payment to: {first_payment_amount}")
    
    if existing_payments.count() == 0:
        print(f"\n📋 Step 3: Creating 1st payment (Tk {first_payment_amount})...")
        
        first_payment = ServiceFeePayment.objects.create(
            unit=unit,
            service_fee=service_fee,
            service_period_month=test_month,
            service_period_year=test_year,
            amount=first_payment_amount,
            remaining_amount=max(Decimal('0'), fee_amount - first_payment_amount),
            payment_status='pending',
            service_status='partial',
            currency='BDT',
            due_date=datetime.now().date(),
            created_by=Member.objects.first() if Member.objects.exists() else None
        )
        
        # Create billing record (let model auto-generate IDs)
        first_billing = ServiceFeeBilling(
            servicefeepaymentid=first_payment,
            billing_amount=fee_amount,
            total_paid=first_payment_amount,
            payment_method=payment_method,
            payment_date=datetime.now(),
            currency='BDT'
        )
        # Set to None to trigger auto-generation in save()
        first_billing.transaction_id = None
        first_billing.receipt_id = None
        first_billing.billing_id = None
        first_billing.save()  # This will auto-generate transaction_id, receipt_id, billing_id
        
        print(f"   ✓ Created 1st payment: ID {first_payment.id}, Amount: Tk {first_payment.amount}")
    else:
        first_payment = existing_payments.first()
        first_payment_amount = first_payment.amount
        print(f"   ✓ Using existing 1st payment: ID {first_payment.id}, Amount: Tk {first_payment.amount}")
    
    # Step 4: Calculate what should be paid before 2nd payment
    total_paid_before = ServiceFeePayment.objects.filter(
        unit_id=unit.id,
        service_fee_id=service_fee.id,
        service_period_month=test_month,
        service_period_year=test_year
    ).exclude(id=first_payment.id).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    
    print(f"\n📊 Calculation Check:")
    print(f"   Fee Amount: Tk {service_fee.fee_amount}")
    print(f"   Total paid before 2nd payment: Tk {float(total_paid_before)}")
    print(f"   Amount owed before 2nd payment: Tk {float(service_fee.fee_amount) - float(total_paid_before)}")
    
    # Step 5: Create 2nd payment
    # Adjust payment amount based on service fee amount
    fee_amount = Decimal(str(service_fee.fee_amount))
    first_payment_amount = Decimal('20000.00')
    
    # If fee is less than 20k, use smaller amounts
    if fee_amount < first_payment_amount:
        first_payment_amount = fee_amount * Decimal('0.5')  # 50% of fee
        print(f"   ⚠️  Service fee ({fee_amount}) is less than 20k, adjusting 1st payment to: {first_payment_amount}")
    
    second_payment_amount = min(Decimal('80000.00'), fee_amount - first_payment_amount)
    if second_payment_amount <= 0:
        second_payment_amount = fee_amount - first_payment_amount
        if second_payment_amount <= 0:
            print(f"   ⚠️  Cannot create 2nd payment - fee already fully paid")
            sys.exit(1)
    
    print(f"\n📋 Step 4: Creating 2nd payment (Tk {second_payment_amount})...")
    
    amount_owed_before = fee_amount - Decimal(str(total_paid_before))
    expected_original_amount = amount_owed_before - second_payment_amount
    
    print(f"   Expected Original Amount in email: Tk {float(expected_original_amount)}")
    print(f"   (Calculation: {float(amount_owed_before)} - {float(second_payment_amount)} = {float(expected_original_amount)})")
    
    second_payment = ServiceFeePayment.objects.create(
        unit=unit,
        service_fee=service_fee,
        service_period_month=test_month,
        service_period_year=test_year,
        amount=second_payment_amount,
        remaining_amount=max(Decimal('0'), fee_amount - first_payment_amount - second_payment_amount),
        payment_status='pending',
        service_status='partial',
        currency='BDT',
        due_date=datetime.now().date(),
        created_by=Member.objects.first() if Member.objects.exists() else None
    )
    
    # Create billing record for 2nd payment (let model auto-generate IDs)
    second_billing = ServiceFeeBilling(
        servicefeepaymentid=second_payment,
        billing_amount=fee_amount,
        total_paid=second_payment_amount,
        payment_method=payment_method,
        payment_date=datetime.now(),
        currency='BDT'
    )
    # Set to None to trigger auto-generation in save()
    second_billing.transaction_id = None
    second_billing.receipt_id = None
    second_billing.billing_id = None
    second_billing.save()  # This will auto-generate transaction_id, receipt_id, billing_id
    
    print(f"   ✓ Created 2nd payment: ID {second_payment.id}, Amount: Tk {second_payment.amount}")
    
    # Step 6: Get payment data and test email calculation
    print(f"\n📋 Step 5: Preparing email data...")
    
    payment_serializer = ServiceFeePaymentSerializer(second_payment)
    payment_data = payment_serializer.data
    
    print(f"\n📊 Payment Data:")
    print(f"   Payment ID: {second_payment.id}")
    print(f"   Amount: Tk {payment_data.get('amount')}")
    print(f"   Service Period: {test_month}/{test_year}")
    print(f"   Unit: {unit.unit_name}")
    
    # Step 7: Test email calculation (this will be done in send_payment_email_if_enabled)
    print(f"\n📋 Step 6: Testing email calculation and sending email...")
    print(f"   Recipient: {TEST_EMAIL}")
    
    # Update unit email for testing
    original_primary_email = unit.primary_email
    original_secondary_email = unit.secondary_email
    unit.primary_email = TEST_EMAIL
    unit.save()
    print(f"   ✓ Updated unit primary_email to: {TEST_EMAIL}")
    
    # Send email
    email_sent = send_payment_email_if_enabled(
        payment_obj=second_payment,
        payment_data=payment_data,
        send_email=True,
        operation_type="2nd payment test"
    )
    
    if email_sent:
        print(f"\n✅ EMAIL SENT SUCCESSFULLY!")
        print(f"   Check inbox: {TEST_EMAIL}")
        print(f"   (Also check spam folder)")
    else:
        print(f"\n❌ Email sending failed!")
    
    # Step 8: Verify calculation
    print(f"\n📊 Final Verification:")
    print(f"   Fee Amount: Tk {service_fee.fee_amount}")
    print(f"   1st Payment: Tk {first_payment.amount}")
    print(f"   2nd Payment: Tk {second_payment.amount}")
    print(f"   Total Paid: Tk {float(first_payment.amount) + float(second_payment.amount)}")
    print(f"   Remaining: Tk {float(service_fee.fee_amount) - float(first_payment.amount) - float(second_payment.amount)}")
    print(f"\n   Expected Original Amount in 2nd payment email: Tk {float(expected_original_amount):,.2f}")
    print(f"   (Calculation: ({float(service_fee.fee_amount)} - {float(first_payment.amount)}) - {float(second_payment.amount)} = {float(expected_original_amount):,.2f})")
    
    # Restore original email if we changed it
    if 'original_primary_email' in locals():
        unit.primary_email = original_primary_email
        unit.secondary_email = original_secondary_email
        unit.save()
        print(f"   ✓ Restored original unit email")
    
    print(f"\n" + "="*80)
    print("✅ TEST COMPLETED!")
    print("="*80)
    print(f"\n📧 Please check your email: {TEST_EMAIL}")
    print(f"   Verify that 'ORIGINAL AMOUNT' shows: Tk {float(expected_original_amount):,.2f}")
    print(f"   (Not Tk {float(service_fee.fee_amount):,.2f})")
    
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

