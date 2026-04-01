"""
Test to verify bulletin notification fix for self-approved bulletins
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from notifications.models import Notification
from notifications.utils import create_bulletin_posted_notification

print("="*80)
print("TESTING BULLETIN NOTIFICATION FIX")
print("="*80)

# Find a bulletin that was created and approved by the same user
bulletins = Bulletin.objects.filter(status='current').order_by('-id')[:3]

for bulletin in bulletins:
    print(f"\n{'='*80}")
    print(f"Bulletin ID: {bulletin.id}")
    print(f"Title: {bulletin.title}")
    print(f"Creator: {bulletin.creator.full_name if bulletin.creator else 'None'}")
    print(f"Status: {bulletin.status}")
    
    # Check existing bulletin_posted notifications
    existing_notifications = Notification.objects.filter(
        entity_type='bulletin',
        entity_id=bulletin.id,
        notification_type__code='bulletin_posted'
    )
    
    print(f"\nExisting 'bulletin_posted' notifications: {existing_notifications.count()}")
    
    if existing_notifications.count() > 0:
        print(f"Sample recipients (first 5):")
        for notif in existing_notifications[:5]:
            print(f"  - {notif.recipient.full_name} (ID: {notif.recipient.id})")
        
        # Check if creator received notification
        creator_notif = existing_notifications.filter(recipient=bulletin.creator)
        print(f"\nCreator received notification: {creator_notif.exists()}")
    else:
        print("\n⚠️ No bulletin_posted notifications found - this bulletin may not have sent notifications properly")

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
