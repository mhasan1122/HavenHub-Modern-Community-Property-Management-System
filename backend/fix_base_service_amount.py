"""
Fix base_service_amount for existing ServiceFeePayment records
Populates base_service_amount and additional_bill_charges for payments that have 0
"""

import os
import sys
import django
from decimal import Decimal

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment, ServiceFeeBillCategory
from service_fee.models import ServiceFee

def fix_base_service_amounts():
    """Fix base_service_amount for all payments where it's 0"""
    
    print("\n" + "="*60)
    print("Fixing base_service_amount for existing payments")
    print("="*60)
    
    # Find all payments where base_service_amount is 0
    payments_to_fix = ServiceFeePayment.objects.filter(base_service_amount=0)
    
    print(f"\nFound {payments_to_fix.count()} payments with base_service_amount = 0")
    
    if payments_to_fix.count() == 0:
        print("✅ No payments need fixing!")
        return
    
    fixed_count = 0
    error_count = 0
    
    for payment in payments_to_fix:
        try:
            # Get the service fee
            service_fee = payment.service_fee
            
            # Use service fee's fee_amount as base
            base_amount = Decimal(str(service_fee.fee_amount))
            
            # Calculate additional charges from bill categories linked to this payment
            additional_amount = Decimal('0')
            bill_categories = ServiceFeeBillCategory.objects.filter(
                servicefeepaymentid=payment
            )
            
            for category in bill_categories:
                additional_amount += Decimal(str(category.amount))
            
            # If no bill categories found, check if payment.amount > service_fee.fee_amount
            # The difference would be additional charges
            if additional_amount == 0 and payment.amount > 0:
                payment_total = Decimal(str(payment.amount))
                if payment_total > base_amount:
                    additional_amount = payment_total - base_amount
            
            # Calculate total
            total_amount = base_amount + additional_amount
            
            # Update payment
            payment.base_service_amount = base_amount
            payment.additional_bill_charges = additional_amount
            
            # If amount is 0, also update it
            if payment.amount == 0:
                payment.amount = total_amount
            
            # If remaining_amount is 0 and status is due, set it to amount
            if payment.remaining_amount == 0 and payment.service_status == 'due':
                payment.remaining_amount = payment.amount
            
            payment.save()
            
            print(f"✅ Fixed payment ID={payment.id}: "
                  f"base={base_amount}, additional={additional_amount}, "
                  f"total={payment.amount}, remaining={payment.remaining_amount}, "
                  f"status={payment.service_status}, "
                  f"period={payment.service_period_month}/{payment.service_period_year}")
            
            fixed_count += 1
            
        except Exception as e:
            print(f"❌ Error fixing payment ID={payment.id}: {str(e)}")
            error_count += 1
    
    print("\n" + "="*60)
    print(f"✅ Fixed {fixed_count} payments")
    if error_count > 0:
        print(f"❌ Failed to fix {error_count} payments")
    print("="*60)

if __name__ == '__main__':
    fix_base_service_amounts()
