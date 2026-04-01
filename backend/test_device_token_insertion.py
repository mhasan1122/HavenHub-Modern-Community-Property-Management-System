#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script to verify device token registration and database insertion
This script tests both direct ORM insertion and API endpoint registration
"""
import os
import sys
import django
import json
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client, override_settings
from django.db import transaction
from django.utils import timezone
from datetime import timedelta as dt_timedelta
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken
from notifications.models import DeviceToken
from notifications.views import RegisterDeviceTokenView
from user.models import Member


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)


def get_test_member():
    """Get a test member for testing"""
    try:
        # Try to get any member with a user account
        member = Member.objects.filter(user__isnull=False).first()
        if not member:
            print("❌ No members with user accounts found in database")
            return None
        
        if not hasattr(member, 'user') or not member.user:
            print(f"❌ Member {member.full_name} does not have a user account")
            return None
        
        print(f"✅ Using test member: {member.full_name} (ID: {member.id})")
        print(f"   Username: {member.user.username}")
        return member
    except Exception as e:
        print(f"❌ Error getting test member: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_auth_token(member):
    """Generate JWT token for the member"""
    try:
        refresh = RefreshToken.for_user(member.user)
        access_token = str(refresh.access_token)
        print(f"✅ Generated auth token")
        print(f"   Token preview: {access_token[:30]}...")
        return access_token
    except Exception as e:
        print(f"❌ Failed to generate token: {e}")
        return None


def test_direct_orm_insertion(member):
    """Test direct ORM insertion (bypassing API)"""
    print_section("TEST 1: Direct ORM Insertion")
    
    test_token = f"ExponentPushToken[TEST-DIRECT-{datetime.now().strftime('%Y%m%d%H%M%S')}]"
    test_device_id = f"TEST_DEVICE_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    print(f"\n📝 Test Data:")
    print(f"   Member: {member.full_name} (ID: {member.id})")
    print(f"   Push Token: {test_token}")
    print(f"   Device Type: android")
    print(f"   Device ID: {test_device_id}")
    
    try:
        # Delete any existing test token first
        DeviceToken.objects.filter(push_token=test_token).delete()
        
        # Insert using ORM
        print(f"\n💾 Inserting via ORM...")
        with transaction.atomic():
            device_token = DeviceToken.objects.create(
                member=member,
                push_token=test_token,
                device_type='android',
                device_id=test_device_id,
                is_active=True,
                last_used_at=timezone.now()
            )
            print(f"✅ Device token created with ID: {device_token.id}")
        
        # Verify insertion
        print(f"\n🔍 Verifying insertion...")
        verification = DeviceToken.objects.filter(id=device_token.id).first()
        if verification:
            print(f"✅ VERIFICATION PASSED - Token found in database")
            print(f"   ID: {verification.id}")
            print(f"   Member: {verification.member.full_name}")
            print(f"   Token: {verification.push_token}")
            print(f"   Device: {verification.device_type} - {verification.device_id}")
            print(f"   Active: {verification.is_active}")
            print(f"   Created: {verification.created_at}")
            
            # Cleanup
            verification.delete()
            print(f"\n🧹 Cleaned up test token")
            return True
        else:
            print(f"❌ VERIFICATION FAILED - Token NOT found in database!")
            return False
            
    except Exception as e:
        print(f"❌ ERROR during direct insertion: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_endpoint_insertion(member, auth_token):
    """Test API endpoint insertion (simulating mobile app request)"""
    print_section("TEST 2: API Endpoint Insertion")
    
    test_token = f"ExponentPushToken[TEST-API-{datetime.now().strftime('%Y%m%d%H%M%S')}]"
    test_device_id = f"TEST_DEVICE_API_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    print(f"\n📝 Test Data:")
    print(f"   Member: {member.full_name} (ID: {member.id})")
    print(f"   Push Token: {test_token}")
    print(f"   Device Type: android")
    print(f"   Device ID: {test_device_id}")
    
    # Prepare request data (exactly as mobile app sends it)
    request_data = {
        'push_token': test_token,
        'device_type': 'android',
        'device_id': test_device_id,
    }
    
    print(f"\n📤 Request Data:")
    print(f"   {json.dumps(request_data, indent=2)}")
    
    # Delete any existing test token first
    DeviceToken.objects.filter(push_token=test_token).delete()
    
    try:
        # Use APIClient with override_settings to bypass host check
        with override_settings(ALLOWED_HOSTS=['*', 'testserver']):
            client = APIClient()
            client.force_authenticate(user=member.user)
            
            print(f"\n🌐 Making POST request to /api/notifications/register-device/")
            print(f"   Authenticated as: {member.user.username}")
            print(f"   Content-Type: application/json")
            
            # Make the request
            response = client.post(
                '/api/notifications/register-device/',
                data=request_data,
                format='json'
            )
        
        print(f"\n📥 Response received:")
        print(f"   Status Code: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"   Response Body:")
            print(f"   {json.dumps(response_data, indent=2)}")
        except Exception as e:
            print(f"   Response Body (raw): {response.content.decode('utf-8') if hasattr(response, 'content') else str(response)}")
            print(f"   Error parsing JSON: {e}")
        
        # Check if request was successful
        if response.status_code not in [200, 201]:
            print(f"\n❌ API REQUEST FAILED with status {response.status_code}")
            return False
        
        # Verify database insertion
        print(f"\n🔍 Verifying database insertion...")
        verification = DeviceToken.objects.filter(push_token=test_token).first()
        
        if verification:
            print(f"✅ VERIFICATION PASSED - Token found in database!")
            print(f"   ID: {verification.id}")
            print(f"   Member: {verification.member.full_name} (ID: {verification.member.id})")
            print(f"   Token: {verification.push_token}")
            print(f"   Device Type: {verification.device_type}")
            print(f"   Device ID: {verification.device_id}")
            print(f"   Active: {verification.is_active}")
            print(f"   Created: {verification.created_at}")
            print(f"   Updated: {verification.updated_at}")
            print(f"   Last Used: {verification.last_used_at}")
            
            # Verify all fields match
            all_match = (
                verification.member.id == member.id and
                verification.push_token == test_token and
                verification.device_type == 'android' and
                verification.device_id == test_device_id and
                verification.is_active == True
            )
            
            if all_match:
                print(f"\n✅ ALL FIELDS MATCH - Data inserted correctly!")
            else:
                print(f"\n⚠️  WARNING - Some fields don't match!")
                print(f"   Member match: {verification.member.id == member.id}")
                print(f"   Token match: {verification.push_token == test_token}")
                print(f"   Device type match: {verification.device_type == 'android'}")
                print(f"   Device ID match: {verification.device_id == test_device_id}")
            
            # Cleanup
            verification.delete()
            print(f"\n🧹 Cleaned up test token")
            return True
        else:
            print(f"❌ VERIFICATION FAILED - Token NOT found in database!")
            print(f"   The API returned success but data wasn't saved!")
            
            # Check if token exists with different values
            similar_tokens = DeviceToken.objects.filter(member=member).order_by('-created_at')[:5]
            if similar_tokens.exists():
                print(f"\n   Found {similar_tokens.count()} other tokens for this member:")
                for token in similar_tokens:
                    print(f"     - ID {token.id}: {token.push_token[:40]}... ({token.device_type})")
            
            return False
            
    except Exception as e:
        print(f"❌ ERROR during API test: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_update_existing_token(member, auth_token):
    """Test updating an existing device token"""
    print_section("TEST 3: Update Existing Token")
    
    test_token = f"ExponentPushToken[TEST-UPDATE-{datetime.now().strftime('%Y%m%d%H%M%S')}]"
    test_device_id_1 = f"TEST_DEVICE_UPDATE_1"
    test_device_id_2 = f"TEST_DEVICE_UPDATE_2"
    
    # Delete any existing test tokens
    DeviceToken.objects.filter(push_token=test_token).delete()
    
    try:
        # First, create a token
        print(f"\n📝 Step 1: Creating initial token...")
        device_token = DeviceToken.objects.create(
            member=member,
            push_token=test_token,
            device_type='android',
            device_id=test_device_id_1,
            is_active=True,
            last_used_at=timezone.now()
        )
        print(f"✅ Created token with ID: {device_token.id}, Device ID: {test_device_id_1}")
        
        # Now update it via API
        print(f"\n📝 Step 2: Updating token via API...")
        request_data = {
            'push_token': test_token,
            'device_type': 'android',
            'device_id': test_device_id_2,  # Different device ID
        }
        
        with override_settings(ALLOWED_HOSTS=['*', 'testserver']):
            client = APIClient()
            client.force_authenticate(user=member.user)
            
            response = client.post(
                '/api/notifications/register-device/',
                data=request_data,
                format='json'
            )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:
            response_data = response.json()
            print(f"   Response: {json.dumps(response_data, indent=2)}")
            
            # Verify update
            verification = DeviceToken.objects.filter(push_token=test_token).first()
            if verification and verification.device_id == test_device_id_2:
                print(f"✅ UPDATE VERIFIED - Device ID changed from {test_device_id_1} to {test_device_id_2}")
                verification.delete()
                print(f"🧹 Cleaned up test token")
                return True
            else:
                print(f"❌ UPDATE FAILED - Device ID not updated correctly")
                if verification:
                    verification.delete()
                return False
        else:
            print(f"❌ API request failed")
            device_token.delete()
            return False
            
    except Exception as e:
        print(f"❌ ERROR during update test: {e}")
        import traceback
        traceback.print_exc()
        # Cleanup
        DeviceToken.objects.filter(push_token=test_token).delete()
        return False


def create_dummy_data(member, count=5):
    """Create dummy device tokens for testing"""
    print_section("CREATING DUMMY DEVICE TOKENS")
    
    import random
    device_types = ['android', 'ios', 'android', 'android', 'ios']  # More android for realism
    device_models = [
        'Samsung Galaxy S21', 'iPhone 13 Pro', 'OnePlus 9', 'Google Pixel 6',
        'Xiaomi Mi 11', 'Samsung Galaxy Note 20', 'iPhone 12', 'OnePlus 8T',
        'Huawei P40', 'Oppo Find X3', 'Vivo X60', 'Realme GT',
        'Samsung Galaxy A52', 'iPhone 11', 'Redmi Note 10', 'Motorola Edge 20'
    ]
    
    print(f"\n📝 Creating {count} dummy device tokens for {member.full_name}...")
    
    created_tokens = []
    for i in range(count):
        device_type = random.choice(device_types)
        device_model = random.choice(device_models)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        push_token = f"ExponentPushToken[DUMMY-{member.id}-{i+1}-{timestamp}]"
        device_id = f"{device_model.replace(' ', '_')}_{random.randint(1000, 9999)}"
        
        try:
            # Use update_or_create to avoid duplicates
            # Always set last_used_at (cannot be null in database)
            last_used = timezone.now() if random.choice([True, True, False]) else timezone.now() - dt_timedelta(days=random.randint(1, 30))
            
            token, created = DeviceToken.objects.update_or_create(
                member=member,
                push_token=push_token,
                defaults={
                    'device_type': device_type,
                    'device_id': device_id,
                    'is_active': random.choice([True, True, True, False]),  # 75% active
                    'last_used_at': last_used
                }
            )
            
            if created:
                created_tokens.append(token)
                status = "✅ Created" if token.is_active else "✅ Created (inactive)"
                print(f"   {status} token {i+1}/{count}: {device_type} - {device_model}")
            else:
                print(f"   ℹ️  Token {i+1}/{count} already exists, updated: {device_type} - {device_model}")
                
        except Exception as e:
            print(f"   ❌ Error creating token {i+1}/{count}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n✅ Created/Updated {len(created_tokens)} dummy device tokens")
    return created_tokens


def create_dummy_data_for_multiple_members(count_per_member=3, max_members=5):
    """Create dummy device tokens for multiple members"""
    print_section("CREATING DUMMY DEVICE TOKENS FOR MULTIPLE MEMBERS")
    
    # Get multiple members
    members = Member.objects.filter(user__isnull=False)[:max_members]
    
    if not members.exists():
        print("❌ No members with user accounts found")
        return []
    
    print(f"\n📝 Creating {count_per_member} tokens each for {members.count()} member(s)...")
    
    all_created = []
    for member in members:
        print(f"\n   👤 Member: {member.full_name} (ID: {member.id})")
        tokens = create_dummy_data(member, count=count_per_member)
        all_created.extend(tokens)
    
    print(f"\n✅ Total: Created/Updated {len(all_created)} dummy device tokens across {members.count()} member(s)")
    return all_created


def show_database_stats():
    """Show current database statistics"""
    print_section("DATABASE STATISTICS")
    
    total_tokens = DeviceToken.objects.count()
    active_tokens = DeviceToken.objects.filter(is_active=True).count()
    
    print(f"\n📊 Device Token Statistics:")
    print(f"   Total tokens: {total_tokens}")
    print(f"   Active tokens: {active_tokens}")
    print(f"   Inactive tokens: {total_tokens - active_tokens}")
    
    if total_tokens > 0:
        print(f"\n📋 Recent tokens (last 5):")
        recent_tokens = DeviceToken.objects.order_by('-created_at')[:5]
        for token in recent_tokens:
            print(f"   - ID {token.id}: {token.member.full_name} ({token.device_type})")
            print(f"     Token: {token.push_token[:40]}...")
            print(f"     Device: {token.device_id}")
            print(f"     Created: {token.created_at}")
            print()


def main():
    """Main test function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test device token registration and insertion')
    parser.add_argument('--create-dummy', type=int, metavar='N', 
                       help='Create N dummy device tokens for test member before running tests')
    parser.add_argument('--create-dummy-multiple', type=int, nargs=2, metavar=('COUNT', 'MEMBERS'),
                       help='Create COUNT dummy tokens for each of MEMBERS members (e.g., --create-dummy-multiple 3 5)')
    parser.add_argument('--dummy-only', action='store_true',
                       help='Only create dummy data, skip tests')
    
    args = parser.parse_args()
    
    print("\n" + "="*80)
    print("  DEVICE TOKEN REGISTRATION & DATABASE INSERTION TEST")
    print("="*80)
    print(f"\nTest started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Show current database stats
    show_database_stats()
    
    # Get test member
    member = get_test_member()
    if not member:
        print("\n❌ Cannot proceed without a test member")
        return
    
    # Create dummy data if requested
    if args.create_dummy_multiple:
        count_per_member, max_members = args.create_dummy_multiple
        create_dummy_data_for_multiple_members(count_per_member=count_per_member, max_members=max_members)
        show_database_stats()
        
        if args.dummy_only:
            print("\n✅ Dummy data creation completed. Exiting.")
            return
    elif args.create_dummy or args.dummy_only:
        count = args.create_dummy if args.create_dummy else 5
        create_dummy_data(member, count=count)
        show_database_stats()
        
        if args.dummy_only:
            print("\n✅ Dummy data creation completed. Exiting.")
            return
    
    # Generate auth token
    auth_token = get_auth_token(member)
    if not auth_token:
        print("\n❌ Cannot proceed without auth token")
        return
    
    # Run tests
    results = {}
    
    # Test 1: Direct ORM insertion
    results['direct_orm'] = test_direct_orm_insertion(member)
    
    # Test 2: API endpoint insertion
    results['api_endpoint'] = test_api_endpoint_insertion(member, auth_token)
    
    # Test 3: Update existing token
    results['update_existing'] = test_update_existing_token(member, auth_token)
    
    # Summary
    print_section("TEST SUMMARY")
    
    print(f"\n📊 Test Results:")
    print(f"   Direct ORM Insertion: {'✅ PASSED' if results['direct_orm'] else '❌ FAILED'}")
    print(f"   API Endpoint Insertion: {'✅ PASSED' if results['api_endpoint'] else '❌ FAILED'}")
    print(f"   Update Existing Token: {'✅ PASSED' if results['update_existing'] else '❌ FAILED'}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print(f"\n✅ ALL TESTS PASSED!")
        print(f"   Device token registration and database insertion are working correctly.")
    else:
        print(f"\n❌ SOME TESTS FAILED!")
        print(f"   Please check the errors above and verify:")
        print(f"   1. Database connection is working")
        print(f"   2. DeviceToken model is configured correctly")
        print(f"   3. API endpoint is accessible and parsing requests correctly")
        print(f"   4. Check backend logs for detailed error messages")
    
    print(f"\n" + "="*80)
    print(f"Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80 + "\n")


if __name__ == '__main__':
    main()
