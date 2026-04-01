"""
Comprehensive test suite for the Service Fee Payment System

This module tests the complete payment flow including:
- Payment validation
- SSLCommerz integration
- Billing record management
- Mobile app API endpoints
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
from unittest.mock import patch, MagicMock
import json

from user.models import Member
from towers.models import Tower, Floor, Unit
from service_fee.models import ServiceFee
from .models import ServiceFeeBilling, ServiceFeePayment, PaymentMethod
from .serializers import ServiceFeePaymentSerializer
from .views import validate_payment_eligibility, complete_pending_payment


class PaymentSystemTestCase(TestCase):
    """Test cases for the payment system core functionality"""
    
    def setUp(self):
        """Set up test data"""
        # Create test user and member
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.member = Member.objects.create(
            user=self.user,
            full_name='Test User',
            general_email='test@example.com'
        )
        
        # Create test tower and unit
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            address='Test Address'
        )
        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_number=1
        )
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='1A',
            primary_name='Primary Resident',
            primary_email='primary@example.com',
            primary_number='01700000001'
        )
        
        # Create test service fee
        self.service_fee = ServiceFee.objects.create(
            fee_name='Monthly Maintenance',
            fee_amount=Decimal('5000.00'),
            due_day=5,
            is_active=True
        )
        
        # Create test payment method
        self.payment_method = PaymentMethod.objects.create(
            method_name='bKash',
            is_active=True,
            display_order=1
        )
    
    def test_payment_eligibility_validation(self):
        """Test payment eligibility validation"""
        # Test with no billing record
        can_pay, remaining, total_paid, fee_amount = validate_payment_eligibility(
            self.unit.id, self.service_fee.id, 1, 2024
        )
        
        self.assertTrue(can_pay)
        self.assertEqual(remaining, 5000.00)
        self.assertEqual(total_paid, 0.00)
        self.assertEqual(fee_amount, 5000.00)
        
        # Test with billing record
        billing = ServiceFeeBilling.objects.create(
            service_fee=self.service_fee,
            unit=self.unit,
            resident=self.member,
            billing_amount=Decimal('5000.00'),
            service_period_month=1,
            service_period_year=2024,
            due_date=timezone.now().date()
        )
        
        can_pay, remaining, total_paid, fee_amount = validate_payment_eligibility(
            self.unit.id, self.service_fee.id, 1, 2024
        )
        
        self.assertTrue(can_pay)
        self.assertEqual(remaining, 5000.00)
        self.assertEqual(total_paid, 0.00)
        self.assertEqual(fee_amount, 5000.00)
    
    def test_payment_serializer_validation(self):
        """Test payment serializer validation"""
        # Test valid payment data
        valid_data = {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': Decimal('1000.00'),
            'currency': 'BDT',
            'payment_status': 'completed',
            'payment_method_rel': self.payment_method.id
        }
        
        serializer = ServiceFeePaymentSerializer(data=valid_data)
        serializer.initial_data = {
            'service_period_month': 1,
            'service_period_year': 2024
        }
        
        self.assertTrue(serializer.is_valid())
    
    def test_payment_serializer_validation_errors(self):
        """Test payment serializer validation errors"""
        # Test with missing required fields
        invalid_data = {
            'amount': Decimal('1000.00'),
            'currency': 'BDT'
        }
        
        serializer = ServiceFeePaymentSerializer(data=invalid_data)
        serializer.initial_data = {}
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('unit', serializer.errors)
        self.assertIn('service_fee', serializer.errors)
    
    def test_payment_amount_validation(self):
        """Test payment amount validation"""
        # Create billing record
        billing = ServiceFeeBilling.objects.create(
            service_fee=self.service_fee,
            unit=self.unit,
            resident=self.member,
            billing_amount=Decimal('5000.00'),
            service_period_month=1,
            service_period_year=2024,
            due_date=timezone.now().date()
        )
        
        # Test overpayment validation
        overpayment_data = {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': Decimal('6000.00'),  # More than fee amount
            'currency': 'BDT',
            'payment_status': 'completed'
        }
        
        serializer = ServiceFeePaymentSerializer(data=overpayment_data)
        serializer.initial_data = {
            'service_period_month': 1,
            'service_period_year': 2024
        }
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)
    
    def test_duplicate_payment_prevention(self):
        """Test duplicate payment prevention"""
        # Create a recent payment
        recent_payment = ServiceFeePayment.objects.create(
            receipt_id='RCP-001',
            transaction_id='TXN-001',
            service_fee=self.service_fee,
            unit=self.unit,
            amount=Decimal('1000.00'),
            currency='BDT',
            payment_status='completed'
        )
        
        # Try to create another payment with same amount
        duplicate_data = {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': Decimal('1000.00'),
            'currency': 'BDT',
            'payment_status': 'completed'
        }
        
        serializer = ServiceFeePaymentSerializer(data=duplicate_data)
        serializer.initial_data = {
            'service_period_month': 1,
            'service_period_year': 2024
        }
        
        # Should be valid since it's not within the 1-minute window
        self.assertTrue(serializer.is_valid())


class SSLCommerzIntegrationTestCase(TransactionTestCase):
    """Test cases for SSLCommerz payment integration"""
    
    def setUp(self):
        """Set up test data for SSLCommerz tests"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.member = Member.objects.create(
            user=self.user,
            full_name='Test User',
            general_email='test@example.com'
        )
        
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            address='Test Address'
        )
        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_number=1
        )
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='1A',
            primary_name='Primary Resident',
            primary_email='primary@example.com',
            primary_number='01700000001'
        )
        
        self.service_fee = ServiceFee.objects.create(
            fee_name='Monthly Maintenance',
            fee_amount=Decimal('5000.00'),
            due_day=5,
            is_active=True
        )
    
    @patch('service_fee_management.views.sslcommerz_utils.get_payment_gateway')
    def test_sslcommerz_payment_init(self, mock_gateway):
        """Test SSLCommerz payment initialization"""
        # Mock the payment gateway response
        mock_gateway.return_value.init_payment.return_value = {
            'success': True,
            'gateway_url': 'https://sandbox.sslcommerz.com/gwprocess/v4/gw.php',
            'session_key': 'test_session_key',
            'transaction_id': 'test_txn_123'
        }
        
        # Test payment initialization
        from .views import SSLCommerzPaymentInitView
        from django.test import RequestFactory
        
        factory = RequestFactory()
        request = factory.post('/api/payments/sslcommerz/init/', {
            'unit_id': self.unit.id,
            'service_fee_id': self.service_fee.id,
            'amount': 5000.00,
            'service_period_month': 1,
            'service_period_year': 2024,
            'customer_name': 'Test User',
            'customer_email': 'test@example.com',
            'customer_phone': '01700000001',
            'customer_address': 'Test Address'
        })
        
        view = SSLCommerzPaymentInitView()
        response = view.post(request)
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertIn('gateway_url', response_data)
    
    def test_sslcommerz_payment_success_callback(self):
        """Test SSLCommerz payment success callback"""
        # Create a pending payment
        payment = ServiceFeePayment.objects.create(
            receipt_id='RCP-001',
            transaction_id='test_txn_123',
            service_fee=self.service_fee,
            unit=self.unit,
            amount=Decimal('5000.00'),
            currency='BDT',
            payment_status='pending'
        )
        
        # Test success callback
        from .views import SSLCommerzPaymentSuccessView
        from django.test import RequestFactory
        
        factory = RequestFactory()
        request = factory.post('/api/payments/sslcommerz/success/', {
            'tran_id': 'test_txn_123',
            'status': 'VALID',
            'val_id': 'test_val_123',
            'amount': '5000.00',
            'currency': 'BDT'
        })
        
        view = SSLCommerzPaymentSuccessView()
        response = view.post(request)
        
        self.assertEqual(response.status_code, 200)
        
        # Check that payment was completed
        payment.refresh_from_db()
        self.assertEqual(payment.payment_status, 'completed')


