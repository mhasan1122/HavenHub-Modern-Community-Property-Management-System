from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.exceptions import ValidationError
from user.models import Member, MemberType
from towers.models import Tower, Floor, Unit
from .models import ServiceFee, ServiceFeeMFS, ServiceFeeBank
from .serializers import ServiceFeeMFSSerializer


class ServiceFeeModelTest(TestCase):
    """
    Test cases for ServiceFee models
    """

    def setUp(self):
        # Create test user and member
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.member_type = MemberType.objects.create(type_name='Admin')
        self.member = Member.objects.create(
            user=self.user,
            member_type=self.member_type,
            full_name='Test Admin',
            general_contact='01234567890',
            general_email='test@example.com'
        )

        # Create test tower and units
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            tower_number=1,
            num_floors=5,
            num_units=20,
            unit_naming_type='Numeric',
            created_by=self.member
        )

        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_no=1,
            number_of_units=4,
            created_by=self.member
        )

        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='101',
            unit_status='available',
            created_by=self.member
        )

    def test_service_fee_creation(self):
        """Test creating a service fee"""
        service_fee = ServiceFee.objects.create(
            creator=self.member,
            creator_name=self.member.full_name,
            fee_amount=5000.00,
            currency='BDT',
            frequency='Monthly',
            billing_cycle='Monthly',
            due_day=5,
            accepts_cash=True,
            accepts_mfs=True,
            created_by=self.member
        )

        self.assertEqual(service_fee.creator, self.member)
        self.assertEqual(service_fee.fee_amount, 5000.00)
        self.assertEqual(service_fee.currency, 'BDT')
        self.assertTrue(service_fee.is_active)

    def test_service_fee_mfs_creation(self):
        """Test creating MFS payment method"""
        service_fee = ServiceFee.objects.create(
            creator=self.member,
            creator_name=self.member.full_name,
            fee_amount=5000.00,
            currency='BDT',
            frequency='Monthly',
            billing_cycle='Monthly',
            due_day=5,
            accepts_mfs=True,
            created_by=self.member
        )

        mfs = ServiceFeeMFS.objects.create(
            service_fee=service_fee,
            provider='bKash',
            account_name='Test Account',
            account_number='01234567890'
        )

        self.assertEqual(mfs.service_fee, service_fee)
        self.assertEqual(mfs.provider, 'bKash')
        self.assertEqual(mfs.account_name, 'Test Account')

    def test_service_fee_bank_creation(self):
        """Test creating bank payment method"""
        service_fee = ServiceFee.objects.create(
            creator=self.member,
            creator_name=self.member.full_name,
            fee_amount=5000.00,
            currency='BDT',
            frequency='Monthly',
            billing_cycle='Monthly',
            due_day=5,
            accepts_bank=True,
            created_by=self.member
        )

        bank = ServiceFeeBank.objects.create(
            service_fee=service_fee,
            bank_name='Prime Bank',
            branch_name='Dhanmondi Branch',
            branch_address='Dhanmondi, Dhaka',
            account_holder_name='Test Account Holder',
            account_number='1234567890123456',
            routing_number='123456789'
        )

        self.assertEqual(bank.service_fee, service_fee)
        self.assertEqual(bank.bank_name, 'Prime Bank')
        self.assertEqual(bank.account_holder_name, 'Test Account Holder')


