#!/usr/bin/env python
"""
Simple Payment Flow Test - Uses existing data

Tests:
1. Custom amount payment (no selected months)
2. Payment status callbacks (Success vs Failed)
"""

import os
import sys
import django
import json
from datetime import datetime

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from towers.models import Unit
from service_fee_management.models import ServiceFee, ServiceFeePayment


def find_test_unit():
    """Find a unit with service fee for testing"""
    print("\n🔍 Finding test unit with service fee...")
    
    # Get a unit with active service fee
    unit = Unit.objects.filter(
        service_fees__is_active=True
    ).select_related('floor__tower').first()
    
    if not unit:
        print("❌ No units with active service fees found")
        return None, None
    
    service_fee = unit.service_fees.filter(is_active=True).first()
    
    print(f"✅ Found unit: {unit.unit_name} (ID: {unit.id})")
    print(f"   Service Fee: Tk {service_fee.fee_amount} (ID: {service_fee.id})")
    
    return unit, service_fee


def test_custom_amount_payment():
    """Test payment initialization with custom amount (no selected months)"""
    print("\n" + "="*70)
    print("🧪 TEST 1: Custom Amount Payment (No Selected Months)")
    print("="*70)
    
    unit, service_fee = find_test_unit()
    if not unit or not service_fee:
        return False, None
    
    current_date = datetime.now()
    client = Client()
    
    # Custom amount payment - empty selected_payments array
    payload = {
        'unit_id': unit.id,
        'service_fee_id': service_fee.id,
        'amount': 400.00,  # Custom amount
        'service_period_month': current_date.month,
        'service_period_year': current_date.year,
        'selected_payments': [],  # Empty - triggers custom amount flow
        'customer_name': unit.primary_name or 'Test Customer',
        'customer_email': unit.primary_email or 'test@example.com',
        'customer_phone': unit.primary_number or '01712345678',
        'customer_address': f'{unit.floor.tower.tower_name if unit.floor else "Tower"}, {unit.unit_name}'
    }
    
    print(f"\n📤 Request:")
    print(f"   Unit: {unit.unit_name}")
    print(f"   Amount: Tk {payload['amount']} (custom amount)")
    print(f"   Selected Payments: [] (empty)")
    print(f"   Month/Year: {payload['service_period_month']}/{payload['service_period_year']}")
    
    response = client.post(
        '/api/service-fee-management/payments/paystation/init/',
        data=json.dumps(payload),
        content_type='application/json'
    )
    
    print(f"\n📥 Response: Status {response.status_code}")
    
    try:
        result = response.json()
        if response.status_code == 200 and result.get('success'):
            print(f"✅ Payment Initialized Successfully")
            print(f"   Invoice: {result.get('invoice_number')}")
            print(f"   Payment URL: {result.get('payment_url')[:80]}...")
            return True, result.get('invoice_number')
        else:
            print(f"❌ Failed: {result.get('message', 'Unknown error')}")
            return False, None
    except Exception as e:
        print(f"❌ Error parsing JSON: {e}")
        print(f"   Response content (first 500 chars):")
        print(f"   {response.content[:500].decode('utf-8', errors='ignore')}")
        return False, None


