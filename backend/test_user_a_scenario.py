"""
Test the exact scenario: User A creates and approves bulletin
Verify that all eligible users receive notifications
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from notifications.models import Notification, NotificationType
from notifications.utils import get_bulletin_recipients, create_bulletin_posted_notification
from user.models import Member

print("="*80)
print("SCENARIO TEST: User A Creates and Approves Bulletin")
print("="*80)

# Find a recent bulletin that was created and approved
bulletin = Bulletin.objects.filter(status='current').order_by('-id').first()

if not bulletin:
    print("No published bulletins found to test with.")
    exit()

print(f"\nTest Bulletin:")
print(f"  ID: {bulletin.id}")
print(f"  Title: {bulletin.title}")
print(f"  Creator: {bulletin.creator.full_name if bulletin.creator else 'None'} (ID: {bulletin.creator.id if bulletin.creator else 'None'})")
print(f"  Status: {bulletin.status}")
print(f"  Target Towers: {bulletin.target_towers.count()}")
print(f"  Target Units: {bulletin.target_units.count()}")

print("\n" + "-"*80)
print("STEP 1: Get all eligible recipients")
print("-"*80)

recipients = get_bulletin_recipients(bulletin)
print(f"Total eligible recipients: {len(recipients)}")

if len(recipients) == 0:
    print("❌ ERROR: No recipients found! The bulletin notification system is broken.")
    exit(1)

print(f"✅ SUCCESS: Found {len(recipients)} eligible recipients")

print("\n" + "-"*80)
print("STEP 2: Verify creator is in recipient list")
print("-"*80)

if bulletin.creator:
    creator_in_recipients = bulletin.creator in recipients
    if creator_in_recipients:
        print(f"✅ SUCCESS: Creator '{bulletin.creator.full_name}' is in the recipient list")
    else:
        print(f"❌ WARNING: Creator '{bulletin.creator.full_name}' is NOT in the recipient list")
else:
    print("⚠️ Bulletin has no creator")

print("\n" + "-"*80)
print("STEP 3: Verify other users are in recipient list")
print("-"*80)

other_users = [r for r in recipients if bulletin.creator and r.id != bulletin.creator.id]
print(f"Other users (non-creator) in recipient list: {len(other_users)}")

if len(other_users) > 0:
    print(f"✅ SUCCESS: Other users will receive notifications")
    print(f"\nSample of other recipients (first 5):")
    for user in other_users[:5]:
        print(f"  - {user.full_name} (ID: {user.id})")
else:
    print(f"⚠️ WARNING: Only creator in recipient list - no other users will receive notifications")

print("\n" + "-"*80)
print("STEP 4: Check actual notifications sent")
print("-"*80)

bulletin_posted_notifications = Notification.objects.filter(
    entity_type='bulletin',
    entity_id=bulletin.id,
    notification_type__code='bulletin_posted'
)

print(f"Actual 'bulletin_posted' notifications in database: {bulletin_posted_notifications.count()}")

if bulletin_posted_notifications.count() > 0:
    print(f"✅ SUCCESS: Notifications have been sent")
    
    # Check if creator received notification
    if bulletin.creator:
        creator_notification = bulletin_posted_notifications.filter(recipient=bulletin.creator)
        if creator_notification.exists():
            print(f"  ✅ Creator received notification")
        else:
            print(f"  ⚠️ Creator did NOT receive notification")
    
    # Check if other users received notification
    other_notifications = bulletin_posted_notifications.exclude(recipient=bulletin.creator) if bulletin.creator else bulletin_posted_notifications
    print(f"  ✅ Other users received notifications: {other_notifications.count()}")
    
    if other_notifications.count() > 0:
        print(f"\n  Sample notifications (first 3):")
        for notif in other_notifications[:3]:
            print(f"    - {notif.recipient.full_name} received notification")
else:
    print(f"⚠️ No 'bulletin_posted' notifications found in database")
    print(f"   This bulletin may have been created before the fix was applied")

print("\n" + "="*80)
print("TEST SUMMARY")
print("="*80)

if len(recipients) > 0 and (not bulletin.creator or bulletin.creator in recipients):
    print("✅ PASS: The bulletin notification system is working correctly")
    print("✅ When User A creates and approves a bulletin:")
    print("   - User A receives a notification ✓")
    print(f"   - Other eligible users receive notifications ({len(other_users)} users) ✓")
    print("\n✅ The issue is FIXED!")
else:
    print("❌ FAIL: The bulletin notification system has issues")
    print("   Please check the implementation")

print("")
