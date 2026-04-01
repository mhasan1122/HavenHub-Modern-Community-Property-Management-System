#!/usr/bin/env python
"""
Test script to create announcement and notice, then verify push notifications
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from announcements.models import Announcement
from noticeboard.models import Notice
from user.models import Member
from notifications.models import DeviceToken, Notification
from notifications.push_service import send_push_notification_to_members
from datetime import datetime, timedelta
from django.utils import timezone

print("=" * 80)
print("🧪 Testing Announcement & Notice Push Notifications")
print("=" * 80)
print()

# Get user (creator)
try:
    user = Member.objects.get(user__username='user12')
    print(f"✅ Found user: {user.full_name} (ID: {user.id})")
except Member.DoesNotExist:
    user = Member.objects.filter(is_org_member=True).first()
    print(f"✅ Using user: {user.full_name} (ID: {user.id})")

# Check device tokens
tokens = DeviceToken.objects.filter(is_active=True, member=user)
print(f"\n📱 User has {tokens.count()} active device token(s)")
for token in tokens:
    print(f"   • {token.token_type} token")

print("\n" + "=" * 80)
print("1️⃣  TESTING ANNOUNCEMENT")
print("=" * 80)

# Create a test announcement
now = timezone.now()
announcement = Announcement.objects.create(
    title="🧪 TEST ANNOUNCEMENT",
    description="This is a test announcement to verify mobile push notifications work correctly.",
    creator=user,
    post_as='creator',
    priority='high',
    label='General',
    status='ongoing',  # Set to ongoing so it's active
    start_date=now.date(),
    start_time=now.time(),
    end_date=(now + timedelta(days=7)).date(),
    end_time=(now + timedelta(days=7)).time()
)

print(f"✅ Created announcement #{announcement.id}: {announcement.title}")
print(f"   Status: {announcement.status}")
print(f"   Priority: {announcement.priority}")

# Check if notifications were created
notifs = Notification.objects.filter(entity_type='announcement', entity_id=announcement.id)
print(f"\n📬 Notifications created: {notifs.count()}")
for notif in notifs:
    print(f"   • To: {notif.recipient.full_name}")
    print(f"     Should send push: {notif.metadata.get('should_send_push', False)}")

# If creator is the recipient, manually send push
if notifs.filter(recipient=user).exists():
    print("\n🔔 Sending push notification for announcement...")
    result = send_push_notification_to_members(
        members=[user],
        title=f"New Announcement: {announcement.title}",
        body=announcement.description or "A new announcement has been posted",
        data={
            'entityType': 'announcement',
            'entityId': str(announcement.id),
            'announcementId': str(announcement.id),
        },
        priority='high',
        sound='default'
    )
    print(f"   ✅ Success: {result.get('success_count', 0)} notifications sent")
    print(f"   ❌ Errors: {result.get('error_count', 0)}")

print("\n" + "=" * 80)
print("2️⃣  TESTING NOTICE")
print("=" * 80)

# Create a test notice
notice = Notice.objects.create(
    title="🧪 TEST NOTICE",
    description="This is a test notice to verify mobile push notifications work correctly.",
    creator=user,
    post_as='creator',
    priority='urgent',
    label='Important',
    status='ongoing',
    start_date=now.date(),
    start_time=now.time(),
    end_date=(now + timedelta(days=7)).date(),
    end_time=(now + timedelta(days=7)).time()
)

print(f"✅ Created notice #{notice.id}: {notice.title}")
print(f"   Status: {notice.status}")
print(f"   Priority: {notice.priority}")

# Check if notifications were created
notifs = Notification.objects.filter(entity_type='notice', entity_id=notice.id)
print(f"\n📬 Notifications created: {notifs.count()}")
for notif in notifs:
    print(f"   • To: {notif.recipient.full_name}")
    print(f"     Should send push: {notif.metadata.get('should_send_push', False)}")

# If creator is the recipient, manually send push
if notifs.filter(recipient=user).exists():
    print("\n🔔 Sending push notification for notice...")
    result = send_push_notification_to_members(
        members=[user],
        title=f"New Notice: {notice.title}",
        body=notice.description or "A new notice has been posted",
        data={
            'entityType': 'notice',
            'entityId': str(notice.id),
            'noticeId': str(notice.id),
        },
        priority='high',
        sound='default'
    )
    print(f"   ✅ Success: {result.get('success_count', 0)} notifications sent")
    print(f"   ❌ Errors: {result.get('error_count', 0)}")

print("\n" + "=" * 80)
print("✅ TEST COMPLETE")
print("=" * 80)
print("\n📱 Check your mobile device notification bar!")
print("   You should see notifications for:")
print("   • Test Announcement")
print("   • Test Notice")
print()
