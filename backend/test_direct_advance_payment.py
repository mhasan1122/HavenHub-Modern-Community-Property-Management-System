"""
Test creating a new advance payment directly in database to verify the fix works
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling, AdvancePayment, PaymentMethod
from towers.models import Unit, Owner
from user.models import Member
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
import uuid
from datetime import datetime

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def create_test_advance_payment():
    """Create a new advance payment directly to verify the fix"""
    
    print_section("CREATING TEST ADVANCE PAYMENT")
    
    # Get test data
    unit = Unit.objects.first()
    owner = Owner.objects.select_related('member').first()
    member = owner.member if owner else Member.objects.first()
    
    if not unit or not member:
        print("❌ No test data available")
        return
    
    print(f"✅ Using Unit ID: {unit.id}")
    print(f"✅ Using Member ID: {member.id}")
    print(f"✅ Using Owner ID: {owner.id if owner else 'N/A'}")
    
    # Get payment methods
    try:
        cash_method = PaymentMethod.objects.get(id=2)
        print(f"✅ Found Cash payment method: {cash_method.method_name} (ID: {cash_method.id})")
    except PaymentMethod.DoesNotExist:
        print("❌ Cash payment method not found")
        return
    
    test_amount = Decimal('7777.00')
    
    print_section("CREATING ADVANCE PAYMENT RECORD")
    
    try:
        with transaction.atomic():
            # Generate IDs
            now = datetime.now()
            short_txn_id = str(uuid.uuid4()).replace('-', '').upper()[:8]
            batch_transaction_id = f"TXN-{now.year}{now.month:02d}-{short_txn_id}"
            
            short_rcp_id = str(uuid.uuid4()).replace('-', '').upper()[:5]
            batch_receipt_id = f"RCP-{now.year}{now.month:02d}-{short_rcp_id}"
            
            billing_uuid = str(uuid.uuid4()).replace('-', '').upper()[:8]
            unique_billing_id = f"BILL-{now.year}-{now.month:02d}-{billing_uuid[:5]}"
            
            # Create AdvancePayment (simulating the fixed code)
            advance_payment = AdvancePayment.objects.create(
                unit_id=unit.id,
                account_holder_type='owner',
                account_holder_id=owner.id if owner else None,
                amount=test_amount,
                remaining_amount=test_amount,
                status='available',
                advance_type='advance_payment',
                payment_method=cash_method,  # Should be Cash (ID: 2)
                created_by=member
            )
            
            print(f"✅ Created AdvancePayment:")
            print(f"   ID: {advance_payment.id}")
            print(f"   Amount: {advance_payment.amount}")
            print(f"   Payment Method: {advance_payment.payment_method.method_name} (ID: {advance_payment.payment_method_id})")
            
            # Create ServiceFeeBilling (simulating the fixed code)
            detail = ServiceFeeBilling.objects.create(
                billing_id=unique_billing_id,
                servicefeepaymentid=None,
                advance_payment=advance_payment,  # FIXED: Using correct variable
                payment_method=cash_method,  # Should be Cash (ID: 2)
                payment_type='advance_payment',
                billing_amount=Decimal('0.00'),
                total_paid=test_amount,
                payment_date=timezone.now(),
                transaction_id=batch_transaction_id,
                receipt_id=batch_receipt_id,
                created_by=member,
                notes=f"TEST: Advance Payment from script - Testing fix"
            )
            
            print(f"\n✅ Created ServiceFeeBilling:")
            print(f"   ID: {detail.id}")
            print(f"   Billing ID: {detail.billing_id}")
            print(f"   Amount: {detail.total_paid}")
            print(f"   Payment Method: {detail.payment_method.method_name} (ID: {detail.payment_method_id})")
            print(f"   Linked to Advance ID: {detail.advance_payment_id}")
            
    except Exception as e:
        print(f"\n❌ ERROR creating records: {str(e)}")
        import traceback
        traceback.print_exc()
        return
    
    # Verify the records
    print_section("VERIFICATION")
    
    # Check ServiceFeeBilling
    billing_check = ServiceFeeBilling.objects.get(id=detail.id)
    print("ServiceFeeBilling Record:")
    print(f"   Payment Method ID: {billing_check.payment_method_id}")
    print(f"   Payment Method Name: {billing_check.payment_method.method_name if billing_check.payment_method else 'NULL'}")
    print(f"   Advance Payment ID: {billing_check.advance_payment_id}")
    
    if billing_check.payment_method_id == 2:
        print(f"   ✅ SUCCESS! ServiceFeeBilling has Cash (ID: 2)")
    else:
        print(f"   ❌ FAILED! ServiceFeeBilling has {billing_check.payment_method.method_name} (ID: {billing_check.payment_method_id})")
    
    print()
    
    # Check AdvancePayment
    advance_check = AdvancePayment.objects.get(id=advance_payment.id)
    print("AdvancePayment Record:")
    print(f"   Payment Method ID: {advance_check.payment_method_id}")
    print(f"   Payment Method Name: {advance_check.payment_method.method_name if advance_check.payment_method else 'NULL'}")
    
    if advance_check.payment_method_id == 2:
        print(f"   ✅ SUCCESS! AdvancePayment has Cash (ID: 2)")
    else:
        print(f"   ❌ FAILED! AdvancePayment has {advance_check.payment_method.method_name} (ID: {advance_check.payment_method_id})")
    
    # Check linkage
    print()
    print("Linkage Check:")
    if billing_check.advance_payment_id == advance_payment.id:
        print(f"   ✅ SUCCESS! Billing is correctly linked to AdvancePayment")
    else:
        print(f"   ❌ FAILED! Billing linkage is broken")
    
    print_section("SUMMARY")
    
    if (billing_check.payment_method_id == 2 and 
        advance_check.payment_method_id == 2 and 
        billing_check.advance_payment_id == advance_payment.id):
        print("🎉 ALL CHECKS PASSED! The fix is working correctly!")
        print(f"\n✅ New advance payment created with:")
        print(f"   - ServiceFeeBilling ID: {detail.id}")
        print(f"   - AdvancePayment ID: {advance_payment.id}")
        print(f"   - Both using Cash (ID: 2)")
        print(f"   - Properly linked together")
    else:
        print("❌ SOME CHECKS FAILED! There may still be issues.")
    
    print("\n💡 Run test_advance_payment_fix.py to see all records")

if __name__ == '__main__':
    try:
        create_test_advance_payment()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
