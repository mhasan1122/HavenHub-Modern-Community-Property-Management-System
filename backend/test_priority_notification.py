"""
Django management command to test priority change notification
Run with: python manage.py shell < test_priority_notification.py
"""

from announcements.models import Announcement
from notifications.utils import send_announcement_priority_changed_notification
from django.db.models import Q

print("=" * 60)
print("TESTING ANNOUNCEMENT PRIORITY CHANGE NOTIFICATION")
print("=" * 60)

# Find an announcement with Low priority or create one
announcement = Announcement.objects.filter(
    priority__iexact='low',
    status__in=['ongoing', 'upcoming']
).order_by('-created_at').first()

if not announcement:
    print("\n❌ No Low priority announcement found")
    print("Trying to find ANY announcement to test with...")
    announcement = Announcement.objects.filter(
        status__in=['ongoing', 'upcoming']
    ).order_by('-created_at').first()
    
    if announcement:
        print(f"Found announcement with {announcement.priority} priority, setting to Low first...")
        announcement.priority = 'low'
        announcement.save()
    else:
        print("No announcements found. Please create one first.")
        exit()

print(f"\n✓ Found announcement:")
print(f"  ID: {announcement.id}")
print(f"  Title: {announcement.title}")
print(f"  Current Priority: {announcement.priority}")
print(f"  Status: {announcement.status}")
print(f"  Creator: {announcement.creator.full_name if announcement.creator else 'N/A'}")

# Store old priority
old_priority = announcement.priority

# Update priority to High
print(f"\n🔄 Changing priority from {old_priority} to High...")
announcement.priority = 'high'
announcement.save()

print(f"✓ Priority updated in database: {announcement.priority}")

# Refresh from DB to ensure we have latest data
announcement.refresh_from_db()

# Send notifications
print("\n📨 Sending priority change notifications...")
try:
    notifications = send_announcement_priority_changed_notification(announcement, old_priority)
    print(f"\n✓ SUCCESS! Created {len(notifications)} notifications")
    
    if notifications:
        print("\nNotification details:")
        for notif in notifications[:5]:  # Show first 5
            print(f"  - Recipient: {notif.recipient.full_name}")
            print(f"    Title: {notif.title}")
            print(f"    Message: {notif.message[:100]}...")
            print(f"    Should send push: {notif.metadata.get('should_send_push', False)}")
            print()
        
        if len(notifications) > 5:
            print(f"  ... and {len(notifications) - 5} more recipients")
    
    print("\n" + "=" * 60)
    print("✅ TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("\nCheck your mobile device for push notifications")
    print(f"Expected title: 'Important Announcement'")
    print(f"Expected message: Contains '{announcement.title}'")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