class ServiceFeeAPITest(APITestCase):
    """
    Test cases for ServiceFee API endpoints
    """

    def setUp(self):
        # Create test user and member
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.member_type = MemberType.objects.create(type_name='Admin')
        self.member = Member.objects.create(
            user=self.user,
            member_type=self.member_type,
            full_name='Test Admin',
            general_contact='01234567890',
            general_email='test@example.com'
        )

        # Create test tower and units
        self.tower = Tower.objects.create(
            tower_name='Test Tower',
            tower_number=1,
            num_floors=5,
            num_units=20,
            unit_naming_type='Numeric',
            created_by=self.member
        )

        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_no=1,
            number_of_units=4,
            created_by=self.member
        )

        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_name='101',
            unit_status='available',
            created_by=self.member
        )

        # Authenticate the test client
        self.client.force_authenticate(user=self.user)

    def test_service_fee_list_endpoint(self):
        """Test the service fee list endpoint"""
        response = self.client.get('/api/service-fees/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    def test_service_fee_creation_endpoint(self):
        """Test creating a service fee via API"""
        data = {
            'fee_amount': 5000.00,
            'currency': 'BDT',
            'frequency': 'Monthly',
            'billing_cycle': 'Monthly',
            'due_day': 5,
            'accepts_cash': True,
            'accepts_mfs': True,
            'tower_ids': [self.tower.id],
            'unit_ids': [self.unit.id],
            'mfs_accounts': [
                {
                    'provider': 'bKash',
                    'account_name': 'Test Account',
                    'account_number': '01234567890'
                }
            ]
        }

        response = self.client.post('/api/service-fees/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['fee_amount'], '5000.00')

    def test_mfs_mobile_number_validation_valid_numbers(self):
        """Test valid Bangladeshi mobile numbers are accepted"""
        valid_numbers = [
            '01712345678',  # Grameenphone
            '01812345678',  # Robi
            '01912345678',  # Banglalink
            '01512345678',  # Teletalk
            '01612345678',  # Airtel
            '01312345678',  # Grameenphone
            '01412345678',  # Robi
        ]
        
        for number in valid_numbers:
            with self.subTest(number=number):
                data = {
                    'fee_amount': 5000.00,
                    'currency': 'BDT',
                    'frequency': 'Monthly',
                    'billing_cycle': 'Monthly',
                    'due_day': 5,
                    'accepts_mfs': True,
                    'reminder_before_days': 3,
                    'reminder_after_days': 7,
                    'tower_ids': [self.tower.id],
                    'mfs_accounts': [
                        {
                            'provider': 'bKash',
                            'account_name': 'Test Account',
                            'account_number': number
                        }
                    ]
                }
                response = self.client.post('/api/service-fees/', data, format='json')
                self.assertEqual(
                    response.status_code, 
                    status.HTTP_201_CREATED,
                    f"Valid number {number} was rejected: {response.data if response.status_code != 201 else ''}"
                )

    def test_mfs_mobile_number_validation_invalid_numbers(self):
        """Test invalid mobile numbers are rejected with proper error messages"""
        invalid_test_cases = [
            {
                'number': '123456789',  # Too short
                'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
            },
            {
                'number': '012345678901',  # Too long
                'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
            },
            {
                'number': '02123456789',  # Doesn't start with 01
                'expected_error': 'Bangladeshi mobile number must start with \'01\'.'
            },
            {
                'number': '0112345678a',  # Contains letters
                'expected_error': 'Mobile number should contain only digits.'
            },
            {
                'number': '01223456789',  # Invalid prefix 012
                'expected_error': 'Invalid mobile number prefix \'012\'. Valid prefixes are: 013, 014, 015, 016, 017, 018, 019.'
            },
            {
                'number': '+8801712345678',  # With country code
                'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
            },
            {
                'number': '8801712345678',  # Without +
                'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
            }
        ]
        
        for case in invalid_test_cases:
            with self.subTest(number=case['number']):
                data = {
                    'fee_amount': 5000.00,
                    'currency': 'BDT',
                    'frequency': 'Monthly',
                    'billing_cycle': 'Monthly',
                    'due_day': 5,
                    'accepts_mfs': True,
                    'reminder_before_days': 3,
                    'reminder_after_days': 7,
                    'tower_ids': [self.tower.id],
                    'mfs_accounts': [
                        {
                            'provider': 'bKash',
                            'account_name': 'Test Account',
                            'account_number': case['number']
                        }
                    ]
                }
                response = self.client.post('/api/service-fees/', data, format='json')
                self.assertEqual(
                    response.status_code, 
                    status.HTTP_400_BAD_REQUEST,
                    f"Invalid number {case['number']} was accepted when it should be rejected"
                )
                # Check if the expected error message is in the response
                self.assertIn('errors', response.data)
                error_found = False
                if 'mfs_accounts' in response.data['errors']:
                    error_message = str(response.data['errors']['mfs_accounts'])
                    if case['expected_error'] in error_message:
                        error_found = True
                elif 'message' in response.data:
                    if case['expected_error'] in response.data['message']:
                        error_found = True
                
                self.assertTrue(
                    error_found,
                    f"Expected error message '{case['expected_error']}' not found in response for number {case['number']}. Response: {response.data}"
                )

    def test_mfs_serializer_validation_direct(self):
        """Test MFS serializer validation directly"""
        # Test valid number
        valid_data = {
            'provider': 'bKash',
            'account_name': 'Test Account',
            'account_number': '01712345678'
        }
        serializer = ServiceFeeMFSSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid(), f"Valid data rejected: {serializer.errors}")
        
        # Test invalid number
        invalid_data = {
            'provider': 'bKash',
            'account_name': 'Test Account',
            'account_number': '123456789'  # Too short
        }
        serializer = ServiceFeeMFSSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('account_number', serializer.errors)
        self.assertIn('Please enter a valid Bangladeshi mobile number', str(serializer.errors['account_number']))
