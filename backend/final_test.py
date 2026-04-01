"""
Final test: Change priority and immediately check device for push
Run with: python manage.py shell < final_test.py
"""

from announcements.models import Announcement
from notifications.utils import send_announcement_priority_changed_notification

print("\n" + "=" * 70)
print("FINAL PUSH NOTIFICATION TEST")
print("=" * 70)

# Find announcement
announcement = Announcement.objects.filter(
    status__in=['ongoing', 'upcoming']
).order_by('-created_at').first()

if not announcement:
    print("❌ No announcements found!")
    exit()

print(f"\n📢 Testing with Announcement ID: {announcement.id}")
print(f"   Title: {announcement.title}")
print(f"   Current Priority: {announcement.priority}")

# Set to low first
if announcement.priority.lower() != 'low':
    announcement.priority = 'low'
    announcement.save()
    print(f"   → Set to 'low' for testing")

old_priority = announcement.priority

# Change to URGENT for maximum impact
print(f"\n🚀 Changing priority: {old_priority} → URGENT")
announcement.priority = 'urgent'
announcement.save()
announcement.refresh_from_db()

# Send notifications
notifications = send_announcement_priority_changed_notification(announcement, old_priority)

print(f"\n✅ DONE!")
print(f"   Created {len(notifications)} notifications")
print(f"   Push notifications sent with title: 'Urgent Announcement'")
print(f"\n📱 CHECK YOUR DEVICE NOW!")
print(f"   You should see a push notification with:")
print(f"   Title: 'Urgent Announcement'")
print(f"   Message: 'URGENT: {announcement.title}'")
print("\n" + "=" * 70)
