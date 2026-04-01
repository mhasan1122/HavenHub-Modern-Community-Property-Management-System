#!/usr/bin/env python
"""
Payment API Test - Tests actual backend server

Tests:
1. Custom amount payment (no selected months)
2. Payment status detection
"""

import requests
import json
from datetime import datetime

# Backend URL
BASE_URL = "http://192.168.0.219:8000"


def test_custom_amount_payment(month_offset=0):
    """Test payment initialization with custom amount (no selected months)"""
    print("\n" + "="*70)
    print("🧪 TEST: Custom Amount Payment (No Selected Months)")
    print("="*70)
    
    current_date = datetime.now()
    
    # Calculate month with offset to avoid duplicates
    month = current_date.month + month_offset
    year = current_date.year
    if month > 12:
        month -= 12
        year += 1
    elif month < 1:
        month += 12
        year -= 1
    
    # Use unit ID 17 (101) from earlier output
    payload = {
        'unit_id': 17,
        'service_fee_id': 1,
        'amount': 400.00,  # Custom amount
        'service_period_month': month,
        'service_period_year': year,
        'selected_payments': [],  # Empty - custom amount flow
        'customer_name': 'Test Customer',
        'customer_email': 'test@example.com',
        'customer_phone': '01712345678',
        'customer_address': 'Payment, 101'
    }
    
    print(f"\n📤 Request:")
    print(f"   URL: {BASE_URL}/api/service-fee-management/payments/paystation/init/")
    print(f"   Unit ID: {payload['unit_id']}")
    print(f"   Amount: Tk {payload['amount']} (custom amount)")
    print(f"   Month/Year: {payload['service_period_month']}/{payload['service_period_year']}")
    print(f"   Selected Payments: [] (empty)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/service-fee-management/payments/paystation/init/",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"\n📥 Response: Status {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ Payment Initialized Successfully")
                print(f"   Invoice: {result.get('invoice_number')}")
                print(f"   Payment URL: {result.get('payment_url')[:80]}...")
                return True, result.get('invoice_number')
            else:
                print(f"❌ Failed: {result.get('message', 'Unknown error')}")
                return False, None
        else:
            try:
                error_data = response.json()
                print(f"❌ Failed: {error_data.get('message', 'Unknown error')}")
            except:
                print(f"❌ Failed: HTTP {response.status_code}")
                print(f"   Response: {response.text[:500]}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False, None


def simulate_failed_callback(invoice_number):
    """Simulate failed payment callback"""
    print("\n" + "="*70)
    print("🧪 TEST 2: Simulate Failed Payment Callback")
    print("="*70)
    
    callback_url = (
        f"{BASE_URL}/api/service-fee-management/payments/paystation/success/"
        f"?status=Failed&invoice_number={invoice_number}&trx_id=&message=System%20Error"
    )
    
    print(f"\n📤 Callback URL:")
    print(f"   {callback_url}")
    print(f"   Status Parameter: Failed")
    print(f"\n   Expected: Backend should return 400 (Bad Request)")
    
    try:
        response = requests.get(callback_url)
        
        print(f"\n📥 Response: Status {response.status_code}")
        
        if response.status_code == 400:
            try:
                result = response.json()
                print(f"✅ Backend Correctly Rejected Failed Payment")
                print(f"   Message: {result.get('message')}")
                print(f"\n   This means the frontend fix is needed to check status parameter!")
                return True
            except:
                print(f"✅ Backend Correctly Rejected (HTTP 400)")
                return True
        elif response.status_code == 200:
            print(f"❌ Backend Accepted Failed Payment as Success!")
            print(f"   This is the BUG we're fixing")
            return False
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def simulate_successful_callback(invoice_number):
    """Simulate successful payment callback"""
    print("\n" + "="*70)
    print("🧪 TEST 3: Simulate Successful Payment Callback")
    print("="*70)
    
    callback_url = (
        f"{BASE_URL}/api/service-fee-management/payments/paystation/success/"
        f"?status=Successful&invoice_number={invoice_number}&trx_id=TEST123456"
    )
    
    print(f"\n📤 Callback URL:")
    print(f"   {callback_url}")
    print(f"   Status Parameter: Successful")
    print(f"\n   Expected: Backend should return 200 OK")
    
    try:
        response = requests.get(callback_url)
        
        print(f"\n📥 Response: Status {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                if result.get('success'):
                    print(f"✅ Payment Processed Successfully")
                    print(f"   Message: {result.get('message')}")
                    print(f"   Payment IDs: {result.get('payment_ids')}")
                    return True
                else:
                    print(f"⚠️  Success=False: {result.get('message')}")
                    return False
            except:
                print(f"⚠️  Response not JSON")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("🚀 PAYMENT API TEST SUITE")
    print("="*70)
    print(f"Backend: {BASE_URL}")
    
    results = {}
    
    # Test 1: Custom amount payment init (Use next month to avoid already paid)
    print("\n📍 Test 1: Using next month (March)")
    success1, invoice1 = test_custom_amount_payment(month_offset=1)
    results['custom_amount_init'] = success1
    
    if not invoice1:
        print("\n❌ Cannot proceed - payment initialization failed")
        print_summary(results)
        return False
    
    # Test 2: Failed payment callback
    success2 = simulate_failed_callback(invoice1)
    results['failed_callback'] = success2
    
    # Test 3: Successful payment callback (create new payment for month after)
    print("\n📍 Test 3: Using month after next (April)")
    success3, invoice2 = test_custom_amount_payment(month_offset=2)
    results['custom_amount_init_2'] = success3
    
    if invoice2:
        success4 = simulate_successful_callback(invoice2)
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
        'failed_callback': 'Failed Payment Callback (Backend)',
        'custom_amount_init_2': 'Second Payment Init',
        'successful_callback': 'Successful Payment Callback (Backend)'
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
        print("\n✅ Custom amount payment works (when no cards selected)")
        print("✅ Backend correctly rejects failed payments (status=Failed)")
        print("✅ Backend correctly processes successful payments (status=Successful)")
        print("\n💡 Frontend fix ensures PaymentGatewayScreen checks status parameter")
    else:
        print(f"⚠️  {total - passed} test(s) failed")
    
    print("="*70 + "\n")


if __name__ == '__main__':
    import sys
    success = main()
    sys.exit(0 if success else 1)
