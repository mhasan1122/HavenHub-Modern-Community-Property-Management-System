#!/usr/bin/env python
"""
Delete the incorrect advance payment from PayStation transaction PS-63855D404F4B
This advance was created because only December was selected (not both Dec + Jan)
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import AdvancePayment, ServiceFeeBilling
from django.db import transaction

def delete_incorrect_advance():
    print("\n" + "="*80)
    print("DELETING INCORRECT ADVANCE PAYMENT")
    print("="*80)
    
    # Find the advance payment
    advance = AdvancePayment.objects.filter(
        id=1,
        unit_id=24,
        amount=13200,
        advance_type='overpayment',
        notes__contains='PS-63855D404F4B'
    ).first()
    
    if not advance:
        print("\n❌ Advance payment not found")
        return
    
    print(f"\n📋 Found Advance Payment:")
    print(f"   ID: {advance.id}")
    print(f"   Amount: ৳{advance.amount}")
    print(f"   Remaining: ৳{advance.remaining_amount}")
    print(f"   Type: {advance.advance_type}")
    print(f"   Notes: {advance.notes}")
    
    # Check if it has been used
    if advance.remaining_amount < advance.amount:
        print(f"\n⚠️ WARNING: This advance has been partially used!")
        print(f"   Original: ৳{advance.amount}")
        print(f"   Remaining: ৳{advance.remaining_amount}")
        print(f"   Used: ৳{advance.amount - advance.remaining_amount}")
        
        confirm = input("\nDo you still want to delete it? (yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ Deletion cancelled")
            return
    
    # Find related billing records
    billings = ServiceFeeBilling.objects.filter(advance_payment=advance)
    
    print(f"\n📋 Related Billing Records: {billings.count()}")
    for billing in billings:
        print(f"   - Billing ID: {billing.id}, Amount: ৳{billing.total_paid}")
    
    # Delete in transaction
    try:
        with transaction.atomic():
            # Delete billing records first
            billing_count = billings.count()
            billings.delete()
            
            # Delete advance payment
            advance.delete()
            
            print(f"\n✅ Successfully deleted:")
            print(f"   - {billing_count} billing record(s)")
            print(f"   - 1 advance payment")
            print(f"\n💡 The ৳13,200 is now lost. To test correctly:")
            print(f"   1. Make a new payment of ৳27,000")
            print(f"   2. SELECT BOTH December AND January before paying")
            print(f"   3. Expected result:")
            print(f"      - December: PAID (৳13,800)")
            print(f"      - January: PARTIAL (৳600 remaining)")
            print(f"      - Advance: ৳0 (correct!)")
            
    except Exception as e:
        print(f"\n❌ Error during deletion: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    delete_incorrect_advance()
