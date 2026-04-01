"""
Fix incorrect payment_method in advance payment records.
This script updates all cash advance payments that incorrectly have bKash (ID 1) 
to use Cash (ID 2) instead.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling, AdvancePayment, PaymentMethod
from django.db import transaction

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def fix_advance_payment_methods():
    """Fix payment_method for advance payments that should be Cash"""
    
    print_section("FIXING ADVANCE PAYMENT METHODS")
    
    # Get Cash and bKash payment methods
    try:
        cash_method = PaymentMethod.objects.get(id=2)
        bkash_method = PaymentMethod.objects.get(id=1)
        print(f"✅ Found Cash method: {cash_method.method_name} (ID: {cash_method.id})")
        print(f"✅ Found bKash method: {bkash_method.method_name} (ID: {bkash_method.id})")
    except PaymentMethod.DoesNotExist as e:
        print(f"❌ Error: Could not find payment methods: {e}")
        return
    
    # Find incorrect ServiceFeeBilling records
    print_section("FINDING INCORRECT RECORDS")
    
    incorrect_billings = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment',
        payment_method_id=1  # bKash
    ).exclude(
        payment_gateway='paystation'  # Exclude PayStation payments (those are correct)
    )
    
    print(f"Found {incorrect_billings.count()} ServiceFeeBilling records with incorrect payment_method")
    
    # Find incorrect AdvancePayment records
    incorrect_advances = AdvancePayment.objects.filter(
        payment_method_id=1  # bKash
    ).exclude(
        source_billing__payment_gateway='paystation'  # Exclude PayStation
    )
    
    print(f"Found {incorrect_advances.count()} AdvancePayment records with incorrect payment_method")
    
    if incorrect_billings.count() == 0 and incorrect_advances.count() == 0:
        print("\n✅ No incorrect records found. All payment methods are correct!")
        return
    
    # Show details of records to be fixed
    print_section("RECORDS TO BE FIXED")
    
    print("ServiceFeeBilling Records:")
    for billing in incorrect_billings[:10]:
        print(f"   ID {billing.id}: {billing.billing_id} - Amount: {billing.total_paid} - Gateway: {billing.payment_gateway or 'None'}")
    
    if incorrect_billings.count() > 10:
        print(f"   ... and {incorrect_billings.count() - 10} more")
    
    print("\nAdvancePayment Records:")
    for advance in incorrect_advances[:10]:
        print(f"   ID {advance.id}: Amount: {advance.amount} - Remaining: {advance.remaining_amount}")
    
    if incorrect_advances.count() > 10:
        print(f"   ... and {incorrect_advances.count() - 10} more")
    
    # Confirm before proceeding
    print_section("CONFIRMATION")
    response = input(f"Do you want to update {incorrect_billings.count()} billing records and {incorrect_advances.count()} advance records? (yes/no): ")
    
    if response.lower() != 'yes':
        print("❌ Update cancelled by user")
        return
    
    # Perform the update in a transaction
    print_section("UPDATING RECORDS")
    
    try:
        with transaction.atomic():
            # Update ServiceFeeBilling records
            billing_updated = incorrect_billings.update(payment_method=cash_method)
            print(f"✅ Updated {billing_updated} ServiceFeeBilling records")
            
            # Update AdvancePayment records
            advance_updated = incorrect_advances.update(payment_method=cash_method)
            print(f"✅ Updated {advance_updated} AdvancePayment records")
            
            print("\n🎉 SUCCESS! All records have been updated.")
            
    except Exception as e:
        print(f"\n❌ ERROR during update: {str(e)}")
        import traceback
        traceback.print_exc()
        return
    
    # Verify the fix
    print_section("VERIFICATION")
    
    remaining_incorrect_billings = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment',
        payment_method_id=1
    ).exclude(
        payment_gateway='paystation'
    ).count()
    
    remaining_incorrect_advances = AdvancePayment.objects.filter(
        payment_method_id=1
    ).exclude(
        source_billing__payment_gateway='paystation'
    ).count()
    
    if remaining_incorrect_billings == 0 and remaining_incorrect_advances == 0:
        print("✅ VERIFICATION PASSED: All records now have correct payment_method")
    else:
        print(f"⚠️  WARNING: Still found {remaining_incorrect_billings} incorrect billing records and {remaining_incorrect_advances} incorrect advance records")
    
    # Show sample of updated records
    print_section("SAMPLE OF UPDATED RECORDS")
    
    updated_billings = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment',
        payment_method_id=2  # Cash
    ).exclude(
        payment_gateway='paystation'
    ).order_by('-updated_at')[:5]
    
    print("Updated ServiceFeeBilling Records:")
    for billing in updated_billings:
        print(f"   ID {billing.id}: {billing.billing_id}")
        print(f"      Payment Method: {billing.payment_method.method_name} (ID: {billing.payment_method_id})")
        print(f"      Amount: {billing.total_paid}")
        print(f"      Gateway: {billing.payment_gateway or 'None'}")
        print()
    
    print("\n💡 TIP: Run test_advance_payment_fix.py to see the full updated state")

if __name__ == '__main__':
    try:
        fix_advance_payment_methods()
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
