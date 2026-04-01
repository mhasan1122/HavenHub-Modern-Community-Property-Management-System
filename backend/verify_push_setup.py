#!/usr/bin/env python
"""
Quick verification script to check push notification setup
Run from backend directory: python verify_push_setup.py
"""
import os
import sys
import json
from pathlib import Path

# Add parent directory to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

print("=" * 80)
print("PUSH NOTIFICATION SETUP VERIFICATION")
print("=" * 80)
print()

# Check 1: Firebase credentials file
print("1. Checking Firebase credentials file...")
try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    import django
    django.setup()
    from django.conf import settings
    fcm_credentials_path = Path(getattr(settings, 'FCM_CREDENTIALS_PATH', str(BASE_DIR / 'estatelink-9ac38-firebase-adminsdk-fbsvc-c273bf8116.json')))
except Exception:
    fcm_credentials_path = BASE_DIR / 'estatelink-9ac38-firebase-adminsdk-fbsvc-c273bf8116.json'

if fcm_credentials_path.exists():
    try:
        with open(fcm_credentials_path, 'r') as f:
            creds = json.load(f)
        print(f"   ✅ Firebase credentials file exists: {fcm_credentials_path.name}")
        if creds.get('type') == 'service_account':
            print(f"   ✅ Project ID: {creds.get('project_id')}")
            print(f"   ✅ Client Email: {creds.get('client_email')}")
        else:
            print(f"   ⚠️  This is google-services.json. Backend FCM needs a SERVICE ACCOUNT key.")
    except Exception as e:
        print(f"   ❌ Error reading credentials: {e}")
else:
    print(f"   ❌ Firebase credentials file not found at: {fcm_credentials_path}")

print()

# Check 2: Django settings
print("2. Checking Django settings...")
try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    import django
    django.setup()
    
    from django.conf import settings
    
    fcm_enabled = getattr(settings, 'FCM_ENABLED', False)
    fcm_credentials_path_setting = getattr(settings, 'FCM_CREDENTIALS_PATH', None)
    expo_token = getattr(settings, 'EXPO_ACCESS_TOKEN', None)
    
    print(f"   ✅ Django settings loaded")
    print(f"   {'✅' if fcm_enabled else '❌'} FCM_ENABLED: {fcm_enabled}")
    print(f"   {'✅' if fcm_credentials_path_setting else '❌'} FCM_CREDENTIALS_PATH: {fcm_credentials_path_setting}")
    print(f"   {'✅' if expo_token else '⚠️ '} EXPO_ACCESS_TOKEN: {'Set' if expo_token else 'Not set (optional)'}")
    
except Exception as e:
    print(f"   ❌ Error loading Django settings: {e}")
    print(f"   Note: Make sure you're running from backend directory with Django installed")

print()

# Check 3: Firebase Admin SDK
print("3. Checking Firebase Admin SDK...")
try:
    import firebase_admin
    print(f"   ✅ firebase-admin installed")
    
    # Try to check if initialized
    try:
        app = firebase_admin.get_app()
        print(f"   ✅ Firebase Admin SDK is initialized")
    except ValueError:
        print(f"   ⚠️  Firebase Admin SDK not yet initialized (will initialize on Django startup)")
        
except ImportError:
    print(f"   ❌ firebase-admin not installed")
    print(f"   Install with: pip install firebase-admin==6.5.0")

print()

# Check 4: FCM Service
print("4. Checking FCM service...")
try:
    from notifications.fcm_service import initialize_fcm, FCM_AVAILABLE, is_fcm_token
    
    print(f"   {'✅' if FCM_AVAILABLE else '❌'} FCM_AVAILABLE: {FCM_AVAILABLE}")
    
    # Test token detection
    expo_token_test = "ExponentPushToken[test123]"
    fcm_token_test = "dGVzdF9mY21fdG9rZW5fMTIzNDU2Nzg5MA=="
    
    print(f"   ✅ Token detection working:")
    print(f"      - Expo token detection: {not is_fcm_token(expo_token_test)}")
    print(f"      - FCM token detection: {is_fcm_token(fcm_token_test)}")
    
except Exception as e:
    print(f"   ❌ Error checking FCM service: {e}")

print()

# Check 5: Unified Push Service
print("5. Checking Unified Push Service...")
try:
    from notifications.unified_push_service import detect_token_type, send_unified_push_notification
    
    print(f"   ✅ Unified push service imported")
    
    # Test token type detection
    expo_token_test = "ExponentPushToken[test123]"
    fcm_token_test = "dGVzdF9mY21fdG9rZW5fMTIzNDU2Nzg5MA=="
    
    print(f"   ✅ Token type detection:")
    print(f"      - Expo token: {detect_token_type(expo_token_test)}")
    print(f"      - FCM token: {detect_token_type(fcm_token_test)}")
    
except Exception as e:
    print(f"   ❌ Error checking unified push service: {e}")

print()

# Check 6: Database Model
print("6. Checking Database Model...")
try:
    from notifications.models import DeviceToken
    
    # Check if token_type field exists
    fields = [f.name for f in DeviceToken._meta.get_fields()]
    has_token_type = 'token_type' in fields
    
    print(f"   {'✅' if has_token_type else '❌'} DeviceToken.token_type field: {'Exists' if has_token_type else 'Missing'}")
    print(f"   ✅ DeviceToken.push_token max_length: {DeviceToken._meta.get_field('push_token').max_length}")
    
except Exception as e:
    print(f"   ❌ Error checking database model: {e}")
    print(f"   Note: Make sure migrations have been applied")

print()

# Check 7: Mobile App Configuration
print("7. Checking Mobile App Configuration...")
app_json_path = BASE_DIR.parent / 'Estate_link_App' / 'app.json'
google_services_path = BASE_DIR.parent / 'Estate_link_App' / 'google-services.json'

if app_json_path.exists():
    try:
        with open(app_json_path, 'r') as f:
            app_config = json.load(f)
        print(f"   ✅ app.json exists")
        
        android_config = app_config.get('expo', {}).get('android', {})
        google_services_file = android_config.get('googleServicesFile')
        
        print(f"   {'✅' if google_services_file else '❌'} googleServicesFile: {google_services_file}")
        print(f"   ✅ Package name: {android_config.get('package', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error reading app.json: {e}")
else:
    print(f"   ⚠️  app.json not found at: {app_json_path}")

if google_services_path.exists():
    try:
        with open(google_services_path, 'r') as f:
            google_services = json.load(f)
        print(f"   ✅ google-services.json exists")
        print(f"   ✅ Project ID: {google_services.get('project_info', {}).get('project_id')}")
    except Exception as e:
        print(f"   ❌ Error reading google-services.json: {e}")
else:
    print(f"   ⚠️  google-services.json not found at: {google_services_path}")

print()

# Summary
print("=" * 80)
print("VERIFICATION SUMMARY")
print("=" * 80)
print()
print("✅ = Ready")
print("⚠️  = Warning (may need attention)")
print("❌ = Error (needs fixing)")
print()
print("Next steps:")
print("1. If migrations not applied: python manage.py migrate notifications")
print("2. Start Django server and check logs for FCM initialization")
print("3. Test token registration via API")
print("4. Test push notification sending")
print("=" * 80)
