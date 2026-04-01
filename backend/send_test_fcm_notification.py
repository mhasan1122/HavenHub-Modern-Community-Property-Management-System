#!/usr/bin/env python
"""
Send a test FCM notification to verify push notifications are working
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from notifications.models import DeviceToken
from notifications.fcm_service import send_fcm_notification

def send_test_notification():
    print("=" * 80)
    print("SENDING TEST FCM NOTIFICATION")
    print("=" * 80)
    
    # Get the most recent FCM device token
    fcm_tokens = DeviceToken.objects.filter(
        token_type='fcm',
        is_active=True
    ).order_by('-created_at')[:5]
    
    if not fcm_tokens:
        print("❌ No FCM tokens found in database")
        print("   Make sure you've logged into the app and registered the device")
        return
    
    print(f"\n✅ Found {fcm_tokens.count()} FCM token(s)")
    
    for device_token in fcm_tokens:
        print(f"\n📱 Sending to device:")
        print(f"   - Member: {device_token.member.full_name}")
        print(f"   - Token: {device_token.push_token[:30]}...")
        print(f"   - Device: {device_token.device_type}")
        print(f"   - Created: {device_token.created_at}")
        
        # Send test notification
        result = send_fcm_notification(
            token=device_token.push_token,
            title="🎉 Test Notification",
            body="This is a test push notification from Estate Link! If you can see this in your notification bar, FCM is working! 🚀",
            data={
                'test': 'true',
                'message': 'FCM notification test',
                'timestamp': str(device_token.created_at)
            },
            priority='high',
            sound='default'
        )
        
        print(f"\n📤 Result:")
        if result.get('success'):
            print(f"   ✅ SUCCESS! Message ID: {result.get('message_id')}")
            print(f"   📱 Check your phone's notification bar!")
        else:
            print(f"   ❌ FAILED: {result.get('error')}")
    
    print("\n" + "=" * 80)
    print("If successful, you should see a notification in your phone's notification bar!")
    print("=" * 80)

if __name__ == '__main__':
    send_test_notification()