class MobileAppAPITestCase(TestCase):
    """Test cases for mobile app API endpoints"""
    
    def setUp(self):
        """Set up test data for mobile app tests"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.member = Member.objects.create(
            user=self.user,
            full_name='Test User',
            general_email='test@example.com'
        )
        
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            address='Test Address'
        )
        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_number=1
        )
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='1A',
            primary_name='Primary Resident',
            primary_email='primary@example.com',
            primary_number='01700000001'
        )
        
        self.service_fee = ServiceFee.objects.create(
            fee_name='Monthly Maintenance',
            fee_amount=Decimal('5000.00'),
            due_day=5,
            is_active=True
        )
    
    def test_mobile_resident_list_api(self):
        """Test mobile resident list API endpoint"""
        from .views import ServiceFeeResidentListView
        from django.test import RequestFactory
        
        factory = RequestFactory()
        request = factory.get('/api/service-fee-management/residents/?source=mobile')
        
        view = ServiceFeeResidentListView()
        response = view.get(request)
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertIn('data', response_data)
    
    def test_mobile_payment_creation_api(self):
        """Test mobile payment creation API endpoint"""
        from .views import ServiceFeePaymentListCreateView
        from django.test import RequestFactory
        
        factory = RequestFactory()
        request = factory.post('/api/service-fee-management/payments/', {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': 1000.00,
            'currency': 'BDT',
            'payment_status': 'completed',
            'service_period_month': 1,
            'service_period_year': 2024
        }, content_type='application/json')
        
        view = ServiceFeePaymentListCreateView()
        response = view.post(request)
        
        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])


class PaymentBillingIntegrationTestCase(TestCase):
    """Test cases for payment and billing integration"""
    
    def setUp(self):
        """Set up test data for billing integration tests"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.member = Member.objects.create(
            user=self.user,
            full_name='Test User',
            general_email='test@example.com'
        )
        
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            address='Test Address'
        )
        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_number=1
        )
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='1A',
            primary_name='Primary Resident',
            primary_email='primary@example.com',
            primary_number='01700000001'
        )
        
        self.service_fee = ServiceFee.objects.create(
            fee_name='Monthly Maintenance',
            fee_amount=Decimal('5000.00'),
            due_day=5,
            is_active=True
        )
    
    def test_billing_record_creation_on_payment(self):
        """Test that billing records are created when payments are made"""
        # Create payment without billing record
        payment = ServiceFeePayment.objects.create(
            receipt_id='RCP-001',
            transaction_id='TXN-001',
            service_fee=self.service_fee,
            unit=self.unit,
            amount=Decimal('1000.00'),
            currency='BDT',
            payment_status='completed'
        )
        
        # Check that billing record was created
        billing = ServiceFeeBilling.objects.get(
            unit=self.unit,
            service_fee=self.service_fee,
            service_period_month=1,  # Default month
            service_period_year=2024  # Default year
        )
        
        self.assertIsNotNone(billing)
        self.assertEqual(billing.billing_amount, Decimal('5000.00'))
        self.assertEqual(billing.total_paid, Decimal('1000.00'))
        self.assertEqual(billing.remaining_amount, Decimal('4000.00'))
    
    def test_multiple_payments_same_month(self):
        """Test multiple payments for the same month"""
        # Create first payment
        payment1 = ServiceFeePayment.objects.create(
            receipt_id='RCP-001',
            transaction_id='TXN-001',
            service_fee=self.service_fee,
            unit=self.unit,
            amount=Decimal('2000.00'),
            currency='BDT',
            payment_status='completed'
        )
        
        # Create second payment
        payment2 = ServiceFeePayment.objects.create(
            receipt_id='RCP-002',
            transaction_id='TXN-002',
            service_fee=self.service_fee,
            unit=self.unit,
            amount=Decimal('3000.00'),
            currency='BDT',
            payment_status='completed'
        )
        
        # Check billing record totals
        billing = ServiceFeeBilling.objects.get(
            unit=self.unit,
            service_fee=self.service_fee,
            service_period_month=1,
            service_period_year=2024
        )
        
        self.assertEqual(billing.total_paid, Decimal('5000.00'))
        self.assertEqual(billing.remaining_amount, Decimal('0.00'))
        self.assertEqual(billing.service_status, 'paid')
    
    def test_payment_completion_updates_billing(self):
        """Test that payment completion updates billing status"""
        # Create pending payment
        payment = ServiceFeePayment.objects.create(
            receipt_id='RCP-001',
            transaction_id='TXN-001',
            service_fee=self.service_fee,
            unit=self.unit,
            amount=Decimal('5000.00'),
            currency='BDT',
            payment_status='pending'
        )
        
        # Complete the payment
        result = complete_pending_payment(payment.id)
        
        self.assertTrue(result)
        
        # Check that payment status was updated
        payment.refresh_from_db()
        self.assertEqual(payment.payment_status, 'completed')
        self.assertEqual(payment.service_status, 'paid')


