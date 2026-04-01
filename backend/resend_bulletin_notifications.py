"""
Re-send bulletin posted notifications for existing bulletins that don't have them
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from notifications.models import Notification
from notifications.utils import create_bulletin_posted_notification

print("="*80)
print("RE-SENDING BULLETIN POSTED NOTIFICATIONS")
print("="*80)

# Find bulletins with status 'current' that don't have bulletin_posted notifications
current_bulletins = Bulletin.objects.filter(status='current').order_by('-id')

bulletins_needing_notifications = []

for bulletin in current_bulletins:
    # Check if bulletin has bulletin_posted notifications
    existing_notifications = Notification.objects.filter(
        entity_type='bulletin',
        entity_id=bulletin.id,
        notification_type__code='bulletin_posted'
    ).count()
    
    if existing_notifications == 0:
        bulletins_needing_notifications.append(bulletin)

print(f"\nFound {len(bulletins_needing_notifications)} bulletins without 'bulletin_posted' notifications")

if bulletins_needing_notifications:
    print("\nBulletins that need notifications:")
    for bulletin in bulletins_needing_notifications:
        print(f"  - ID: {bulletin.id}, Title: {bulletin.title}, Creator: {bulletin.creator.full_name if bulletin.creator else 'None'}")

    response = input("\nDo you want to re-send notifications for these bulletins? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        print("\nRe-sending notifications...")
        for bulletin in bulletins_needing_notifications:
            try:
                print(f"\nProcessing bulletin {bulletin.id}: {bulletin.title}")
                notifications = create_bulletin_posted_notification(bulletin)
                print(f"  ✓ Created {len(notifications)} notifications")
            except Exception as e:
                print(f"  ✗ Error: {e}")
        
        print("\n" + "="*80)
        print("NOTIFICATION RE-SEND COMPLETE")
        print("="*80)
    else:
        print("\nOperation cancelled.")
else:
    print("\nAll bulletins already have notifications. Nothing to do.")

print("\n" + "="*80)
