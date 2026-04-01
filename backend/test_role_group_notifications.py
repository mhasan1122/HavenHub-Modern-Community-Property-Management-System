"""
Test script to verify role and group notification creation
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from group_role.models import Role, Group, MembersRole, GroupMembers
from notifications.models import Notification, NotificationType
from notifications.utils import create_role_assigned_notification, create_group_added_notification

def test_role_notification():
    """Test role assignment notification creation"""
    print("\n" + "="*80)
    print("Testing Role Assignment Notification")
    print("="*80)
    
    # Get a test member
    member = Member.objects.filter(is_active=True).first()
    if not member:
        print("❌ No active members found")
        return
    
    print(f"✓ Found test member: {member.full_name} (ID: {member.id})")
    
    # Get a test role
    role = Role.objects.filter(is_active=True).first()
    if not role:
        print("❌ No active roles found")
        return
    
    print(f"✓ Found test role: {role.role_name} (ID: {role.id})")
    
    # Check if notification type exists
    notification_type = NotificationType.objects.filter(code='role_assigned').first()
    if notification_type:
        print(f"✓ NotificationType 'role_assigned' exists: {notification_type.name}")
    else:
        print("⚠ NotificationType 'role_assigned' does not exist (will be created)")
    
    # Delete any existing notification for this member/role combination
    existing = Notification.objects.filter(
        recipient=member,
        entity_type='other',
        entity_id=role.id,
        notification_type__code='role_assigned'
    ).count()
    
    if existing > 0:
        print(f"⚠ Found {existing} existing notification(s) for this member/role")
        Notification.objects.filter(
            recipient=member,
            entity_type='other',
            entity_id=role.id,
            notification_type__code='role_assigned'
        ).delete()
        print("✓ Deleted existing notifications")
    
    # Create the notification
    print("\nCreating role assignment notification...")
    recipient_notif, assigner_notif = create_role_assigned_notification(member, role)
    notification = recipient_notif  # For backward compatibility with test
    
    if notification:
        print(f"✅ SUCCESS: Created notification ID {notification.id}")
        print(f"   Title: {notification.title}")
        print(f"   Message: {notification.message}")
        print(f"   Entity Type: {notification.entity_type}")
        print(f"   Entity ID: {notification.entity_id}")
        print(f"   Notification Type: {notification.notification_type.code}")
        print(f"   Metadata: {notification.metadata}")
        
        # Verify it shows up in the member's notifications
        member_notifications = Notification.objects.filter(recipient=member).count()
        print(f"\n✓ Member now has {member_notifications} total notification(s)")
    else:
        print("❌ FAILED: Notification was not created")


def test_group_notification():
    """Test group addition notification creation"""
    print("\n" + "="*80)
    print("Testing Group Addition Notification")
    print("="*80)
    
    # Get a test member
    member = Member.objects.filter(is_active=True).first()
    if not member:
        print("❌ No active members found")
        return
    
    print(f"✓ Found test member: {member.full_name} (ID: {member.id})")
    
    # Get a test group
    group = Group.objects.filter(is_active=True).first()
    if not group:
        print("❌ No active groups found")
        return
    
    print(f"✓ Found test group: {group.group_name} (ID: {group.id})")
    
    # Check if notification type exists
    notification_type = NotificationType.objects.filter(code='group_added').first()
    if notification_type:
        print(f"✓ NotificationType 'group_added' exists: {notification_type.name}")
    else:
        print("⚠ NotificationType 'group_added' does not exist (will be created)")
    
    # Delete any existing notification for this member/group combination
    existing = Notification.objects.filter(
        recipient=member,
        entity_type='other',
        entity_id=group.id,
        notification_type__code='group_added'
    ).count()
    
    if existing > 0:
        print(f"⚠ Found {existing} existing notification(s) for this member/group")
        Notification.objects.filter(
            recipient=member,
            entity_type='other',
            entity_id=group.id,
            notification_type__code='group_added'
        ).delete()
        print("✓ Deleted existing notifications")
    
    # Create the notification
    print("\nCreating group addition notification...")
    recipient_notif, assigner_notif = create_group_added_notification(member, group)
    notification = recipient_notif  # For backward compatibility with test
    
    if notification:
        print(f"✅ SUCCESS: Created notification ID {notification.id}")
        print(f"   Title: {notification.title}")
        print(f"   Message: {notification.message}")
        print(f"   Entity Type: {notification.entity_type}")
        print(f"   Entity ID: {notification.entity_id}")
        print(f"   Notification Type: {notification.notification_type.code}")
        print(f"   Metadata: {notification.metadata}")
        
        # Verify it shows up in the member's notifications
        member_notifications = Notification.objects.filter(recipient=member).count()
        print(f"\n✓ Member now has {member_notifications} total notification(s)")
    else:
        print("❌ FAILED: Notification was not created")


def check_existing_notifications():
    """Check existing role and group notifications"""
    print("\n" + "="*80)
    print("Checking Existing Role and Group Notifications")
    print("="*80)
    
    role_notifications = Notification.objects.filter(
        notification_type__code='role_assigned'
    ).count()
    print(f"Role assignment notifications: {role_notifications}")
    
    group_notifications = Notification.objects.filter(
        notification_type__code='group_added'
    ).count()
    print(f"Group addition notifications: {group_notifications}")
    
    # Show a few examples
    if role_notifications > 0:
        print("\nExample role notifications:")
        for notif in Notification.objects.filter(notification_type__code='role_assigned')[:3]:
            print(f"  - {notif.recipient.full_name}: {notif.title} (read: {notif.is_read})")
    
    if group_notifications > 0:
        print("\nExample group notifications:")
        for notif in Notification.objects.filter(notification_type__code='group_added')[:3]:
            print(f"  - {notif.recipient.full_name}: {notif.title} (read: {notif.is_read})")


if __name__ == '__main__':
    check_existing_notifications()
    test_role_notification()
    test_group_notification()
    
    print("\n" + "="*80)
    print("Test Complete")
    print("="*80)
    print("\nNext steps:")
    print("1. Check the frontend to see if these notifications appear")
    print("2. Check the browser console for any errors")
    print("3. Verify the API endpoint returns these notifications")
