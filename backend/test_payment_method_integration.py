"""
Test script to verify payment method integration
Run this with: python manage.py shell < test_payment_method_integration.py
"""

print("=" * 60)
print("PAYMENT METHOD INTEGRATION TEST")
print("=" * 60)

from service_fee_management.models import PaymentMethod, ServiceFeePayment
from towers.models import Unit
from user.models import Member
from service_fee.models import ServiceFee

# Test 1: Check if PaymentMethod table has data
print("\n1. Checking PaymentMethod table...")
payment_methods = PaymentMethod.objects.all()
print(f"   Total payment methods: {payment_methods.count()}")
for pm in payment_methods:
    print(f"   - ID: {pm.id}, method_id: {pm.method_id}, name: {pm.method_name}, active: {pm.is_active}")

if payment_methods.count() == 0:
    print("   ❌ No payment methods found! Run: python manage.py populate_payment_methods")
else:
    print("   ✅ Payment methods loaded successfully")

# Test 2: Check existing payments
print("\n2. Checking existing ServiceFeePayment records...")
payments = ServiceFeePayment.objects.all()[:5]
print(f"   Total payments in database: {ServiceFeePayment.objects.count()}")
print(f"   Showing first 5 payments:")
for payment in payments:
    if payment.payment_method:
        print(f"   - Payment ID: {payment.id}")
        print(f"     Payment Method ID: {payment.payment_method.id}")
        print(f"     Payment Method Name: {payment.payment_method.method_name}")
        print(f"     Amount: {payment.amount}")
        print(f"     Transaction: {payment.transaction_id}")
    else:
        print(f"   - Payment ID: {payment.id} - ❌ NO PAYMENT METHOD SET")

# Test 3: Test creating a new payment with payment method
print("\n3. Testing payment creation with PaymentMethod...")
try:
    # Get first active payment method
    cash_method = PaymentMethod.objects.filter(method_id='cash').first()
    
    if not cash_method:
        print("   ❌ Cash payment method not found")
    else:
        print(f"   Found payment method: {cash_method.method_name} (ID: {cash_method.id})")
        
        # Get first unit and service fee for testing
        test_unit = Unit.objects.first()
        test_service_fee = ServiceFee.objects.first()
        test_member = Member.objects.first()
        
        if test_unit and test_service_fee and test_member:
            print(f"   Test data: Unit: {test_unit.unit_name}, ServiceFee: {test_service_fee.id}, Member: {test_member.full_name}")
            
            # Create test payment
            test_payment = ServiceFeePayment(
                service_fee=test_service_fee,
                unit=test_unit,
                resident=test_member,
                amount=1000.00,
                payment_method=cash_method,  # Using FK instead of string
                payment_status='completed',
                service_period_month=10,
                service_period_year=2025,
                created_by=test_member
            )
            test_payment.save()
            
            print(f"   ✅ Test payment created successfully!")
            print(f"   Transaction ID: {test_payment.transaction_id}")
            print(f"   Payment Method: {test_payment.payment_method.method_name}")
            print(f"   Payment Method ID: {test_payment.payment_method.id}")
            
            # Clean up test payment
            test_payment.delete()
            print(f"   ✅ Test payment deleted (cleanup)")
        else:
            print("   ❌ Missing test data (Unit, ServiceFee, or Member)")
            
except Exception as e:
    print(f"   ❌ Error creating test payment: {str(e)}")

# Test 4: API Response Format Test
print("\n4. Testing API response format...")
try:
    from rest_framework.test import APIRequestFactory
    from service_fee_management.views import get_payment_choices, get_filter_options
    
    factory = APIRequestFactory()
    
    # Test payment choices endpoint
    request = factory.get('/api/service-fee-management/payment-choices/')
    response = get_payment_choices(request)
    
    if response.status_code == 200:
        data = response.data
        if 'payment_methods' in data.get('data', {}):
            print("   ✅ payment-choices endpoint returns 'payment_methods' array")
            methods = data['data']['payment_methods']
            if len(methods) > 0:
                print(f"   Sample payment method: {methods[0]}")
        else:
            print("   ❌ payment-choices endpoint missing 'payment_methods' key")
    else:
        print(f"   ❌ payment-choices endpoint returned status {response.status_code}")
    
    # Test filter options endpoint
    request = factory.get('/api/service-fee-management/filter-options/')
    response = get_filter_options(request)
    
    if response.status_code == 200:
        data = response.data
        if 'payment_methods' in data.get('data', {}):
            print("   ✅ filter-options endpoint returns 'payment_methods' array")
            methods = data['data']['payment_methods']
            if len(methods) > 0:
                print(f"   Sample payment method: {methods[0]}")
        else:
            print("   ❌ filter-options endpoint missing 'payment_methods' key")
    else:
        print(f"   ❌ filter-options endpoint returned status {response.status_code}")
        
except Exception as e:
    print(f"   ❌ Error testing API: {str(e)}")

# Test 5: Check database schema
print("\n5. Checking database schema...")
try:
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Check if payment_method_id column exists
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'service_fee_management_servicefeepayment' 
            AND COLUMN_NAME = 'payment_method_id'
        """)
        result = cursor.fetchone()
        
        if result:
            print(f"   ✅ payment_method_id column exists")
            print(f"   Column details: {result}")
        else:
            print(f"   ❌ payment_method_id column NOT FOUND")
            
        # Check foreign key constraint
        cursor.execute("""
            SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'service_fee_management_servicefeepayment'
            AND COLUMN_NAME = 'payment_method_id'
            AND REFERENCED_TABLE_NAME IS NOT NULL
        """)
        fk_result = cursor.fetchone()
        
        if fk_result:
            print(f"   ✅ Foreign key constraint exists")
            print(f"   FK details: {fk_result}")
        else:
            print(f"   ❌ Foreign key constraint NOT FOUND")
            
except Exception as e:
    print(f"   ❌ Error checking schema: {str(e)}")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
print("\nSummary:")
print("- Payment methods should be loaded in database")
print("- ServiceFeePayment should use payment_method_id (FK)")
print("- API endpoints should return payment_methods array with id/name")
print("- Frontend should send payment_method: <ID> (integer)")
print("\nNext steps:")
print("1. If no payment methods: python manage.py populate_payment_methods")
print("2. Update frontend to use payment method ID instead of string")
print("3. Test creating/updating payments via API")
