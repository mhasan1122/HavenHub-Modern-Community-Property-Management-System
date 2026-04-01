"""
Comprehensive test for role and group notifications
Tests the complete flow from creation to API response
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from group_role.models import Role, Group, MembersRole, GroupMembers
from notifications.models import Notification, NotificationType
from notifications.serializers import NotificationListSerializer
from notifications.utils import should_show_notification, has_view_permission
from django.utils import timezone

def test_role_notification_flow():
    """Test complete flow for role assignment notification"""
    print("\n" + "="*80)
    print("Testing Role Assignment Notification Flow")
    print("="*80)
    
    # Find or create a test member
    member = Member.objects.filter(full_name__icontains='test').first()
    if not member:
        print("❌ No test member found")
        return False
    
    print(f"✓ Using member: {member.full_name} (ID: {member.id})")
    
    # Find a role
    role = Role.objects.filter(is_active=True).first()
    if not role:
        print("❌ No active roles found")
        return False
    
    print(f"✓ Using role: {role.role_name} (ID: {role.id})")
    
    # Delete existing notification for clean test
    Notification.objects.filter(
        recipient=member,
        entity_type='other',
        entity_id=role.id,
        notification_type__code='role_assigned'
    ).delete()
    
    # Create role assignment (this should trigger the signal)
    print("\n📤 Creating MembersRole assignment...")
    members_role, created = MembersRole.objects.get_or_create(
        member=member,
        role=role,
        defaults={'is_active': True}
    )
    
    if not created:
        # Update to trigger the signal
        members_role.updated_at = timezone.now()
        members_role.save()
        print("⚠ MembersRole already existed, updated it")
    else:
        print("✓ MembersRole created")
    
    # Check if notification was created
    print("\n🔍 Checking for notification...")
    notification = Notification.objects.filter(
        recipient=member,
        entity_type='other',
        notification_type__code='role_assigned'
    ).first()
    
    if not notification:
        print("❌ FAILED: No notification created!")
        return False
    
    print(f"✅ SUCCESS: Notification created (ID: {notification.id})")
    print(f"   Title: {notification.title}")
    print(f"   Message: {notification.message}")
    print(f"   Metadata: {json.dumps(notification.metadata, indent=2)}")
    
    # Check if notification passes filters
    print("\n🔐 Checking filters...")
    has_perm = has_view_permission(member, 'other')
    print(f"   View permission: {'✓' if has_perm else '✗'}")
    
    should_show = should_show_notification(member, notification)
    print(f"   Should show: {'✓' if should_show else '✗'}")
    
    if not should_show:
        print("❌ FAILED: Notification would be hidden!")
        return False
    
    # Serialize as API would
    print("\n📡 API Response Preview:")
    serializer = NotificationListSerializer(notification)
    print(json.dumps(serializer.data, indent=2, default=str))
    
    return True


def test_group_notification_flow():
    """Test complete flow for group addition notification"""
    print("\n" + "="*80)
    print("Testing Group Addition Notification Flow")
    print("="*80)
    
    # Find or create a test member
    member = Member.objects.filter(full_name__icontains='test').first()
    if not member:
        print("❌ No test member found")
        return False
    
    print(f"✓ Using member: {member.full_name} (ID: {member.id})")
    
    # Find a group
    group = Group.objects.filter(is_active=True).first()
    if not group:
        print("❌ No active groups found")
        return False
    
    print(f"✓ Using group: {group.group_name} (ID: {group.id})")
    
    # Delete existing notification for clean test
    Notification.objects.filter(
        recipient=member,
        entity_type='other',
        entity_id=group.id,
        notification_type__code='group_added'
    ).delete()
    
    # Create group membership (this should trigger the signal)
    print("\n📤 Creating GroupMembers assignment...")
    group_member, created = GroupMembers.objects.get_or_create(
        member=member,
        group=group
    )
    
    if not created:
        print("⚠ GroupMember already existed")
    else:
        print("✓ GroupMember created")
    
    # Check if notification was created
    print("\n🔍 Checking for notification...")
    notification = Notification.objects.filter(
        recipient=member,
        entity_type='other',
        notification_type__code='group_added'
    ).first()
    
    if not notification:
        print("❌ FAILED: No notification created!")
        return False
    
    print(f"✅ SUCCESS: Notification created (ID: {notification.id})")
    print(f"   Title: {notification.title}")
    print(f"   Message: {notification.message}")
    print(f"   Metadata: {json.dumps(notification.metadata, indent=2)}")
    
    # Check if notification passes filters
    print("\n🔐 Checking filters...")
    has_perm = has_view_permission(member, 'other')
    print(f"   View permission: {'✓' if has_perm else '✗'}")
    
    should_show = should_show_notification(member, notification)
    print(f"   Should show: {'✓' if should_show else '✗'}")
    
    if not should_show:
        print("❌ FAILED: Notification would be hidden!")
        return False
    
    # Serialize as API would
    print("\n📡 API Response Preview:")
    serializer = NotificationListSerializer(notification)
    print(json.dumps(serializer.data, indent=2, default=str))
    
    return True


def verify_notification_types():
    """Verify that notification types are configured correctly"""
    print("\n" + "="*80)
    print("Verifying Notification Types")
    print("="*80)
    
    role_type = NotificationType.objects.filter(code='role_assigned').first()
    if role_type:
        print(f"✅ Role Assigned Type:")
        print(f"   Name: {role_type.name}")
        print(f"   Icon: {role_type.icon}")
        print(f"   Entity Type: {role_type.entity_type}")
        print(f"   Active: {role_type.is_active}")
    else:
        print("⚠ Role Assigned type not found (will be created on first use)")
    
    print()
    
    group_type = NotificationType.objects.filter(code='group_added').first()
    if group_type:
        print(f"✅ Group Added Type:")
        print(f"   Name: {group_type.name}")
        print(f"   Icon: {group_type.icon}")
        print(f"   Entity Type: {group_type.entity_type}")
        print(f"   Active: {group_type.is_active}")
    else:
        print("⚠ Group Added type not found (will be created on first use)")


if __name__ == '__main__':
    verify_notification_types()
    
    role_success = test_role_notification_flow()
    group_success = test_group_notification_flow()
    
    print("\n" + "="*80)
    print("Test Summary")
    print("="*80)
    print(f"Role Notification: {'✅ PASS' if role_success else '❌ FAIL'}")
    print(f"Group Notification: {'✅ PASS' if group_success else '❌ FAIL'}")
    
    if role_success and group_success:
        print("\n🎉 All tests passed!")
        print("\n📋 Frontend Checklist:")
        print("   1. Open the app and check the notification bell")
        print("   2. Verify role assignment notification appears")
        print("   3. Click it - should navigate to /profile with Organization Member tab")
        print("   4. Verify group addition notification appears")
        print("   5. Click it - should navigate to /group-list with group highlighted")
    else:
        print("\n⚠ Some tests failed - check the output above")
