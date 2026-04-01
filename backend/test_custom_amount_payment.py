#!/usr/bin/env python
"""
Test Custom Amount Payment Flow

This script tests:
1. Payment with selected months (normal flow)
2. Payment without selected months (custom amount flow)
3. Payment status callbacks (Successful, Failed)
"""

import os
import sys
import django
import json
from datetime import datetime, date

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory, Client
from django.contrib.auth import get_user_model
from towers.models import Tower, Unit
from service_fee_management.models import ServiceFee, ServiceFeePayment
from user.models import Member

User = get_user_model()


class PaymentFlowTester:
    def __init__(self):
        self.client = Client()
        self.factory = RequestFactory()
        self.test_user = None
        self.test_unit = None
        self.test_service_fee = None
        
    def setup_test_data(self):
        """Create test data for payment testing"""
        print("\n" + "="*60)
        print("🔧 SETTING UP TEST DATA")
        print("="*60)
        
        # Create or get test user
        self.test_user, created = User.objects.get_or_create(
            username='payment_test_user',
            defaults={
                'email': 'paymenttest@example.com',
                'first_name': 'Payment',
                'last_name': 'Tester'
            }
        )
        if created:
            self.test_user.set_password('testpass123')
            self.test_user.save()
        print(f"✅ Test User: {self.test_user.username} (ID: {self.test_user.id})")
        
        # Create or get test tower
        tower, created = Tower.objects.get_or_create(
            tower_name='Test Tower',
            defaults={'description': 'Test tower for payment testing'}
        )
        print(f"✅ Test Tower: {tower.tower_name} (ID: {tower.id})")
        
        # Create or get test unit
        self.test_unit, created = Unit.objects.get_or_create(
            tower=tower,
            unit_name='Test-101',
            defaults={
                'primary_resident': self.test_user,
                'primary_name': 'Payment Tester',
                'primary_email': 'paymenttest@example.com',
                'primary_number': '01712345678'
            }
        )
        print(f"✅ Test Unit: {self.test_unit.unit_name} (ID: {self.test_unit.id})")
        
        # Create or get test service fee
        self.test_service_fee, created = ServiceFee.objects.get_or_create(
            unit=self.test_unit,
            defaults={
                'fee_amount': 5000.00,
                'fee_type': 'monthly',
                'start_date': date(2024, 1, 1),
                'due_day': 10,
                'is_active': True
            }
        )
        print(f"✅ Test Service Fee: Tk {self.test_service_fee.fee_amount} (ID: {self.test_service_fee.id})")
        
        # Create some unpaid billing records for testing
        current_date = datetime.now()
        for month_offset in range(3):  # Create 3 months of unpaid bills
            month = current_date.month - month_offset
            year = current_date.year
            if month <= 0:
                month += 12
                year -= 1
                
            payment, created = ServiceFeePayment.objects.get_or_create(
                service_fee=self.test_service_fee,
                unit=self.test_unit,
                service_period_month=month,
                service_period_year=year,
                defaults={
                    'amount': self.test_service_fee.fee_amount,
                    'currency': 'BDT',
                    'payment_status': 'pending',
                    'due_date': f"{year}-{month:02d}-{self.test_service_fee.due_day:02d}",
                    'service_status': 'due',
                    'total_paid': 0,
                    'remaining_amount': self.test_service_fee.fee_amount
                }
            )
            if created:
                print(f"✅ Created payment record: {month}/{year}")
        
        print("\n✅ Test data setup complete!\n")
        
    def test_payment_with_selected_months(self):
        """Test payment initialization with selected payment months (normal flow)"""
        print("\n" + "="*60)
        print("🧪 TEST 1: Payment with Selected Months")
        print("="*60)
        
        current_date = datetime.now()
        selected_payments = [
            {
                'month': current_date.month,
                'year': current_date.year,
                'amount': 5000.00
            }
        ]
        
        payload = {
            'unit_id': self.test_unit.id,
            'service_fee_id': self.test_service_fee.id,
            'amount': 5000.00,
            'service_period_month': current_date.month,
            'service_period_year': current_date.year,
            'selected_payments': selected_payments,
            'customer_name': 'Payment Tester',
            'customer_email': 'paymenttest@example.com',
            'customer_phone': '01712345678',
            'customer_address': 'Test Tower, Test-101'
        }
        
        print(f"\n📤 Sending payment init request:")
        print(json.dumps(payload, indent=2))
        
        response = self.client.post(
            '/api/service-fee-management/payments/paystation/init/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        print(f"\n📥 Response Status: {response.status_code}")
        try:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if response.status_code == 200 and result.get('success'):
                print(f"✅ TEST PASSED: Payment initialized successfully")
                print(f"   Invoice: {result.get('invoice_number')}")
                print(f"   Payment URL: {result.get('payment_url')}")
                return result.get('invoice_number')
            else:
                print(f"❌ TEST FAILED: {result.get('message', 'Unknown error')}")
                return None
        except Exception as e:
            print(f"❌ TEST FAILED: Error parsing response - {e}")
            return None
    
    def test_payment_without_selected_months(self):
        """Test payment initialization without selected months (custom amount flow)"""
        print("\n" + "="*60)
        print("🧪 TEST 2: Payment WITHOUT Selected Months (Custom Amount)")
        print("="*60)
        
        current_date = datetime.now()
        
        # Custom amount payment - no selected_payments array
        payload = {
            'unit_id': self.test_unit.id,
            'service_fee_id': self.test_service_fee.id,
            'amount': 400.00,  # Custom amount (less than fee_amount)
            'service_period_month': current_date.month,
            'service_period_year': current_date.year,
            'selected_payments': [],  # Empty - custom amount flow
            'customer_name': 'Payment Tester',
            'customer_email': 'paymenttest@example.com',
            'customer_phone': '01712345678',
            'customer_address': 'Test Tower, Test-101'
        }
        
        print(f"\n📤 Sending custom amount payment init request:")
        print(json.dumps(payload, indent=2))
        
        response = self.client.post(
            '/api/service-fee-management/payments/paystation/init/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        print(f"\n📥 Response Status: {response.status_code}")
        try:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if response.status_code == 200 and result.get('success'):
                print(f"✅ TEST PASSED: Custom amount payment initialized successfully")
                print(f"   Invoice: {result.get('invoice_number')}")
                print(f"   Amount: Tk {payload['amount']}")
                print(f"   Payment URL: {result.get('payment_url')}")
                return result.get('invoice_number')
            else:
                print(f"❌ TEST FAILED: {result.get('message', 'Unknown error')}")
                return None
        except Exception as e:
            print(f"❌ TEST FAILED: Error parsing response - {e}")
            return None
    
    def test_payment_callback_success(self, invoice_number):
        """Test successful payment callback"""
        print("\n" + "="*60)
        print("🧪 TEST 3: Payment Callback - SUCCESS")
        print("="*60)
        
        callback_url = f'/api/service-fee-management/payments/paystation/success/?status=Successful&invoice_number={invoice_number}&trx_id=TEST123456'
        
        print(f"\n📤 Simulating success callback:")
        print(f"URL: {callback_url}")
        
        response = self.client.get(callback_url)
        
        print(f"\n📥 Response Status: {response.status_code}")
        try:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if response.status_code == 200 and result.get('success'):
                print(f"✅ TEST PASSED: Success callback processed correctly")
                
                # Verify payment status in database
                payments = ServiceFeePayment.objects.filter(id__in=result.get('payment_ids', []))
                print(f"\n📊 Payment Records Updated:")
                for payment in payments:
                    print(f"   - Payment {payment.id}: {payment.payment_status} / {payment.service_status}")
                    print(f"     Month: {payment.service_period_month}/{payment.service_period_year}")
                    print(f"     Amount: Tk {payment.amount}, Paid: Tk {payment.total_paid}")
                return True
            else:
                print(f"❌ TEST FAILED: {result.get('message', 'Unknown error')}")
                return False
        except Exception as e:
            print(f"❌ TEST FAILED: Error - {e}")
            return False
    
    def test_payment_callback_failed(self, invoice_number):
        """Test failed payment callback"""
        print("\n" + "="*60)
        print("🧪 TEST 4: Payment Callback - FAILED")
        print("="*60)
        
        callback_url = f'/api/service-fee-management/payments/paystation/success/?status=Failed&invoice_number={invoice_number}&trx_id=&message=System%20Error'
        
        print(f"\n📤 Simulating failure callback:")
        print(f"URL: {callback_url}")
        
        response = self.client.get(callback_url)
        
        print(f"\n📥 Response Status: {response.status_code}")
        print(f"Expected: 400 (Bad Request) for failed payment")
        
        try:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if response.status_code == 400 and not result.get('success'):
                print(f"✅ TEST PASSED: Failed callback rejected correctly")
                print(f"   Message: {result.get('message')}")
                return True
            elif response.status_code == 200:
                print(f"❌ TEST FAILED: Backend accepted failed payment as success!")
                return False
            else:
                print(f"⚠️  Unexpected response")
                return False
        except Exception as e:
            print(f"❌ TEST FAILED: Error - {e}")
            return False
    
    def run_all_tests(self):
        """Run all payment flow tests"""
        print("\n" + "="*70)
        print("🚀 PAYMENT FLOW TEST SUITE")
        print("="*70)
        
        self.setup_test_data()
        
        results = {
            'test1_selected_months': False,
            'test2_custom_amount': False,
            'test3_callback_success': False,
            'test4_callback_failed': False
        }
        
        # Test 1: Normal payment with selected months
        invoice1 = self.test_payment_with_selected_months()
        results['test1_selected_months'] = invoice1 is not None
        
        # Test 2: Custom amount payment without selected months
        invoice2 = self.test_payment_without_selected_months()
        results['test2_custom_amount'] = invoice2 is not None
        
        # Test 3: Success callback (using invoice from test 2)
        if invoice2:
            results['test3_callback_success'] = self.test_payment_callback_success(invoice2)
        
        # Test 4: Failed callback (create new payment for this)
        invoice3 = self.test_payment_without_selected_months()
        if invoice3:
            results['test4_callback_failed'] = self.test_payment_callback_failed(invoice3)
        
        # Print summary
        print("\n" + "="*70)
        print("📊 TEST SUMMARY")
        print("="*70)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status} - {test_name.replace('_', ' ').title()}")
        
        print(f"\n{'='*70}")
        print(f"📈 Results: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED!")
        else:
            print(f"⚠️  {total_tests - passed_tests} test(s) failed")
        
        print("="*70 + "\n")
        
        return results


if __name__ == '__main__':
    tester = PaymentFlowTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if all(results.values()) else 1)
