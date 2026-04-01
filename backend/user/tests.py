import uuid
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from user.models import Member

class RegisterViewTestCase(APITestCase):
    def setUp(self):
        """Setup the URL and any required data for tests."""
        self.url = '/api/auth/register/'  # Update to your actual register endpoint
        self.unique_username = f'user_{uuid.uuid4().hex}'  # Generate unique username for each test
        self.unique_email = f'{self.unique_username}@example.com'  # Unique email
        self.password = 'password123'

    def test_register_user_success(self):
        """Test for successful user registration with full profile."""
        data = {
            'user': {
                'username': self.unique_username,
                'email': self.unique_email,
                'password': self.password
            },
            'full_name': 'John Doe',
            'contact': '1234567890',
            'nid_number': '123456789',
            'photo_url': 'https://example.com/photo.jpg',
            'about_us': 'This is some information about the user.',
            'facebook_profile': 'https://facebook.com/johndoe',
            'linkedin_profile': 'https://linkedin.com/in/johndoe',
            'permanent_address': '123 Main St',
            'present_address': '456 Another St',
            'age': 30,
            'occupation': 'Engineer',
            'gender': 'Male',
            'marital_status': 'Single',
            'religion': 'Christian',
            'nid_front_url': 'https://example.com/nid_front.jpg',
            'nid_back_url': 'https://example.com/nid_back.jpg'
        }

        response = self.client.post(self.url, data, format='json')

        # Check for 201 Created response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], "User registered successfully")

        # Verify that the user and user profile were created
        user = User.objects.get(username=self.unique_username)
        self.assertIsNotNone(user)
        user_profile = Member.objects.get(user=user)
        self.assertEqual(user_profile.full_name, 'John Doe')
        self.assertEqual(user_profile.contact, '1234567890')
        self.assertEqual(user_profile.nid_number, '123456789')
        self.assertEqual(user_profile.photo_url, 'https://example.com/photo.jpg')


    
        # Check for successful registration even if optional fields are missing
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], "User registered successfully")
        user = User.objects.get(username=self.unique_username)
        user_profile = Member.objects.get(user=user)
