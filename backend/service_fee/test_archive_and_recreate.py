"""
Test to verify that archived service fees don't block creating new ones with the same units
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework import status
import json

from .models import ServiceFee, ServiceFeeMFS, ServiceFeeBank
from towers.models import Tower, Unit, Floor
from user.models import Member

User = get_user_model()


class ArchiveAndRecreateServiceFeeTest(TestCase):
    """
    Test case to verify the fix for archive/delete service fee issue
    """
    
    def setUp(self):
        """
        Set up test data
        """
        # Create a test user and member
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )
        
        self.member = Member.objects.create(
            user=self.user,
            full_name='Test User',
            phone_number='01712345678',
            email='test@example.com'
        )
        
        # Create a tower and floor
        self.tower = Tower.objects.create(
            tower_name='Tower A',
            tower_number='A',
            num_floors=5,
            num_units=20,
            unit_naming_type='numeric'
        )
        
        self.floor = Floor.objects.create(
            tower=self.tower,
            floor_no=1
        )
        
        # Create some units
        self.unit1 = Unit.objects.create(
            floor=self.floor,
            unit_name='101',
            unit_size=1200.00
        )
        
        self.unit2 = Unit.objects.create(
            floor=self.floor,
            unit_name='102',
            unit_size=1200.00
        )
        
        self.unit3 = Unit.objects.create(
            floor=self.floor,
            unit_name='103',
            unit_size=1200.00
        )
        
        # Create client
        self.client = Client()
        self.client.login(username='testuser', password='testpass123')
    
    def test_archive_and_recreate_with_same_units(self):
        """
        Test that after archiving a service fee, we can create a new one with the same units
        """
        # Step 1: Create initial service fee
        service_fee_data = {
            'fee_amount': 5000.00,
            'service_fee_date': '2025-01-01',
            'currency': 'BDT',
            'frequency': 'Monthly',
            'billing_cycle': 'Monthly',
            'due_day': 25,
            'accepts_cash': True,
            'accepts_mfs': False,
            'accepts_bank': False,
            'reminder_before_days': 1,
            'reminder_after_days': 1,
            'tower_ids': [],
            'unit_ids': [self.unit1.id, self.unit2.id, self.unit3.id]
        }
        
        # Create the first service fee
        response = self.client.post(
            '/api/service-fee/',
            data=json.dumps(service_fee_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['success'])
        
        first_service_fee_id = data['data']['id']
        
        # Verify the service fee is active
        service_fee = ServiceFee.objects.get(id=first_service_fee_id)
        self.assertTrue(service_fee.is_active)
        
        # Step 2: Try to create another service fee with same units (should fail)
        response = self.client.post(
            '/api/service-fee/',
            data=json.dumps(service_fee_data),
            content_type='application/json'
        )
        
        # Should fail with 400 Bad Request due to duplicate units
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertFalse(data['success'])
        self.assertIn('already assigned', data['message'].lower())
        
        # Step 3: Archive (delete) the first service fee
        response = self.client.delete(
            f'/api/service-fee/{first_service_fee_id}/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('cancelled', data['message'].lower())
        
        # Verify the service fee is now inactive
        service_fee.refresh_from_db()
        self.assertFalse(service_fee.is_active)
        
        # Step 4: Create a new service fee with the SAME units (should now succeed)
        new_service_fee_data = {
            'fee_amount': 6000.00,  # Different amount
            'service_fee_date': '2025-02-01',  # Different date
            'currency': 'BDT',
            'frequency': 'Monthly',
            'billing_cycle': 'Monthly',
            'due_day': 25,
            'accepts_cash': True,
            'accepts_mfs': False,
            'accepts_bank': False,
            'reminder_before_days': 1,
            'reminder_after_days': 1,
            'tower_ids': [],
            'unit_ids': [self.unit1.id, self.unit2.id, self.unit3.id]  # Same units
        }
        
        response = self.client.post(
            '/api/service-fee/',
            data=json.dumps(new_service_fee_data),
            content_type='application/json'
        )
        
        # Should succeed with 201 Created
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['success'])
        
        second_service_fee_id = data['data']['id']
        
        # Verify the new service fee was created with the same units
        new_service_fee = ServiceFee.objects.get(id=second_service_fee_id)
        self.assertTrue(new_service_fee.is_active)
        self.assertEqual(new_service_fee.fee_amount, 6000.00)
        
        # Verify the units are assigned to the new service fee
        assigned_unit_ids = [unit.id for unit in new_service_fee.units.all()]
        self.assertEqual(set(assigned_unit_ids), {self.unit1.id, self.unit2.id, self.unit3.id})
        
        # Verify we now have 2 service fees: one archived, one active
        self.assertEqual(ServiceFee.objects.count(), 2)
        self.assertEqual(ServiceFee.objects.filter(is_active=True).count(), 1)
        self.assertEqual(ServiceFee.objects.filter(is_active=False).count(), 1)
    
    def test_archive_and_recreate_with_tower_units(self):
        """
        Test that after archiving a service fee with tower assignment, 
        we can create a new one with the same tower
        """
        # Step 1: Create initial service fee with tower
        service_fee_data = {
            'fee_amount': 5000.00,
            'service_fee_date': '2025-01-01',
            'currency': 'BDT',
            'frequency': 'Monthly',
            'billing_cycle': 'Monthly',
            'due_day': 25,
            'accepts_cash': True,
            'accepts_mfs': False,
            'accepts_bank': False,
            'reminder_before_days': 1,
            'reminder_after_days': 1,
            'tower_ids': [self.tower.id],
            'unit_ids': []
        }
        
        # Create the first service fee
        response = self.client.post(
            '/api/service-fee/',
            data=json.dumps(service_fee_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        first_service_fee_id = response.json()['data']['id']
        
        # Step 2: Archive the first service fee
        response = self.client.delete(
            f'/api/service-fee/{first_service_fee_id}/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Step 3: Create a new service fee with the SAME tower (should succeed)
        new_service_fee_data = {
            'fee_amount': 6000.00,
            'service_fee_date': '2025-02-01',
            'currency': 'BDT',
            'frequency': 'Monthly',
            'billing_cycle': 'Monthly',
            'due_day': 25,
            'accepts_cash': True,
            'accepts_mfs': False,
            'accepts_bank': False,
            'reminder_before_days': 1,
            'reminder_after_days': 1,
            'tower_ids': [self.tower.id],
            'unit_ids': []
        }
        
        response = self.client.post(
            '/api/service-fee/',
            data=json.dumps(new_service_fee_data),
            content_type='application/json'
        )
        
        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.json()['success'])


if __name__ == '__main__':
    import sys
    from django.core.management import execute_from_command_line
    execute_from_command_line([sys.argv[0], 'test', __file__])