def test_failed_payment_callback(invoice_number):
    """Test payment callback with status=Failed"""
    print("\n" + "="*70)
    print("🧪 TEST 2: Payment Callback with status=Failed")
    print("="*70)
    
    client = Client()
    
    # Simulate PayStation callback with status=Failed
    callback_url = (
        f'/api/service-fee-management/payments/paystation/success/'
        f'?status=Failed&invoice_number={invoice_number}&trx_id=&message=System%20Error'
    )
    
    print(f"\n📤 Callback URL:")
    print(f"   {callback_url}")
    print(f"   Status Parameter: Failed")
    
    response = client.get(callback_url)
    
    print(f"\n📥 Response: Status {response.status_code}")
    
    try:
        result = response.json()
        
        # Backend should return 400 for failed payments
        if response.status_code == 400:
            print(f"✅ Backend Correctly Rejected Failed Payment")
            print(f"   Message: {result.get('message')}")
            
            # Check that payments are NOT marked as completed
            from service_fee_management.models import PayStationTransactionMapping
            payment_ids = PayStationTransactionMapping.get_payment_ids(invoice_number)
            if payment_ids:
                payments = ServiceFeePayment.objects.filter(id__in=payment_ids)
                all_not_completed = all(p.payment_status != 'completed' for p in payments)
                if all_not_completed:
                    print(f"   ✅ Payments NOT marked as completed (correct)")
                else:
                    print(f"   ❌ Some payments were marked as completed (wrong)")
                    return False
            
            return True
        elif response.status_code == 200:
            print(f"❌ Backend Accepted Failed Payment as Success!")
            print(f"   This is a BUG - failed payments should return 400")
            return False
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_successful_payment_callback(invoice_number):
    """Test payment callback with status=Successful"""
    print("\n" + "="*70)
    print("🧪 TEST 3: Payment Callback with status=Successful")
    print("="*70)
    
    client = Client()
    
    # Simulate PayStation callback with status=Successful
    callback_url = (
        f'/api/service-fee-management/payments/paystation/success/'
        f'?status=Successful&invoice_number={invoice_number}&trx_id=TEST123456'
    )
    
    print(f"\n📤 Callback URL:")
    print(f"   {callback_url}")
    print(f"   Status Parameter: Successful")
    
    response = client.get(callback_url)
    
    print(f"\n📥 Response: Status {response.status_code}")
    
    try:
        result = response.json()
        
        if response.status_code == 200 and result.get('success'):
            print(f"✅ Payment Processed Successfully")
            print(f"   Message: {result.get('message')}")
            
            # Check payment status in database
            payment_ids = result.get('payment_ids', [])
            if payment_ids:
                payments = ServiceFeePayment.objects.filter(id__in=payment_ids)
                print(f"\n   📊 Payment Records:")
                for payment in payments:
                    print(f"      - Payment {payment.id}: {payment.payment_status} / {payment.service_status}")
                    print(f"        Month: {payment.service_period_month}/{payment.service_period_year}")
                    print(f"        Paid: Tk {payment.total_paid}")
            
            return True
        else:
            print(f"❌ Failed: {result.get('message', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("🚀 PAYMENT FLOW TEST SUITE")
    print("="*70)
    
    results = {}
    
    # Test 1: Custom amount payment init
    print("\n" + "="*70)
    print("PHASE 1: Initialize Custom Amount Payment")
    print("="*70)
    success1, invoice1 = test_custom_amount_payment()
    results['custom_amount_init'] = success1
    
    if not invoice1:
        print("\n❌ Cannot proceed without invoice number")
        print_summary(results)
        return False
    
    # Test 2: Failed payment callback
    print("\n" + "="*70)
    print("PHASE 2: Test Failed Payment Callback")
    print("="*70)
    success2 = test_failed_payment_callback(invoice1)
    results['failed_callback'] = success2
    
    # Test 3: Successful payment callback (create new payment)
    print("\n" + "="*70)
    print("PHASE 3: Test Successful Payment Callback")
    print("="*70)
    success3, invoice2 = test_custom_amount_payment()
    results['custom_amount_init_2'] = success3
    
    if invoice2:
        success4 = test_successful_payment_callback(invoice2)
        results['successful_callback'] = success4
    else:
        results['successful_callback'] = False
    
    # Print summary
    print_summary(results)
    
    return all(results.values())


def print_summary(results):
    """Print test summary"""
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    test_names = {
        'custom_amount_init': 'Custom Amount Payment Init',
        'failed_callback': 'Failed Payment Callback Handling',
        'custom_amount_init_2': 'Second Payment Init (for success test)',
        'successful_callback': 'Successful Payment Callback'
    }
    
    passed = 0
    total = len(results)
    
    for key, success in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        name = test_names.get(key, key)
        print(f"{status} - {name}")
        if success:
            passed += 1
    
    print(f"\n{'='*70}")
    print(f"📈 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
    else:
        print(f"⚠️  {total - passed} test(s) failed")
    
    print("="*70 + "\n")


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
