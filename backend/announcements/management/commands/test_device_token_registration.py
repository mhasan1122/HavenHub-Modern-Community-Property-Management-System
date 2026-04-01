"""
Django management command to test device token registration endpoint

Usage:
    python manage.py test_device_token_registration --member-id 1 --token "ExponentPushToken[test123]"
"""
from django.core.management.base import BaseCommand
from notifications.models import DeviceToken
from user.models import Member
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
import json

User = get_user_model()


class Command(BaseCommand):
    help = 'Test device token registration endpoint'

    def add_arguments(self, parser):
        parser.add_argument(
            '--member-id',
            type=int,
            required=True,
            help='ID of member to test with',
        )
        parser.add_argument(
            '--token',
            type=str,
            default='ExponentPushToken[test123456789]',
            help='Test push token to register',
        )
        parser.add_argument(
            '--platform',
            type=str,
            choices=['ios', 'android', 'web'],
            default='ios',
            help='Platform type',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🧪 Testing Device Token Registration'))
        self.stdout.write('=' * 80)
        
        # Get member
        try:
            member = Member.objects.get(id=options['member_id'])
        except Member.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Member with ID {options["member_id"]} not found'))
            return
        
        self.stdout.write(f'\n👤 Testing with member: {member.full_name} (ID: {member.id})')
        
        # Get user for authentication
        if not hasattr(member, 'user') or not member.user:
            self.stdout.write(self.style.ERROR('❌ Member does not have a user account'))
            return
        
        user = member.user
        self.stdout.write(f'   User: {user.username}')
        
        # Create API client and authenticate
        client = APIClient()
        client.force_authenticate(user=user)
        
        # Prepare request data
        data = {
            'token': options['token'],
            'platform': options['platform'],
            'device_id': 'Test Device',
        }
        
        self.stdout.write(f'\n📤 Sending registration request...')
        self.stdout.write(f'   Token: {options["token"]}')
        self.stdout.write(f'   Platform: {options["platform"]}')
        
        # Make request
        response = client.post(
            '/api/notifications/device-token/',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        # Check response
        self.stdout.write(f'\n📥 Response Status: {response.status_code}')
        
        if response.status_code in [200, 201]:
            response_data = response.json()
            self.stdout.write(self.style.SUCCESS('✅ Token registered successfully!'))
            self.stdout.write(f'   Device Token ID: {response_data.get("id")}')
            self.stdout.write(f'   Platform: {response_data.get("platform")}')
            self.stdout.write(f'   Is Active: {response_data.get("is_active")}')
            
            # Verify in database
            device_token = DeviceToken.objects.get(id=response_data.get("id"))
            self.stdout.write(f'\n✅ Verified in database:')
            self.stdout.write(f'   Member: {device_token.member.full_name}')
            self.stdout.write(f'   Token: {device_token.token[:50]}...')
            self.stdout.write(f'   Created: {device_token.created_at}')
        else:
            self.stdout.write(self.style.ERROR('❌ Registration failed!'))
            try:
                error_data = response.json()
                self.stdout.write(f'   Error: {error_data}')
            except:
                self.stdout.write(f'   Error: {response.content.decode()}')
        
        self.stdout.write('\n' + '=' * 80)
