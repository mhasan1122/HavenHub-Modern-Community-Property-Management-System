"""
Test creating a new advance payment to verify the fix works correctly
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
import requests
import json

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_new_advance_payment():
    """Make a new advance payment and verify payment_method is correct"""
    
    print_section("TESTING NEW ADVANCE PAYMENT")
    
    # Get test data
    unit = Unit.objects.first()
    if not unit:
        print("❌ No units found in database")
        return
    
    print(f"✅ Using Unit: {unit.unit_name} (ID: {unit.id})")
    
    # Get an owner/member
    owner = Owner.objects.select_related('member').first()
    if not owner or not owner.member:
        print("❌ No owner/member found")
        return
    
    member = owner.member
    print(f"✅ Using Member ID: {member.id}")
    
    # Get service fee (assuming ID 1 exists)
    from service_fee.models import ServiceFee
    service_fee = ServiceFee.objects.first()
    if not service_fee:
        print("❌ No service fee found")
        return
    
    print(f"✅ Using Service Fee: ID {service_fee.id}")
    
    # Make API call to create advance payment
    print_section("MAKING API REQUEST")
    
    api_url = "http://localhost:8000/api/service-fee-management/multi-month-payment/"
    
    payload = {
        "unit_id": unit.id,
        "service_fee_id": service_fee.id,
        "resident_id": owner.id,
        "created_by": member.id,
        "total_amount": "5000.00",
        "selected_periods": [],  # Empty = pure advance payment
        "notes": "Test advance payment from script",
        "sendEmail": False
    }
    
    print(f"📤 Sending POST request to: {api_url}")
    print(f"📋 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(api_url, json=payload)
        print(f"\n📥 Response Status: {response.status_code}")
        print(f"📥 Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code not in [200, 201]:
            print(f"\n⚠️  API request failed with status {response.status_code}")
            return
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to Django server at http://localhost:8000")
        print("   Make sure the Django server is running: python manage.py runserver 0.0.0.0:8000")
        return
    except Exception as e:
        print(f"\n❌ ERROR making API request: {str(e)}")
        return
    
    # Check the latest records in database
    print_section("CHECKING LATEST RECORDS IN DATABASE")
    
    latest_billing = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment'
    ).order_by('-created_at').first()
    
    if latest_billing:
        print("Latest ServiceFeeBilling Record:")
        print(f"   ID: {latest_billing.id}")
        print(f"   Billing ID: {latest_billing.billing_id}")
        print(f"   Amount: {latest_billing.total_paid}")
        print(f"   Payment Method: {latest_billing.payment_method.method_name if latest_billing.payment_method else 'NULL'}")
        print(f"   Payment Method ID: {latest_billing.payment_method_id}")
        print(f"   Payment Gateway: {latest_billing.payment_gateway or 'None'}")
        print(f"   Created: {latest_billing.created_at}")
        
        # Check if payment_method is correct
        if latest_billing.payment_method_id == 2:
            print(f"\n   ✅ SUCCESS! Payment method is Cash (ID: 2) - FIX IS WORKING!")
        else:
            pm_name = latest_billing.payment_method.method_name if latest_billing.payment_method else "NULL"
            print(f"\n   ❌ FAILED! Payment method is {pm_name} (ID: {latest_billing.payment_method_id})")
            print(f"   Expected: Cash (ID: 2)")
    else:
        print("❌ No advance payment billing records found")
    
    print()
    
    latest_advance = AdvancePayment.objects.order_by('-created_at').first()
    
    if latest_advance:
        print("Latest AdvancePayment Record:")
        print(f"   ID: {latest_advance.id}")
        print(f"   Amount: {latest_advance.amount}")
        print(f"   Remaining: {latest_advance.remaining_amount}")
        print(f"   Payment Method: {latest_advance.payment_method.method_name if latest_advance.payment_method else 'NULL'}")
        print(f"   Payment Method ID: {latest_advance.payment_method_id}")
        print(f"   Status: {latest_advance.status}")
        print(f"   Created: {latest_advance.created_at}")
        
        # Check if payment_method is correct
        if latest_advance.payment_method_id == 2:
            print(f"\n   ✅ SUCCESS! Payment method is Cash (ID: 2) - FIX IS WORKING!")
        else:
            pm_name = latest_advance.payment_method.method_name if latest_advance.payment_method else "NULL"
            print(f"\n   ❌ FAILED! Payment method is {pm_name} (ID: {latest_advance.payment_method_id})")
            print(f"   Expected: Cash (ID: 2)")
    else:
        print("❌ No advance payment records found")
    
    print_section("TEST COMPLETE")
    print("Run test_advance_payment_fix.py to see all records")

if __name__ == '__main__':
    try:
        test_new_advance_payment()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
