"""
Simple test to check what notifications the API returns
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from notifications.models import Notification, NotificationType
from notifications.utils import should_show_notification, has_view_permission

def check_notifications_for_member():
    """Check what notifications exist for a member who has role/group notifications"""
    print("\n" + "="*80)
    print("Checking Notifications API Response")
    print("="*80)
    
    # Find a member who has role or group notifications
    role_notif = Notification.objects.filter(
        notification_type__code='role_assigned'
    ).first()
    
    if not role_notif:
        print("❌ No role_assigned notifications found")
        return
    
    member = role_notif.recipient
    print(f"✓ Found member with role notification: {member.full_name} (ID: {member.id})")
    
    # Get ALL notifications for this member
    all_notifications = Notification.objects.filter(
        recipient=member
    ).select_related('notification_type').order_by('-created_at')
    
    print(f"\n📊 Total notifications for member: {all_notifications.count()}")
    
    # Check view permissions
    print("\n🔐 View Permissions:")
    for entity_type_choice, _ in NotificationType.ENTITY_TYPES:
        has_perm = has_view_permission(member, entity_type_choice)
        print(f"   {entity_type_choice}: {'✓' if has_perm else '✗'}")
    
    # Check which notifications pass the should_show filter
    print("\n📋 Notification Filtering:")
    visible_count = 0
    hidden_count = 0
    
    for notif in all_notifications:
        should_show = should_show_notification(member, notif)
        status = "✓ VISIBLE" if should_show else "✗ HIDDEN"
        
        if should_show:
            visible_count += 1
        else:
            hidden_count += 1
        
        print(f"   {status}: [{notif.entity_type}] {notif.notification_type.code} - {notif.title}")
    
    print(f"\n📈 Summary:")
    print(f"   Total: {all_notifications.count()}")
    print(f"   Visible: {visible_count}")
    print(f"   Hidden: {hidden_count}")
    
    # Show role and group notifications specifically
    print("\n🎭 Role Assignment Notifications:")
    role_notifs = all_notifications.filter(notification_type__code='role_assigned')
    for notif in role_notifs:
        should_show = should_show_notification(member, notif)
        status = "✓" if should_show else "✗"
        print(f"   {status} ID {notif.id}: {notif.title}")
        print(f"      Entity Type: {notif.entity_type}")
        print(f"      Is Read: {notif.is_read}")
        print(f"      Metadata: {notif.metadata}")
    
    print("\n👥 Group Addition Notifications:")
    group_notifs = all_notifications.filter(notification_type__code='group_added')
    for notif in group_notifs:
        should_show = should_show_notification(member, notif)
        status = "✓" if should_show else "✗"
        print(f"   {status} ID {notif.id}: {notif.title}")
        print(f"      Entity Type: {notif.entity_type}")
        print(f"      Is Read: {notif.is_read}")
        print(f"      Metadata: {notif.metadata}")


if __name__ == '__main__':
    check_notifications_for_member()
    
    print("\n" + "="*80)
    print("Next Steps")
    print("="*80)
    print("1. If notifications are visible (✓), check the frontend")
    print("2. If notifications are hidden (✗), check permission timestamps")
    print("3. Check browser network tab for API response")
