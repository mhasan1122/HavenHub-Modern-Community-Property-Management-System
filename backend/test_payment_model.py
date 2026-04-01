"""
Test script for ServiceFeePayment model
Run this with: python manage.py shell < test_payment_model.py
"""

from service_fee.models import ServiceFee, ServiceFeePayment
from user.models import Member
from towers.models import Unit
from decimal import Decimal
import datetime

print("Testing ServiceFeePayment model...")

# Check if we have any service fees
service_fees = ServiceFee.objects.all()
print(f"Available service fees: {service_fees.count()}")

# Check if we have any members
members = Member.objects.all()
print(f"Available members: {members.count()}")

# Check if we have any units
units = Unit.objects.all()
print(f"Available units: {units.count()}")

if service_fees.exists() and members.exists() and units.exists():
    # Create a test payment
    service_fee = service_fees.first()
    resident = members.first()
    unit = units.first()
    
    try:
        payment = ServiceFeePayment.objects.create(
            service_fee=service_fee,
            resident=resident,
            unit=unit,
            amount=Decimal('10000.00'),
            currency='BDT',
            payment_method='bkash',
            payment_status='pending',
            due_date=datetime.date.today(),
            service_period_month=9,
            service_period_year=2025,
            reference_number='TEST123',
            notes='Test payment',
            created_by=resident
        )
        
        print(f"✅ Test payment created successfully!")
        print(f"   Transaction ID: {payment.transaction_id}")
        print(f"   Amount: {payment.amount} {payment.currency}")
        print(f"   Status: {payment.payment_status}")
        print(f"   Service Period: {payment.service_period_display}")
        print(f"   Is Overdue: {payment.is_overdue}")
        
        # Test updating payment status
        payment.payment_status = 'completed'
        payment.save()
        print(f"✅ Payment status updated to completed")
        print(f"   Completion Date: {payment.completion_date}")
        
        # Clean up test data
        payment.delete()
        print("✅ Test payment cleaned up")
        
    except Exception as e:
        print(f"❌ Error creating test payment: {e}")
else:
    print("❌ Missing required data (service fees, members, or units)")
    print("   Please ensure you have created at least one of each through Django admin")

print("Test completed!")
