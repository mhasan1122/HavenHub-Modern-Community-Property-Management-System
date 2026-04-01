"""
Test script to verify that bills are generated ONLY for owners,
not for residents separately.

Expected behavior:
1. Only ONE bill per unit per service fee per period
2. Bill is always in the owner's name
3. No separate bills for residents
"""

import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'estate_link.settings')
django.setup()

from service_fee_management.utils.service_fee_generator import generate_service_fees
from service_fee_management.models import ServiceFeePayment
from towers.models import Unit
from datetime import datetime

def test_owner_only_billing():
    """Test that only owner bills are generated"""
    print("\n" + "="*80)
    print("🧪 TESTING: Bills Generated ONLY for Owners (Not Residents)")
    print("="*80)
    
    # Get a test unit ID (you can modify this)
    test_unit_id = input("\nEnter a unit ID to test (or press Enter for unit 174): ").strip()
    if not test_unit_id:
        test_unit_id = "174"
    
    try:
        unit = Unit.objects.get(id=test_unit_id)
        print(f"\n✅ Testing with Unit: {unit.unit_name} (ID: {unit.id})")
        
        # Check if unit has owner
        has_owner = unit.owner_set.exists()
        print(f"   Has Owner: {'✅ Yes' if has_owner else '❌ No'}")
        
        # Check if unit has residents
        has_residents = unit.resident_set.filter(is_active=True).exists()
        print(f"   Has Active Residents: {'✅ Yes' if has_residents else '❌ No'}")
        
        if not has_owner:
            print("\n⚠️  WARNING: Unit has no owner. Bills should NOT be generated.")
            print("   Add an owner first before testing.")
            return
        
        # Generate bills for December 2025
        year = 2025
        month = 12
        
        print(f"\n🔄 Generating bills for {month}/{year}...")
        print(f"   Force regenerating to ensure fresh test...")
        
        result = generate_service_fees(
            year=year,
            month=month,
            unit_ids=test_unit_id,
            force_regenerate=True
        )
        
        print(f"\n📊 Generation Result:")
        print(f"   Success: {result.get('success')}")
        print(f"   Created: {result.get('created_count', 0)}")
        print(f"   Regenerated: {result.get('regenerated_count', 0)}")
        print(f"   Skipped: {result.get('skipped_count', 0)}")
        
        if result.get('error'):
            print(f"   ❌ Error: {result['error']}")
        
        # Now check how many bills were created for this unit
        bills = ServiceFeePayment.objects.filter(
            unit_id=test_unit_id,
            service_period_year=year,
            service_period_month=month
        )
        
        print(f"\n📋 Bills Generated for Unit {test_unit_id}:")
        print(f"   Total Bills: {bills.count()}")
        
        if bills.count() == 0:
            print("   ⚠️  No bills found!")
        else:
            for i, bill in enumerate(bills, 1):
                print(f"\n   Bill #{i}:")
                print(f"      ID: {bill.id}")
                print(f"      Amount: {bill.amount} {bill.currency}")
                print(f"      Account Holder Type: {bill.account_holder_type}")
                print(f"      Owner: {bill.owner_name} ({bill.owner_email})")
                print(f"      Status: {bill.service_status}")
        
        # Verify the expected behavior
        print("\n" + "="*80)
        print("✅ VERIFICATION:")
        print("="*80)
        
        if bills.count() == 0:
            print("❌ FAIL: No bills were generated")
        elif bills.count() > 1:
            print(f"❌ FAIL: Multiple bills generated ({bills.count()}) for the same unit/period")
            print("   Expected: Only ONE bill per unit per period")
            # Check if any are for residents
            resident_bills = bills.filter(account_holder_type='resident')
            if resident_bills.exists():
                print(f"   ⚠️  Found {resident_bills.count()} bills with account_holder_type='resident'")
                print("   ❌ This is WRONG! Residents should not get separate bills.")
        else:
            bill = bills.first()
            if bill.account_holder_type == 'owner':
                print("✅ PASS: Exactly ONE bill generated in OWNER's name")
                print(f"   Owner: {bill.owner_name}")
                print(f"   Amount: {bill.amount} {bill.currency}")
                print("\n💡 Residents can now pay this bill, and their payment will reduce the owner's outstanding amount.")
            elif bill.account_holder_type == 'resident':
                print("❌ FAIL: Bill generated for RESIDENT instead of OWNER")
                print("   Expected: account_holder_type should be 'owner'")
            else:
                print(f"⚠️  WARNING: Unexpected account_holder_type: {bill.account_holder_type}")
    
    except Unit.DoesNotExist:
        print(f"\n❌ ERROR: Unit ID {test_unit_id} not found")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_owner_only_billing()
