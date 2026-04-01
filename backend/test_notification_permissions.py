#!/usr/bin/env python
"""
Test script to verify notification permissions are working correctly for community members
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from notifications.models import Notification
from notifications.utils import has_view_permission, should_show_notification

def test_member_permissions(member_id=41):
    """Test notification permissions for a specific member"""
    try:
        member = Member.objects.get(id=member_id)
        print(f"\n{'='*60}")
        print(f"Testing Notification Permissions for Member {member_id}")
        print(f"{'='*60}")
        print(f"Member: {member.full_name}")
        print(f"is_comm_member: {member.is_comm_member}")
        print(f"is_org_member: {member.is_org_member}")
        print(f"\nPermission Checks:")
        print(f"  - Can view announcements: {has_view_permission(member, 'announcement')}")
        print(f"  - Can view bulletins: {has_view_permission(member, 'bulletin')}")
        print(f"  - Can view notices: {has_view_permission(member, 'notice')}")
        
        # Check notifications
        print(f"\n{'='*60}")
        print(f"Notification Statistics")
        print(f"{'='*60}")
        all_notifications = Notification.objects.filter(recipient=member)
        print(f"Total notifications in DB for member: {all_notifications.count()}")
        
        # Count by entity type
        entity_types = all_notifications.values_list('entity_type', flat=True).distinct()
        for entity_type in entity_types:
            count = all_notifications.filter(entity_type=entity_type).count()
            print(f"  - {entity_type}: {count}")
        
        # Filter notifications that should be visible
        visible_notifications = [
            n for n in all_notifications 
            if should_show_notification(member, n)
        ]
        print(f"\nVisible notifications after filtering: {len(visible_notifications)}")
        
        # Count unread
        unread_visible = [n for n in visible_notifications if not n.is_read]
        print(f"Unread visible notifications: {len(unread_visible)}")
        
        print(f"\n{'='*60}")
        print(f"[OK] Test Complete!")
        print(f"{'='*60}\n")
        
    except Member.DoesNotExist:
        print(f"[ERROR] Member with ID {member_id} not found")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_member_permissions(41)
