"""
Debug script to trace bulletin notification issue
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from notifications.utils import get_bulletin_recipients, create_bulletin_posted_notification
from user.models import Member

# Get a bulletin that was created and approved by the same user
bulletins = Bulletin.objects.filter(status='current').order_by('-id')[:5]

print("="*80)
print("DEBUGGING BULLETIN NOTIFICATIONS")
print("="*80)

for bulletin in bulletins:
    print(f"\nBulletin ID: {bulletin.id}")
    print(f"Title: {bulletin.title}")
    print(f"Status: {bulletin.status}")
    print(f"Creator: {bulletin.creator.full_name if bulletin.creator else 'None'} (ID: {bulletin.creator.id if bulletin.creator else 'None'})")
    print(f"Target Towers: {bulletin.target_towers.count()}")
    print(f"Target Units: {bulletin.target_units.count()}")
    
    # Get recipients
    recipients = get_bulletin_recipients(bulletin)
    print(f"\nRecipients found: {len(recipients)}")
    
    if len(recipients) > 0:
        print("\nRecipient details:")
        for i, recipient in enumerate(recipients[:10], 1):  # Show first 10
            print(f"  {i}. {recipient.full_name} (ID: {recipient.id}, is_org_member: {recipient.is_org_member})")
        
        if len(recipients) > 10:
            print(f"  ... and {len(recipients) - 10} more")
    
    # Check if creator is in recipients
    if bulletin.creator:
        creator_in_recipients = bulletin.creator in recipients
        print(f"\nCreator in recipients: {creator_in_recipients}")
    
    print("-"*80)
