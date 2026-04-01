#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script to send a push notification to registered devices
"""
import os
import sys
import django

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
from notifications.push_service import send_push_notification_to_members
from user.models import Member

def main():
    print("\n" + "="*80)
    print("TESTING PUSH NOTIFICATION SENDING")
    print("="*80)
    
    # Step 1: Get all device tokens
    tokens = DeviceToken.objects.filter(is_active=True)
    print(f"\n[OK] Found {tokens.count()} active device token(s)")
    
    if tokens.count() == 0:
        print("[ERROR] No active device tokens found!")
        print("Please make sure you've logged into the mobile app and allowed notifications.")
        return
    
    # Step 2: Show all tokens
    print("\nActive device tokens:")
    for token in tokens:
        print(f"  - ID {token.id}: {token.member.full_name} ({token.device_type})")
        print(f"    Token: {token.push_token[:40]}...")
        print(f"    Device: {token.device_id}")
        print()
    
    # Step 3: Send test notification to each device
    print("="*80)
    print("SENDING TEST NOTIFICATIONS")
    print("="*80)
    
    for token in tokens:
        print(f"\n[SENDING] Test notification to {token.member.full_name}...")
        print(f"  Device: {token.device_type} - {token.device_id}")
        print(f"  Token: {token.push_token[:40]}...")
        
        try:
            result = send_push_notification_to_members(
                members=[token.member],
                title="Test Notification",
                body=f"This is a test push notification!",
                data={
                    'type': 'test',
                    'test_id': 'manual_test',
                    'timestamp': str(timezone.now())
                }
            )
            
            if result:
                print(f"  [SUCCESS] Push notification sent successfully!")
                print(f"  Response: {result}")
            else:
                print(f"  [FAILED] Failed to send push notification")
                
        except Exception as e:
            print(f"  [ERROR] Exception: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*80)
    print("TEST COMPLETED")
    print("="*80)
    print("\n[IMPORTANT] Check your mobile device now!")
    print("You should receive a test notification.")
    print("\nIf you don't see it:")
    print("  1. Check if notifications are enabled in phone settings")
    print("  2. Check if the Expo app has notification permission")
    print("  3. Make sure the app is running in the background or foreground")
    print("  4. Check the backend logs above for any errors")

if __name__ == '__main__':
    from django.utils import timezone
    main()
