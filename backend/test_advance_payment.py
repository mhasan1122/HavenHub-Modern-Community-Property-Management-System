#!/usr/bin/env python3
"""
Simple script to test advance payment
Run this with: python3 test_advance_payment.py
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "mirza_hasan_6426"
PASSWORD = "Guru1234*"

# You need to provide these after finding them in your database
UNIT_ID = None  # Will be set after login
SERVICE_FEE_ID = None  # Will be set after login
ADVANCE_AMOUNT = 2000

print("="*60)
print("🚀 ADVANCE PAYMENT TEST")
print("="*60)

# Step 1: Login
print("\n🔐 Logging in...")
login_response = requests.post(
    f"{BASE_URL}/user/login/",
    json={
        "authenticator": USERNAME,
        "password": PASSWORD,
        "login_type": "org"
    }
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.text}")
    exit(1)

token = login_response.json().get('access_token')
print(f"✅ Login successful! Token: {token[:20]}...")

# Step 2: Get units to find Tower "Test", Unit "102"
print("\n🔍 Finding Unit 102 in Tower Test...")
headers = {"Authorization": f"Bearer {token}"}

# Try to get towers first
towers_response = requests.get(f"{BASE_URL}/towers/tower_list/", headers=headers)
if towers_response.status_code == 200:
    towers = towers_response.json()
    print(f"Found {len(towers) if isinstance(towers, list) else 'some'} towers")
    
    # Find "Test" tower
    for tower in (towers if isinstance(towers, list) else towers.get('data', [])):
        if tower.get('tower_name') == 'Test':
            tower_id = tower.get('id')
            print(f"✅ Found Tower 'Test': ID={tower_id}")
            
            # Now find unit 102 in this tower
            # Get units - try different endpoints
            for endpoint in ['/towers/unit_list/', '/towers/community_units/']:
                units_response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
                if units_response.status_code == 200:
                    units_data = units_response.json()
                    units = units_data if isinstance(units_data, list) else units_data.get('data', [])
                    
                    for unit in units:
                        if unit.get('unit_name') == '102':
                            # Check if this unit belongs to our tower
                            unit_tower_id = unit.get('tower_id') or unit.get('floor', {}).get('tower_id')
                            if unit_tower_id == tower_id:
                                UNIT_ID = unit.get('id')
                                print(f"✅ Found Unit 102: ID={UNIT_ID}")
                                break
                    if UNIT_ID:
                        break
            break

if not UNIT_ID:
    print("❌ Could not find Unit 102 in Tower Test")
    print("Please manually set UNIT_ID in the script")
    # As a fallback, try to use any unit
    print("\n📋 You can manually set the UNIT_ID by editing the script")
    print("   Or provide it as command line argument")
    exit(1)

# Step 3: Get active service fee
print("\n🔍 Getting active service fee...")
# Try service fee endpoint
try:
    sf_response = requests.get(f"{BASE_URL}/api/service-fees/service-fees/", headers=headers)
    if sf_response.status_code == 200:
        sfs = sf_response.json()
        service_fees = sfs if isinstance(sfs, list) else sfs.get('data', [])
        for sf in service_fees:
            if sf.get('is_active'):
                SERVICE_FEE_ID = sf.get('id')
                print(f"✅ Found active service fee: ID={SERVICE_FEE_ID}, Amount={sf.get('fee_amount')}")
                break
except:
    pass

if not SERVICE_FEE_ID:
    print("⚠️ Could not find service fee, using ID=2 as default")
    SERVICE_FEE_ID = 2  # Default from your system

# Step 4: Make advance payment
print(f"\n💰 Making advance payment of {ADVANCE_AMOUNT} BDT...")
print(f"   Unit ID: {UNIT_ID}")
print(f"   Service Fee ID: {SERVICE_FEE_ID}")

from datetime import datetime
current_date = datetime.now()
next_month = current_date.month + 1 if current_date.month < 12 else 1
next_year = current_date.year if current_date.month < 12 else current_date.year + 1

payload = {
    "unit_id": UNIT_ID,
    "service_fee_id": SERVICE_FEE_ID,
    "amount": ADVANCE_AMOUNT,
    "is_advance_payment": True,  # 🎯 THIS IS THE KEY FLAG!
    "service_period_month": next_month,
    "service_period_year": next_year,
    "customer_name": "Test Customer",
    "customer_email": "test@example.com",
    "customer_phone": "01700000000",
    "customer_address": "Dhaka, Bangladesh"
}

print(f"\n📤 Sending request...")
print(json.dumps(payload, indent=2))

payment_response = requests.post(
    f"{BASE_URL}/api/service-fee-management/payments/paystation/init/",
    headers=headers,
    json=payload
)

print(f"\n📡 Response Status: {payment_response.status_code}")
print(f"Response:")
print(json.dumps(payment_response.json(), indent=2))

if payment_response.status_code == 200:
    data = payment_response.json()
    if data.get('success'):
        print("\n" + "="*60)
        print("✅ ADVANCE PAYMENT INITIATED SUCCESSFULLY!")
        print("="*60)
        print(f"Payment URL: {data.get('data', {}).get('payment_url', 'N/A')}")
    else:
        print("\n" + "="*60)
        print("❌ PAYMENT FAILED!")
        print("="*60)
        print(f"Message: {data.get('message')}")
else:
    print("\n" + "="*60)
    print("❌ HTTP ERROR!")
    print("="*60)
