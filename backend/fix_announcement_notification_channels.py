"""
Fix announcement notifications that have the wrong channel setting
This ensures admin/org members can see announcement notifications on mobile

Run: python manage.py shell < fix_announcement_notification_channels.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from notifications.models import Notification
from django.utils import timezone

print("=" * 80)
print("FIXING ANNOUNCEMENT NOTIFICATION CHANNELS")
print("=" * 80)

# Find admin announcement notifications with channel='web'
admin_announcement_notifs = Notification.objects.filter(
    notification_type__code__in=[
        'admin_announcement_published',
        'admin_announcement_ongoing',
        'admin_announcement_scheduled'
    ],
    channel='web'
)

total = admin_announcement_notifs.count()
print(f"\n📊 Found {total} admin announcement notifications with channel='web'")

if total == 0:
    print("✅ No notifications need fixing!")
else:
    print(f"\n🔧 Fixing channel from 'web' to 'both' to make them visible on mobile...")
    
    # Update all in one query
    updated = admin_announcement_notifs.update(channel='both')
    
    print(f"✅ Updated {updated} notifications to channel='both'")
    print(f"\n📱 These notifications will now be visible on both web and mobile apps")

# Also check regular announcement notifications
print(f"\n" + "=" * 80)
print("CHECKING REGULAR ANNOUNCEMENT NOTIFICATIONS")
print("=" * 80)

regular_announcement_notifs = Notification.objects.filter(
    notification_type__code__in=[
        'announcement_published',
        'announcement_ongoing',
        'announcement_updated'
    ]
)

total_regular = regular_announcement_notifs.count()
print(f"\n📊 Found {total_regular} regular announcement notifications")

if total_regular > 0:
    # Group by channel
    web_only = regular_announcement_notifs.filter(channel='web').count()
    mobile_only = regular_announcement_notifs.filter(channel='mobile').count()
    both = regular_announcement_notifs.filter(channel='both').count()
    
    print(f"   📡 Channel distribution:")
    print(f"      • Web only: {web_only}")
    print(f"      • Mobile only: {mobile_only}")
    print(f"      • Both: {both}")
    
    if web_only > 0:
        print(f"\n   ⚠️  Found {web_only} regular notifications with channel='web'")
        print(f"       These should normally be 'both' or 'mobile'")
        print(f"       Fixing them now...")
        
        fixed = regular_announcement_notifs.filter(channel='web').update(channel='both')
        print(f"       ✅ Fixed {fixed} notifications to channel='both'")

print(f"\n" + "=" * 80)
print("✅ DONE!")
print("=" * 80)
print("\nSummary:")
print("  • Admin announcement notifications: Set to 'both' (visible on web and mobile)")
print("  • Regular announcement notifications: Set to 'both' or 'mobile' as appropriate")
print("\nMobile apps should now receive announcement notifications!")
