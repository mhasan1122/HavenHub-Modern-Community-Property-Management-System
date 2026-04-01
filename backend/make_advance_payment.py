#!/usr/bin/env python3
"""
Script to make an advance payment for a specific unit
This tests the advance payment functionality
"""

import requests
import json
import sys
import os

# Add Django settings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from towers.models import Unit, Tower
from service_fee.models import ServiceFee

# Configuration
BASE_URL = "http://localhost:8000"  # Change to your server URL
USERNAME = "mirza_hasan_6426"
PASSWORD = "Guru1234*"
TOWER_NAME = "Test"
UNIT_NAME = "102"
ADVANCE_AMOUNT = 2000

def login(username, password):
    """Login and get authentication token"""
    url = f"{BASE_URL}/user/login/"
    payload = {
        "authenticator": username,
        "password": password,
        "login_type": "org"  # or "comm" based on your setup
    }
    
    print(f"🔐 Logging in as {username}...")
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('access_token')
        print(f"✅ Login successful! Token: {token[:20] if token else 'N/A'}...")
        return token
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def get_unit_by_name(tower_name, unit_name):
    """Get unit ID by tower name and unit name using Django ORM"""
    print(f"\n🔍 Searching for Unit {unit_name} in Tower {tower_name}...")
    
    try:
        # Find tower
        tower = Tower.objects.get(tower_name=tower_name)
        print(f"✅ Found Tower: ID={tower.id}, Name={tower.tower_name}")
        
        # Find unit in that tower
        unit = Unit.objects.filter(
            unit_name=unit_name,
            floor__tower=tower
        ).first()
        
        if unit:
            print(f"✅ Found Unit: ID={unit.id}, Name={unit.unit_name}")
            return unit.id
        else:
            print(f"❌ Unit {unit_name} not found in tower {tower_name}")
            # Show available units
            units = Unit.objects.filter(floor__tower=tower)[:5]
            print(f"   Available units in {tower_name}:")
            for u in units:
                print(f"   - {u.unit_name}")
            return None
    except Tower.DoesNotExist:
        print(f"❌ Tower {tower_name} not found")
        # Show available towers
        towers = Tower.objects.all()[:5]
        print(f"   Available towers:")
        for t in towers:
            print(f"   - {t.tower_name}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def get_service_fee_for_unit(unit_id):
    """Get active service fee ID using Django ORM"""
    print(f"\n🔍 Getting service fee for unit {unit_id}...")
    
    try:
        # Get active service fees
        service_fee = ServiceFee.objects.filter(is_active=True).first()
        
        if service_fee:
            print(f"✅ Found active service fee: ID={service_fee.id}, Amount={service_fee.fee_amount}")
            return service_fee.id
        else:
            print(f"❌ No active service fees found")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def get_user_info(token):
    """Get current user information"""
    url = f"{BASE_URL}/api/user/profile/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👤 Getting user information...")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        user_data = data.get('data', {}) or data
        name = user_data.get('full_name') or user_data.get('username') or 'Customer'
        email = user_data.get('email') or 'customer@example.com'
        phone = user_data.get('phone') or '01700000000'
        print(f"✅ User: {name} ({email})")
        return {
            'name': name,
            'email': email,
            'phone': phone
        }
    else:
        print(f"⚠️ Could not get user info, using defaults")
        return {
            'name': 'Customer',
            'email': 'customer@example.com',
            'phone': '01700000000'
        }

def make_advance_payment(token, unit_id, service_fee_id, amount, user_info):
    """Make advance payment via PayStation"""
    url = f"{BASE_URL}/api/service-fee-management/payments/paystation/init/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    from datetime import datetime
    current_date = datetime.now()
    next_month = current_date.month + 1 if current_date.month < 12 else 1
    next_year = current_date.year if current_date.month < 12 else current_date.year + 1
    
    payload = {
        "unit_id": unit_id,
        "service_fee_id": service_fee_id,
        "amount": amount,
        "is_advance_payment": True,  # THIS IS THE KEY FLAG!
        "service_period_month": next_month,  # Placeholder month
        "service_period_year": next_year,    # Placeholder year
        "customer_name": user_info['name'],
        "customer_email": user_info['email'],
        "customer_phone": user_info['phone'],
        "customer_address": "Dhaka, Bangladesh"
    }
    
    print(f"\n💰 Initiating advance payment of {amount} BDT...")
    print(f"   Unit ID: {unit_id}")
    print(f"   Service Fee ID: {service_fee_id}")
    print(f"   Is Advance: True")
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(url, headers=headers, json=payload)
    
    print(f"\n📡 Response Status: {response.status_code}")
    print(f"Response Body:")
    print(json.dumps(response.json(), indent=2))
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print(f"\n✅ ADVANCE PAYMENT INITIATED SUCCESSFULLY!")
            payment_url = data.get('data', {}).get('payment_url')
            if payment_url:
                print(f"🔗 Payment URL: {payment_url}")
            return True
        else:
            print(f"\n❌ Payment initialization failed: {data.get('message')}")
            return False
    else:
        print(f"\n❌ HTTP Error: {response.status_code}")
        return False

def main():
    """Main execution flow"""
    print("="*60)
    print("🚀 ADVANCE PAYMENT TEST SCRIPT")
    print("="*60)
    
    # Step 1: Get unit ID using Django ORM
    unit_id = get_unit_by_name(TOWER_NAME, UNIT_NAME)
    if not unit_id:
        print("\n❌ Cannot proceed without unit ID")
        return
    
    # Step 2: Get service fee ID using Django ORM
    service_fee_id = get_service_fee_for_unit(unit_id)
    if not service_fee_id:
        print("\n❌ Cannot proceed without service fee ID")
        return
    
    # Step 3: Login to get token
    token = login(USERNAME, PASSWORD)
    if not token:
        print("\n❌ Cannot proceed without authentication")
        return
    
    # Step 4: Get user info
    user_info = get_user_info(token)
    
    # Step 5: Make advance payment
    success = make_advance_payment(token, unit_id, service_fee_id, ADVANCE_AMOUNT, user_info)
    
    print("\n" + "="*60)
    if success:
        print("✅ TEST COMPLETED SUCCESSFULLY!")
    else:
        print("❌ TEST FAILED!")
    print("="*60)

if __name__ == "__main__":
    main()
