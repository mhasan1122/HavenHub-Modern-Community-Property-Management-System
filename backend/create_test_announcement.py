#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Create a test announcement with urgent priority to trigger push notification
"""
import os
import sys
import django
from datetime import datetime, timedelta

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from announcements.models import Announcement
from user.models import Member
from django.utils import timezone
from django.contrib.auth.models import User

def main():
    print("\n" + "="*80)
    print("CREATING TEST ANNOUNCEMENT WITH PUSH NOTIFICATION")
    print("="*80)
    
    # Step 1: Get the user
    try:
        user = User.objects.get(username='user2912')
        member = user.member
        print(f"\n[OK] Found user: {user.username}")
        print(f"[OK] Member: {member.full_name} (ID: {member.id})")
    except User.DoesNotExist:
        print("\n[ERROR] User 'user2912' not found!")
        return
    except Exception as e:
        print(f"\n[ERROR] Could not get member: {e}")
        return
    
    # Step 2: Check device token
    from notifications.models import DeviceToken
    device_tokens = DeviceToken.objects.filter(member=member, is_active=True)
    print(f"\n[INFO] Active device tokens for this member: {device_tokens.count()}")
    for token in device_tokens:
        print(f"  - Token ID {token.id}: {token.push_token[:40]}...")
        print(f"    Device: {token.device_type} - {token.device_id}")
    
    # Step 3: Create the announcement
    now = timezone.now()
    
    announcement_data = {
        'title': f'URGENT TEST - Push Notification {now.strftime("%H:%M:%S")}',
        'description': 'This is an urgent test announcement to verify push notifications are working correctly. You should receive a notification on your device immediately!',
        'priority': 'urgent',  # This should trigger push notification
        'start_date': now.date(),
        'start_time': now.time(),
        'end_date': (now + timedelta(days=1)).date(),
        'end_time': now.time(),
        'creator': member,
        'post_as': 'creator',
    }
    
    print(f"\n[CREATING] Announcement with details:")
    print(f"  Title: {announcement_data['title']}")
    print(f"  Priority: {announcement_data['priority']}")
    print(f"  Description: {announcement_data['description'][:60]}...")
    
    try:
        announcement = Announcement.objects.create(**announcement_data)
        print(f"\n[SUCCESS] Announcement created!")
        print(f"  ID: {announcement.id}")
        print(f"  Title: {announcement.title}")
        print(f"  Priority: {announcement.priority}")
        print(f"  Status: {announcement.status}")
        print(f"  Created at: {announcement.created_at}")
        
        # Step 4: Manually trigger push notification (since we bypassed the view)
        from notifications.utils import send_announcement_published_notification
        
        print(f"\n[TRIGGERING] Push notification for announcement {announcement.id}...")
        notifications = send_announcement_published_notification(announcement)
        print(f"[OK] Created {len(notifications)} notification(s) and triggered push")
        
        # Step 5: Check if notification was created
        from notifications.models import Notification
        db_notifications = Notification.objects.filter(
            entity_type='announcement',
            entity_id=announcement.id
        ).order_by('-created_at')
        
        print(f"\n[INFO] Verifying notifications in database...")
        if db_notifications.exists():
            print(f"[OK] Found {db_notifications.count()} notification(s) for this announcement")
            for notif in db_notifications[:3]:  # Show first 3
                print(f"  - Notification ID {notif.id}:")
                print(f"    Recipient: {notif.recipient.full_name} (ID: {notif.recipient.id})")
                print(f"    Title: {notif.title}")
                print(f"    Type: {notif.notification_type.code if notif.notification_type else 'N/A'}")
                print(f"    Created: {notif.created_at}")
        else:
            print("[WARNING] No notifications found in database")
            print("           Push notification may have still been sent")
        
        print("\n" + "="*80)
        print("TEST ANNOUNCEMENT CREATED SUCCESSFULLY")
        print("="*80)
        print("\n[IMPORTANT] Check your mobile device NOW!")
        print("\nExpected:")
        print("  1. Push notification should appear on your device")
        print("  2. Notification title: 'Important Announcement' or similar")
        print(f"  3. Notification body should mention: '{announcement.title}'")
        print("\nIf you don't see it:")
        print("  1. Check mobile app logs (Terminal 4) for 'Notification received'")
        print("  2. Check backend logs (Terminal 3) for '[PUSH]'")
        print("  3. Ensure app is running (foreground or background)")
        print("  4. Check device notification permissions")
        
        print(f"\n[INFO] Announcement ID: {announcement.id}")
        print(f"[INFO] You can view it in the app's Announcements tab")
        
    except Exception as e:
        print(f"\n[ERROR] Failed to create announcement: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
