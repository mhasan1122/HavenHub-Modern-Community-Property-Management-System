#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test the register-device API endpoint directly
"""
import os
import sys
import django
import requests
import json

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from notifications.models import DeviceToken
from user.models import Member
from rest_framework_simplejwt.tokens import RefreshToken

def get_test_token():
    """Get an auth token for testing"""
    try:
        member = Member.objects.get(id=41)
        refresh = RefreshToken.for_user(member.user)
        access_token = str(refresh.access_token)
        print(f"✅ Generated auth token for: {member.full_name}")
        print(f"   Token: {access_token[:30]}...")
        return access_token
    except Exception as e:
        print(f"❌ Failed to generate token: {e}")
        return None

def test_api_endpoint():
    """Test the API endpoint with a real HTTP request"""
    print("\n" + "="*80)
    print("TESTING API ENDPOINT: /api/notifications/register-device/")
    print("="*80)
    
    # Get auth token
    auth_token = get_test_token()
    if not auth_token:
        print("❌ Cannot test without auth token")
        return
    
    # Prepare request
    url = "http://192.168.0.219:8000/api/notifications/register-device/"
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
    }
    data = {
        'push_token': 'ExponentPushToken[API-TEST-DIRECT]',
        'device_type': 'android',
        'device_id': 'API_TEST_DEVICE',
    }
    
    print(f"\nMaking POST request to: {url}")
    print(f"Headers: {headers}")
    print(f"Body: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        
        print(f"\n📥 Response received:")
        print(f"   Status Code: {response.status_code}")
        print(f"   Status Text: {response.reason}")
        print(f"   Headers: {dict(response.headers)}")
        
        try:
            response_data = response.json()
            print(f"   Body: {json.dumps(response_data, indent=2)}")
        except:
            print(f"   Body (raw): {response.text}")
        
        # Check database
        print(f"\n🔍 Checking database...")
        token_count = DeviceToken.objects.count()
        print(f"   Total tokens: {token_count}")
        
        test_token = DeviceToken.objects.filter(push_token='ExponentPushToken[API-TEST-DIRECT]').first()
        if test_token:
            print(f"✅ TEST TOKEN FOUND IN DATABASE!")
            print(f"   ID: {test_token.id}")
            print(f"   Member: {test_token.member.full_name}")
            print(f"   Device: {test_token.device_type} - {test_token.device_id}")
            
            # Cleanup
            test_token.delete()
            print(f"🧹 Cleaned up test token")
        else:
            print(f"❌ TEST TOKEN NOT FOUND IN DATABASE!")
            print(f"   The API returned success but data wasn't saved!")
        
        return response.status_code == 201
        
    except requests.exceptions.ConnectionError as e:
        print(f"❌ CONNECTION ERROR: {e}")
        print(f"\n⚠️  Cannot connect to {url}")
        print(f"   Make sure:")
        print(f"   1. Django server is running")
        print(f"   2. Server is accessible at http://192.168.0.219:8000")
        print(f"   3. No firewall blocking the connection")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_api_endpoint()
