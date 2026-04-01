"""
Test script for Organization Member Notifications with Permission-Based Visibility

This script demonstrates the three types of organization member notifications:
1. New organization member added (requires "View Member List" permission)
2. New role assigned (notification sent to the member who got the role)
3. Added to a new group (notification sent to the member who was added)

Usage:
    python manage.py shell < test_org_member_notifications.py

Or in Django shell:
    >>> exec(open('test_org_member_notifications.py').read())
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from group_role.models import Role, Group, MembersRole, GroupMembers, Permission
from notifications.models import Notification, NotificationType
from group_role.permission_constants import PERMISSION_VIEW_MEMBER_LIST
from django.utils import timezone


def test_org_member_notifications():
    """
    Test the organization member notification system
    """
    print("=" * 80)
    print("TESTING ORGANIZATION MEMBER NOTIFICATIONS")
    print("=" * 80)
    
    # Clean up previous test data
    print("\n1. Cleaning up previous test data...")
    test_members = Member.objects.filter(full_name__startswith='TestOrgMember')
    test_roles = Role.objects.filter(role_name__startswith='TestRole')
    test_groups = Group.objects.filter(group_name__startswith='TestGroup')
    
    print(f"   - Deleting {test_members.count()} test members")
    test_members.delete()
    print(f"   - Deleting {test_roles.count()} test roles")
    test_roles.delete()
    print(f"   - Deleting {test_groups.count()} test groups")
    test_groups.delete()
    
    # Create test members
    print("\n2. Creating test members...")
    
    # Admin member with "View Member List" permission
    admin_member = Member.objects.create(
        full_name='TestOrgMember Admin',
        general_email='admin@test.com',
        general_contact='01711111111',
        is_org_member=True,
        org_member_ever_created=True
    )
    print(f"   ✓ Created admin member: {admin_member.full_name} (ID: {admin_member.id})")
    
    # Member without "View Member List" permission
    regular_member = Member.objects.create(
        full_name='TestOrgMember Regular',
        general_email='regular@test.com',
        general_contact='01722222222',
        is_org_member=True,
        org_member_ever_created=True
    )
    print(f"   ✓ Created regular member: {regular_member.full_name} (ID: {regular_member.id})")
    
    # Create test role with "View Member List" permission
    print("\n3. Creating test role with 'View Member List' permission...")
    admin_role = Role.objects.create(
        role_name='TestRole Admin',
        role_description='Test role with View Member List permission',
        is_active=True
    )
    print(f"   ✓ Created role: {admin_role.role_name} (ID: {admin_role.id})")
    
    # Get "View Member List" permission
    view_member_list_permission = Permission.objects.filter(id=PERMISSION_VIEW_MEMBER_LIST).first()
    if not view_member_list_permission:
        print(f"   ✗ ERROR: 'View Member List' permission (ID: {PERMISSION_VIEW_MEMBER_LIST}) not found!")
        return
    print(f"   ✓ Found permission: {view_member_list_permission.permission_name} (ID: {view_member_list_permission.id})")
    
    # Assign permission to role
    from group_role.models import RolePermission
    role_permission = RolePermission.objects.create(
        role=admin_role,
        permission=view_member_list_permission,
        is_active=True
    )
    print(f"   ✓ Assigned permission to role")
    
    # Assign role to admin member
    print("\n4. Assigning role to admin member...")
    members_role = MembersRole.objects.create(
        member=admin_member,
        role=admin_role,
        is_active=True
    )
    print(f"   ✓ Assigned role '{admin_role.role_name}' to '{admin_member.full_name}'")
    
    # Verify admin has permission
    admin_permissions = admin_member.get_permission_ids()
    has_permission = PERMISSION_VIEW_MEMBER_LIST in admin_permissions
    print(f"   ✓ Admin member has 'View Member List' permission: {has_permission}")
    
    # TEST 1: Create new organization member (should trigger notification to admin only)
    print("\n" + "=" * 80)
    print("TEST 1: NEW ORGANIZATION MEMBER ADDED")
    print("=" * 80)
    
    # Count notifications before
    notifications_before = Notification.objects.filter(
        recipient=admin_member,
        notification_type__code='org_member_added'
    ).count()
    print(f"Admin notifications before: {notifications_before}")
    
    # Create new organization member
    new_org_member = Member.objects.create(
        full_name='TestOrgMember New',
        general_email='newmember@test.com',
        general_contact='01733333333',
        is_org_member=True,
        org_member_ever_created=True
    )
    print(f"✓ Created new org member: {new_org_member.full_name} (ID: {new_org_member.id})")
    
    # Check notifications
    notifications_after = Notification.objects.filter(
        recipient=admin_member,
        notification_type__code='org_member_added'
    ).count()
    print(f"Admin notifications after: {notifications_after}")
    
    # Verify notification was created
    admin_notification = Notification.objects.filter(
        recipient=admin_member,
        notification_type__code='org_member_added',
        entity_id=new_org_member.id
    ).first()
    
    if admin_notification:
        print(f"✅ SUCCESS: Admin received notification!")
        print(f"   - Title: {admin_notification.title}")
        print(f"   - Message: {admin_notification.message}")
        print(f"   - Entity: {admin_notification.entity_type}:{admin_notification.entity_id}")
    else:
        print(f"❌ FAILED: Admin did not receive notification")
    
    # Verify regular member did NOT receive notification
    regular_notification = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='org_member_added',
        entity_id=new_org_member.id
    ).first()
    
    if not regular_notification:
        print(f"✅ SUCCESS: Regular member (without permission) did NOT receive notification")
    else:
        print(f"❌ FAILED: Regular member received notification (should not have)")
    
    # TEST 2: New role assigned
    print("\n" + "=" * 80)
    print("TEST 2: NEW ROLE ASSIGNED")
    print("=" * 80)
    
    # Create a new role
    member_role = Role.objects.create(
        role_name='TestRole Member',
        role_description='Test member role',
        is_active=True
    )
    print(f"✓ Created role: {member_role.role_name} (ID: {member_role.id})")
    
    # Count notifications before
    role_notifications_before = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='role_assigned'
    ).count()
    print(f"Regular member role notifications before: {role_notifications_before}")
    
    # Assign role to regular member (should trigger notification)
    regular_members_role = MembersRole.objects.create(
        member=regular_member,
        role=member_role,
        is_active=True
    )
    print(f"✓ Assigned role '{member_role.role_name}' to '{regular_member.full_name}'")
    
    # Check notifications
    role_notifications_after = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='role_assigned'
    ).count()
    print(f"Regular member role notifications after: {role_notifications_after}")
    
    # Verify notification was created
    role_notification = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='role_assigned',
        entity_id=member_role.id
    ).first()
    
    if role_notification:
        print(f"✅ SUCCESS: Member received role assignment notification!")
        print(f"   - Title: {role_notification.title}")
        print(f"   - Message: {role_notification.message}")
    else:
        print(f"❌ FAILED: Member did not receive role assignment notification")
    
    # TEST 3: Added to a new group
    print("\n" + "=" * 80)
    print("TEST 3: ADDED TO A NEW GROUP")
    print("=" * 80)
    
    # Create a test group
    test_group = Group.objects.create(
        group_name='TestGroup Engineering',
        group_description='Test engineering group',
        is_active=True
    )
    print(f"✓ Created group: {test_group.group_name} (ID: {test_group.id})")
    
    # Count notifications before
    group_notifications_before = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='group_added'
    ).count()
    print(f"Regular member group notifications before: {group_notifications_before}")
    
    # Add member to group (should trigger notification)
    group_member = GroupMembers.objects.create(
        member=regular_member,
        group=test_group
    )
    print(f"✓ Added '{regular_member.full_name}' to group '{test_group.group_name}'")
    
    # Check notifications
    group_notifications_after = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='group_added'
    ).count()
    print(f"Regular member group notifications after: {group_notifications_after}")
    
    # Verify notification was created
    group_notification = Notification.objects.filter(
        recipient=regular_member,
        notification_type__code='group_added',
        entity_id=test_group.id
    ).first()
    
    if group_notification:
        print(f"✅ SUCCESS: Member received group addition notification!")
        print(f"   - Title: {group_notification.title}")
        print(f"   - Message: {group_notification.message}")
    else:
        print(f"❌ FAILED: Member did not receive group addition notification")
    
    # TEST 4: Verify retroactive filtering
    print("\n" + "=" * 80)
    print("TEST 4: RETROACTIVE FILTERING")
    print("=" * 80)
    
    # Create a member without permission first
    member_no_permission = Member.objects.create(
        full_name='TestOrgMember NoPermission',
        general_email='noperm@test.com',
        general_contact='01744444444',
        is_org_member=True,
        org_member_ever_created=True
    )
    print(f"✓ Created member without permission: {member_no_permission.full_name} (ID: {member_no_permission.id})")
    
    # Create another new org member (member_no_permission should NOT get notification)
    another_member = Member.objects.create(
        full_name='TestOrgMember Another',
        general_email='another@test.com',
        general_contact='01755555555',
        is_org_member=True,
        org_member_ever_created=True
    )
    print(f"✓ Created another org member: {another_member.full_name} (ID: {another_member.id})")
    
    # Verify member_no_permission did NOT get notification
    no_perm_notification = Notification.objects.filter(
        recipient=member_no_permission,
        notification_type__code='org_member_added',
        entity_id=another_member.id
    ).first()
    
    if not no_perm_notification:
        print(f"✅ SUCCESS: Member without permission did NOT receive notification")
    else:
        print(f"❌ FAILED: Member without permission received notification")
    
    # Now grant permission to member_no_permission
    print(f"\n✓ Granting 'View Member List' permission to {member_no_permission.full_name}...")
    members_role_new = MembersRole.objects.create(
        member=member_no_permission,
        role=admin_role,
        is_active=True
    )
    
    # Create one more member AFTER permission grant
    final_member = Member.objects.create(
        full_name='TestOrgMember Final',
        general_email='final@test.com',
        general_contact='01766666666',
        is_org_member=True,
        org_member_ever_created=True
    )
    print(f"✓ Created final org member: {final_member.full_name} (ID: {final_member.id})")
    
    # Check if member_no_permission received notification for final_member
    final_notification = Notification.objects.filter(
        recipient=member_no_permission,
        notification_type__code='org_member_added',
        entity_id=final_member.id
    ).first()
    
    if final_notification:
        print(f"✅ SUCCESS: Member received notification AFTER permission grant!")
        print(f"   - Message: {final_notification.message}")
    else:
        print(f"❌ FAILED: Member did not receive notification after permission grant")
    
    # Verify member_no_permission still does NOT see notification for another_member
    retroactive_notification = Notification.objects.filter(
        recipient=member_no_permission,
        notification_type__code='org_member_added',
        entity_id=another_member.id
    ).first()
    
    if not retroactive_notification:
        print(f"✅ SUCCESS: No retroactive notification for member created BEFORE permission grant")
    else:
        print(f"⚠️  WARNING: Retroactive notification exists (will be filtered in should_show_notification)")
    
    # SUMMARY
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    # Count all notification types
    org_member_notifications = Notification.objects.filter(notification_type__code='org_member_added').count()
    role_notifications = Notification.objects.filter(notification_type__code='role_assigned').count()
    group_notifications = Notification.objects.filter(notification_type__code='group_added').count()
    
    print(f"✓ Organization Member Added Notifications: {org_member_notifications}")
    print(f"✓ Role Assigned Notifications: {role_notifications}")
    print(f"✓ Group Added Notifications: {group_notifications}")
    print(f"\nTotal Notifications Created: {org_member_notifications + role_notifications + group_notifications}")
    
    # List all notification types created
    print("\nNotification Types:")
    for notification_type in NotificationType.objects.filter(code__in=['org_member_added', 'role_assigned', 'group_added']):
        print(f"  - {notification_type.name} ({notification_type.code}): {notification_type.entity_type}")
    
    print("\n" + "=" * 80)
    print("TESTS COMPLETED")
    print("=" * 80)


if __name__ == '__main__':
    test_org_member_notifications()
