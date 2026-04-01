"""
Comprehensive test for priority change push notifications
Run with: python manage.py shell < test_priority_push.py
"""

from announcements.models import Announcement
from notifications.models import Notification, DeviceToken
from notifications.utils import send_announcement_priority_changed_notification
from django.db.models import Q

print("\n" + "=" * 70)
print("TESTING ANNOUNCEMENT PRIORITY CHANGE PUSH NOTIFICATIONS")
print("=" * 70)

# Check device tokens registered
print("\n📱 CHECKING DEVICE TOKENS:")
device_tokens = DeviceToken.objects.all()
print(f"Total device tokens registered: {device_tokens.count()}")
if device_tokens.exists():
    for token in device_tokens[:5]:
        print(f"  - Member: {token.member.full_name if token.member else 'N/A'}")
        print(f"    Token: {token.push_token[:50]}...")
        print(f"    Type: {token.token_type}")
        print(f"    Device: {token.device_type}")
        print(f"    Active: {token.is_active}")
        print()
else:
    print("  ⚠️ No device tokens found! Users need to login on mobile to register tokens.")

# Find announcement to test with
print("\n🔍 FINDING TEST ANNOUNCEMENT:")
announcement = Announcement.objects.filter(
    status__in=['ongoing', 'upcoming']
).order_by('-created_at').first()

if not announcement:
    print("❌ No announcements found!")
    exit()

print(f"  ✓ Found announcement ID: {announcement.id}")
print(f"    Title: {announcement.title}")
print(f"    Current Priority: {announcement.priority}")
print(f"    Status: {announcement.status}")

# Set to low priority first if not already
if announcement.priority.lower() != 'low':
    print(f"\n🔄 Setting priority to 'low' first for testing...")
    announcement.priority = 'low'
    announcement.save()
    print(f"    ✓ Priority set to: {announcement.priority}")

old_priority = announcement.priority
print(f"\n🚀 TESTING: Changing priority from {old_priority} to High...")

# Update to high priority
announcement.priority = 'high'
announcement.save()
announcement.refresh_from_db()

print(f"  ✓ Priority updated to: {announcement.priority}")

# Send notifications
print("\n📨 SENDING PRIORITY CHANGE NOTIFICATIONS:")
try:
    notifications = send_announcement_priority_changed_notification(announcement, old_priority)
    print(f"  ✓ Created {len(notifications)} notifications")
    
    if notifications:
        print(f"\n📋 NOTIFICATION DETAILS:")
        for i, notif in enumerate(notifications[:3], 1):
            print(f"  #{i} Recipient: {notif.recipient.full_name}")
            print(f"     Title: {notif.title}")
            print(f"     Message: {notif.message[:80]}...")
            print(f"     Should send push: {notif.metadata.get('should_send_push', False)}")
            print(f"     Notification ID: {notif.id}")
            
        if len(notifications) > 3:
            print(f"  ... and {len(notifications) - 3} more")
    
    # Check if push was actually sent
    print("\n🔔 PUSH NOTIFICATION STATUS:")
    from notifications.models import Notification
    recent_notif = notifications[0] if notifications else None
    if recent_notif:
        # Check device token for the recipient
        recipient_tokens = DeviceToken.objects.filter(
            member=recent_notif.recipient,
            is_active=True
        )
        print(f"  Recipient: {recent_notif.recipient.full_name}")
        print(f"  Device tokens: {recipient_tokens.count()}")
        if recipient_tokens.exists():
            for token in recipient_tokens:
                print(f"    - Token: {token.push_token[:50]}...")
                print(f"      Type: {token.token_type}")
                print(f"      Device: {token.device_type}")
        else:
            print(f"  ⚠️ No active device tokens for this user!")
            print(f"  User needs to login on mobile app to register for push notifications.")
    
    print("\n" + "=" * 70)
    print("✅ TEST COMPLETED")
    print("=" * 70)
    print("\n📱 NEXT STEPS:")
    print("1. Check your mobile device for the push notification")
    print("2. Expected title: 'Important Announcement'")
    print(f"3. Expected message: Contains '{announcement.title}'")
    print("\nIf no push notification:")
    print("  - Make sure you're logged into the mobile app")
    print("  - Kill and restart the mobile app")
    print("  - Check device notification settings")
    print("  - Run: adb logcat -d | grep -i 'fcm\\|notification\\|push' | tail -50")
    
except Exception as e:
    print(f"❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
