"""
Test script for updated ServiceFeePayment model with service_status
"""

from service_fee.models import ServiceFee, ServiceFeePayment
from user.models import Member
from towers.models import Unit
from decimal import Decimal
import datetime

print("Testing updated ServiceFeePayment model with service_status...")

# Get test data
service_fees = ServiceFee.objects.all()
members = Member.objects.all()
units = Unit.objects.all()

if service_fees.exists() and members.exists() and units.exists():
    service_fee = service_fees.first()
    resident = members.first()
    unit = units.first()
    
    print(f"Service fee amount: {service_fee.fee_amount} {service_fee.currency}")
    
    # Test 1: Partial payment
    try:
        partial_payment = ServiceFeePayment.objects.create(
            service_fee=service_fee,
            resident=resident,
            unit=unit,
            amount=Decimal(str(float(service_fee.fee_amount) * 0.5)),  # 50% payment
            currency='BDT',
            payment_method='bkash',
            payment_status='completed',
            due_date=datetime.date.today(),
            service_period_month=10,
            service_period_year=2025,
            reference_number='PARTIAL123',
            notes='Partial payment test',
            created_by=resident
        )
        
        print(f"\n✅ Partial payment created:")
        print(f"   Amount: {partial_payment.amount} {partial_payment.currency}")
        print(f"   Service Status: {partial_payment.service_status}")
        print(f"   Service Status Display: {partial_payment.service_status_display}")
        print(f"   Payment Percentage: {partial_payment.get_payment_percentage()}%")
        print(f"   Outstanding Amount: {partial_payment.get_outstanding_amount()}")
        print(f"   Is Fully Paid: {partial_payment.is_fully_paid}")
        print(f"   Is Partial Payment: {partial_payment.is_partial_payment}")
        
        partial_payment.delete()
        
    except Exception as e:
        print(f"❌ Error with partial payment: {e}")
    
    # Test 2: Full payment
    try:
        full_payment = ServiceFeePayment.objects.create(
            service_fee=service_fee,
            resident=resident,
            unit=unit,
            amount=service_fee.fee_amount,  # Full payment
            currency='BDT',
            payment_method='cash',
            payment_status='completed',
            due_date=datetime.date.today(),
            service_period_month=11,
            service_period_year=2025,
            reference_number='FULL123',
            notes='Full payment test',
            created_by=resident
        )
        
        print(f"\n✅ Full payment created:")
        print(f"   Amount: {full_payment.amount} {full_payment.currency}")
        print(f"   Service Status: {full_payment.service_status}")
        print(f"   Service Status Display: {full_payment.service_status_display}")
        print(f"   Payment Percentage: {full_payment.get_payment_percentage()}%")
        print(f"   Outstanding Amount: {full_payment.get_outstanding_amount()}")
        print(f"   Is Fully Paid: {full_payment.is_fully_paid}")
        print(f"   Is Partial Payment: {full_payment.is_partial_payment}")
        
        full_payment.delete()
        
    except Exception as e:
        print(f"❌ Error with full payment: {e}")
    
    # Test 3: Overdue payment
    try:
        overdue_payment = ServiceFeePayment.objects.create(
            service_fee=service_fee,
            resident=resident,
            unit=unit,
            amount=Decimal('0.00'),  # No payment
            currency='BDT',
            payment_method='pending',
            payment_status='pending',
            due_date=datetime.date.today() - datetime.timedelta(days=10),  # Past due date
            service_period_month=8,
            service_period_year=2025,
            reference_number='OVERDUE123',
            notes='Overdue payment test',
            created_by=resident
        )
        
        print(f"\n✅ Overdue payment created:")
        print(f"   Amount: {overdue_payment.amount} {overdue_payment.currency}")
        print(f"   Service Status: {overdue_payment.service_status}")
        print(f"   Service Status Display: {overdue_payment.service_status_display}")
        print(f"   Is Overdue: {overdue_payment.is_overdue}")
        print(f"   Outstanding Amount: {overdue_payment.get_outstanding_amount()}")
        
        overdue_payment.delete()
        
    except Exception as e:
        print(f"❌ Error with overdue payment: {e}")

else:
    print("❌ Missing required data")

print("\nService status testing completed!")