class PaymentValidationTestCase(TestCase):
    """Test cases for payment validation edge cases"""
    
    def setUp(self):
        """Set up test data for validation tests"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.member = Member.objects.create(
            user=self.user,
            full_name='Test User',
            general_email='test@example.com'
        )
        
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            address='Test Address'
        )
        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_number=1
        )
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='1A',
            primary_name='Primary Resident',
            primary_email='primary@example.com',
            primary_number='01700000001'
        )
        
        self.service_fee = ServiceFee.objects.create(
            fee_name='Monthly Maintenance',
            fee_amount=Decimal('5000.00'),
            due_day=5,
            is_active=True
        )
    
    def test_negative_amount_validation(self):
        """Test validation of negative payment amounts"""
        data = {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': Decimal('-100.00'),
            'currency': 'BDT',
            'payment_status': 'completed'
        }
        
        serializer = ServiceFeePaymentSerializer(data=data)
        serializer.initial_data = {
            'service_period_month': 1,
            'service_period_year': 2024
        }
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)
    
    def test_zero_amount_validation(self):
        """Test validation of zero payment amounts"""
        data = {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': Decimal('0.00'),
            'currency': 'BDT',
            'payment_status': 'completed'
        }
        
        serializer = ServiceFeePaymentSerializer(data=data)
        serializer.initial_data = {
            'service_period_month': 1,
            'service_period_year': 2024
        }
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)
    
    def test_missing_service_period_validation(self):
        """Test validation when service period is missing"""
        data = {
            'unit': self.unit.id,
            'service_fee': self.service_fee.id,
            'amount': Decimal('1000.00'),
            'currency': 'BDT',
            'payment_status': 'completed'
        }
        
        serializer = ServiceFeePaymentSerializer(data=data)
        serializer.initial_data = {}  # No service period
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('service_period', serializer.errors)
