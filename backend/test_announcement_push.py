#!/usr/bin/env python
"""
Test creating an announcement to verify push notifications are sent
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from announcements.models import Announcement
from user.models import Member
from notifications.models import Notification
from django.utils import timezone
import json

User = get_user_model()

def test_announcement_push():
    print("=" * 80)
    print("TESTING ANNOUNCEMENT PUSH NOTIFICATION")
    print("=" * 80)
    
    # Get user12
    try:
        user = User.objects.get(username='user12')
        print(f"\n✅ Found user: {user.username}")
    except User.DoesNotExist:
        print("\n❌ User 'user12' not found")
        return
    
    # Get member
    try:
        member = Member.objects.get(user=user)
        print(f"✅ Found member: {member.full_name}")
    except Member.DoesNotExist:
        print("\n❌ Member profile not found for user12")
        return
    
    # Create test announcement
    print(f"\n📢 Creating test announcement...")
    
    announcement = Announcement.objects.create(
        title="🔔 Push Notification Test from API",
        description="This is a test announcement to verify push notifications are working. If you receive this notification in your phone's notification bar, FCM is working correctly!",
        creator=member,
        priority='high',
        start_date=timezone.now().date(),
        start_time=timezone.now().time(),
        end_date=(timezone.now() + timezone.timedelta(days=7)).date(),
        end_time=(timezone.now() + timezone.timedelta(days=7)).time(),
    )
    
    print(f"✅ Announcement created: #{announcement.id}")
    print(f"   Title: {announcement.title}")
    print(f"   Creator: {member.full_name}")
    print(f"   Priority: {announcement.priority}")
    
    # Wait a moment for signals to process
    import time
    time.sleep(2)
    
    # Check if notifications were created
    print(f"\n🔍 Checking for notifications...")
    notifications = Notification.objects.filter(
        entity_type='announcement',
        entity_id=announcement.id
    ).select_related('recipient')
    
    print(f"✅ Found {notifications.count()} notification(s)")
    
    for notif in notifications[:5]:  # Show first 5
        print(f"\n   📬 Notification #{notif.id}")
        print(f"      To: {notif.recipient.full_name}")
        print(f"      Title: {notif.title}")
        print(f"      Type: {notif.notification_type.code}")
        print(f"      Status: {notif.status}")
        print(f"      Created: {notif.created_at}")
        
        # Check metadata
        if notif.metadata:
            should_push = notif.metadata.get('should_send_push', False)
            print(f"      Should send push: {should_push}")
    
    # Check device tokens
    from notifications.models import DeviceToken
    active_tokens = DeviceToken.objects.filter(
        member=member,
        is_active=True,
        token_type='fcm'
    )
    
    print(f"\n📱 Active FCM device tokens for {member.full_name}: {active_tokens.count()}")
    for token in active_tokens:
        print(f"   - Token: {token.push_token[:30]}...")
        print(f"     Device: {token.device_type}")
        print(f"     Last used: {token.last_used_at}")
    
    print("\n" + "=" * 80)
    print("CHECK YOUR PHONE'S NOTIFICATION BAR!")
    print("You should see: '🔔 Push Notification Test from API'")
    print("=" * 80)
    
    return announcement

if __name__ == '__main__':
    test_announcement_push()
