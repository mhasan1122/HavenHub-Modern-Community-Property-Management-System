"""
Test script to verify permission grant notification functionality.

This test verifies that users who get permissions granted receive notifications
only for items (bulletins/announcements/notices) created AFTER permission grant,
not for items created before.

Run with: python manage.py test test_permission_grant_notifications
Or: python manage.py shell < test_permission_grant_notifications.py
"""

import os
import sys
import django
from datetime import datetime, timedelta

# Setup Django FIRST - before importing any Django models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Now import Django modules and models
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth.models import User
from user.models import Member, MemberType
from bulletins.models import Bulletin
from announcements.models import Announcement
from noticeboard.models import Notice
from notifications.models import Notification
from group_role.models import Role, Permission, RolePermission, MembersRole
from group_role.permission_constants import (
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_VIEW_ANNOUNCEMENTS,
    PERMISSION_VIEW_NOTICE_BOARD,
)


def create_test_member(name):
    """Create a test member"""
    user = User.objects.create_user(
        username=f"{name}_user",
        password="testpass123",
        email=f"{name}@test.com"
    )
    member_type, _ = MemberType.objects.get_or_create(type_name="Test Member")
    # Use a shorter contact number that fits within 11 character limit
    # Format: 017 + 8 digits (total 11 characters)
    contact_suffix = str(hash(name) % 100000000)[:8].zfill(8)  # 8-digit number
    
    # Use raw SQL to insert member with terms_accepted field (exists in DB but not in model)
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO user_member 
               (user_id, member_type_id, full_name, general_contact, general_email, 
                is_org_member, is_comm_member, org_member_ever_created, 
                comm_member_ever_created, is_first_login, terms_accepted)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            [
                user.id,
                member_type.id,
                f"{name} Test User",
                f"017{contact_suffix}",
                f"{name}@test.com",
                1,  # is_org_member
                0,  # is_comm_member
                0,  # org_member_ever_created
                0,  # comm_member_ever_created
                1,  # is_first_login
                1,  # terms_accepted
            ]
        )
        member_id = cursor.lastrowid
    
    # Get the member object
    member = Member.objects.get(id=member_id)
    return user, member


def create_test_role(name):
    """Create a test role"""
    role = Role.objects.create(
        role_name=f"Test Role {name}",
        role_description="Test role for permission grant testing",
        is_active=True
    )
    return role


def grant_permission_to_role(role, permission_id, member_creator):
    """Grant a permission to a role"""
    permission, _ = Permission.objects.get_or_create(
        id=permission_id,
        defaults={"permission_name": f"Permission {permission_id}"}
    )
    role_permission = RolePermission.objects.create(
        role=role,
        permission=permission,
        is_active=True,
        created_by=member_creator,
        created_at=timezone.now()
    )
    return role_permission


def assign_role_to_member(member, role, member_creator):
    """Assign a role to a member"""
    members_role = MembersRole.objects.create(
        member=member,
        role=role,
        is_active=True,
        is_member=True,
        created_by=member_creator,
        created_at=timezone.now()
    )
    return members_role


def cleanup_test_data():
    """Clean up any existing test data from previous runs"""
    print("🧹 Cleaning up existing test data...")
    
    # Delete in correct order to respect foreign key constraints
    
    # 1. Delete test bulletins, announcements, notices (and their notifications)
    Bulletin.objects.filter(title__contains="Created Before Permission").delete()
    Bulletin.objects.filter(title__contains="Created After Permission").delete()
    Announcement.objects.filter(title__contains="Created Before Permission").delete()
    Announcement.objects.filter(title__contains="Created After Permission").delete()
    Notice.objects.filter(internal_title__contains="Created Before Permission").delete()
    Notice.objects.filter(internal_title__contains="Created After Permission").delete()
    
    # 2. Delete MembersRole entries for test members
    test_usernames = ["admin_user", "testuser_user"]
    for username in test_usernames:
        try:
            user = User.objects.get(username=username)
            try:
                member = user.member
                # Delete MembersRole entries
                MembersRole.objects.filter(member=member).delete()
                # Delete notifications
                Notification.objects.filter(recipient=member).delete()
            except Member.DoesNotExist:
                pass
        except User.DoesNotExist:
            pass
    
    # 3. Delete RolePermissions for test roles
    test_roles = Role.objects.filter(role_name__startswith="Test Role")
    for role in test_roles:
        RolePermission.objects.filter(role=role).delete()
    
    # 4. Delete test roles
    test_roles.delete()
    
    # 5. Delete test users and members
    for username in test_usernames:
        try:
            user = User.objects.get(username=username)
            try:
                member = user.member
                member.delete()
            except Member.DoesNotExist:
                pass
            user.delete()
        except User.DoesNotExist:
            pass
    
    print("✓ Cleanup complete")
    print()


def test_permission_grant_notifications():
    """Main test function"""
    print("=" * 80)
    print("TESTING PERMISSION GRANT NOTIFICATIONS")
    print("=" * 80)
    print()
    
    # Clean up any existing test data
    cleanup_test_data()
    
    # Create admin member (for creating roles/permissions)
    admin_user, admin_member = create_test_member("admin")
    print(f"✓ Created admin member: {admin_member.full_name}")
    
    # Create test user (will receive permission)
    test_user, test_member = create_test_member("testuser")
    print(f"✓ Created test user: {test_member.full_name}")
    print()
    
    # Set initial time - Jan 1
    initial_time = timezone.now() - timedelta(days=10)
    print(f"📅 Initial time: {initial_time}")
    print()
    
    # Create items BEFORE permission grant
    print("1️⃣  CREATING ITEMS BEFORE PERMISSION GRANT")
    print("-" * 80)
    
    # Create bulletin before permission
    bulletin_before = Bulletin.objects.create(
        title="Bulletin Created Before Permission",
        description="This bulletin was created before user got permission",
        creator=admin_member,
        post_as="creator",
        priority="normal",
        status="current"
    )
    bulletin_before.created_at = initial_time
    bulletin_before.save(update_fields=['created_at'])
    print(f"✓ Created bulletin BEFORE permission: {bulletin_before.title} (created: {bulletin_before.created_at})")
    
    # Create announcement before permission
    future_date = timezone.now() + timedelta(days=30)
    announcement_before = Announcement.objects.create(
        title="Announcement Created Before Permission",
        description="This announcement was created before user got permission",
        creator=admin_member,
        post_as="creator",
        priority="normal",
        start_date=initial_time.date(),
        start_time=initial_time.time(),
        end_date=future_date.date(),
        end_time=future_date.time(),
        status="ongoing"
    )
    announcement_before.created_at = initial_time
    announcement_before.save(update_fields=['created_at'])
    print(f"✓ Created announcement BEFORE permission: {announcement_before.title} (created: {announcement_before.created_at})")
    
    # Create notice before permission
    notice_before = Notice.objects.create(
        internal_title="Notice Created Before Permission",
        label="This notice was created before user got permission",
        creator=admin_member,
        post_as="creator",
        priority="normal",
        start_date=initial_time.date(),
        start_time=initial_time.time(),
        end_date=future_date.date(),
        end_time=future_date.time(),
        status="ongoing"
    )
    notice_before.created_at = initial_time
    notice_before.save(update_fields=['created_at'])
    print(f"✓ Created notice BEFORE permission: {notice_before.internal_title} (created: {notice_before.created_at})")
    print()
    
    # Grant permission - Jan 10 (9 days later)
    permission_grant_time = initial_time + timedelta(days=9)
    print("2️⃣  GRANTING PERMISSIONS")
    print("-" * 80)
    print(f"📅 Permission grant time: {permission_grant_time}")
    print()
    
    # Create role
    test_role = create_test_role("ViewPermission")
    print(f"✓ Created role: {test_role.role_name}")
    
    # Grant permissions to role
    rp1 = grant_permission_to_role(test_role, PERMISSION_VIEW_BULLETIN_BOARD, admin_member)
    rp2 = grant_permission_to_role(test_role, PERMISSION_VIEW_ANNOUNCEMENTS, admin_member)
    rp3 = grant_permission_to_role(test_role, PERMISSION_VIEW_NOTICE_BOARD, admin_member)
    # Set timestamps to permission grant time
    rp1.created_at = permission_grant_time
    rp1.save(update_fields=['created_at'])
    rp2.created_at = permission_grant_time
    rp2.save(update_fields=['created_at'])
    rp3.created_at = permission_grant_time
    rp3.save(update_fields=['created_at'])
    print(f"✓ Granted view permissions to role")
    
    # Assign role to member
    mr = assign_role_to_member(test_member, test_role, admin_member)
    mr.created_at = permission_grant_time
    mr.save(update_fields=['created_at'])
    print(f"✓ Assigned role to test member")
    print()
    
    # Wait a moment for signals to process
    import time
    time.sleep(1)
    
    # Also manually trigger the notification creation functions to ensure they work
    print("🔧 Manually triggering notification creation functions...")
    from notifications.utils import (
        create_notifications_for_new_bulletin_permission,
        create_notifications_for_new_announcement_permission,
        create_notifications_for_new_notice_permission,
    )
    
    # Get the actual permission grant timestamp
    permission_grant_timestamp = test_member.get_permission_grant_timestamp(PERMISSION_VIEW_BULLETIN_BOARD)
    if permission_grant_timestamp:
        print(f"   Permission grant timestamp: {permission_grant_timestamp}")
        create_notifications_for_new_bulletin_permission(test_member, permission_grant_timestamp)
        create_notifications_for_new_announcement_permission(test_member, permission_grant_timestamp)
        create_notifications_for_new_notice_permission(test_member, permission_grant_timestamp)
        print("   ✓ Manually triggered notification functions")
    
    time.sleep(0.5)
    
    # Check notifications after permission grant
    print("3️⃣  CHECKING NOTIFICATIONS AFTER PERMISSION GRANT")
    print("-" * 80)
    
    notifications_after_grant = Notification.objects.filter(recipient=test_member)
    print(f"📊 Total notifications for test user: {notifications_after_grant.count()}")
    
    bulletin_notifications = notifications_after_grant.filter(entity_type='bulletin')
    announcement_notifications = notifications_after_grant.filter(entity_type='announcement')
    notice_notifications = notifications_after_grant.filter(entity_type='notice')
    
    print(f"   - Bulletin notifications: {bulletin_notifications.count()}")
    print(f"   - Announcement notifications: {announcement_notifications.count()}")
    print(f"   - Notice notifications: {notice_notifications.count()}")
    print()
    
    # Verify NO notifications for items created before permission
    print("4️⃣  VERIFYING NO RETROACTIVE NOTIFICATIONS")
    print("-" * 80)
    
    bulletin_before_notification = Notification.objects.filter(
        recipient=test_member,
        entity_type='bulletin',
        entity_id=bulletin_before.id
    ).exists()
    
    announcement_before_notification = Notification.objects.filter(
        recipient=test_member,
        entity_type='announcement',
        entity_id=announcement_before.id
    ).exists()
    
    notice_before_notification = Notification.objects.filter(
        recipient=test_member,
        entity_type='notice',
        entity_id=notice_before.id
    ).exists()
    
    print(f"   - Notification for bulletin BEFORE permission: {'❌ EXISTS (BAD!)' if bulletin_before_notification else '✓ NOT EXISTS (GOOD!)'}")
    print(f"   - Notification for announcement BEFORE permission: {'❌ EXISTS (BAD!)' if announcement_before_notification else '✓ NOT EXISTS (GOOD!)'}")
    print(f"   - Notification for notice BEFORE permission: {'❌ EXISTS (BAD!)' if notice_before_notification else '✓ NOT EXISTS (GOOD!)'}")
    print()
    
    # Create items AFTER permission grant
    items_after_time = permission_grant_time + timedelta(days=2)  # Jan 12
    print("5️⃣  CREATING ITEMS AFTER PERMISSION GRANT")
    print("-" * 80)
    print(f"📅 Items creation time: {items_after_time}")
    print()
    
    # Create bulletin after permission
    bulletin_after = Bulletin.objects.create(
        title="Bulletin Created After Permission",
        description="This bulletin was created after user got permission",
        creator=admin_member,
        post_as="creator",
        priority="normal",
        status="current"
    )
    bulletin_after.created_at = items_after_time
    bulletin_after.save(update_fields=['created_at'])
    print(f"✓ Created bulletin AFTER permission: {bulletin_after.title} (created: {bulletin_after.created_at})")
    
    # Manually trigger notification creation for the bulletin (since we're not using the API)
    from notifications.utils import create_bulletin_posted_notification
    create_bulletin_posted_notification(bulletin_after)
    
    # For announcements and notices, we need to use dates that make them 'ongoing' status
    # Use a time range that spans across now to ensure 'ongoing' status
    notice_start_time = timezone.now() - timedelta(hours=1)  # Started 1 hour ago
    notice_end_time = timezone.now() + timedelta(days=30)  # Ends in 30 days
    
    # Create announcement after permission
    announcement_after = Announcement.objects.create(
        title="Announcement Created After Permission",
        description="This announcement was created after user got permission",
        creator=admin_member,
        post_as="creator",
        priority="normal",
        start_date=notice_start_time.date(),
        start_time=notice_start_time.time(),
        end_date=notice_end_time.date(),
        end_time=notice_end_time.time(),
    )
    # Announcement model auto-updates status on save, so it should be 'ongoing'
    announcement_after.created_at = items_after_time
    announcement_after.save(update_fields=['created_at'])
    print(f"✓ Created announcement AFTER permission: {announcement_after.title} (created: {announcement_after.created_at}, status: {announcement_after.status})")
    
    # Manually trigger notification creation for the announcement
    from notifications.utils import create_announcement_notification
    create_announcement_notification(announcement_after, 'announcement_posted')
    
    # Create notice after permission
    notice_after = Notice.objects.create(
        internal_title="Notice Created After Permission",
        label="This notice was created after user got permission",
        creator=admin_member,
        post_as="creator",
        priority="normal",
        start_date=notice_start_time.date(),
        start_time=notice_start_time.time(),
        end_date=notice_end_time.date(),
        end_time=notice_end_time.time(),
    )
    # Notice model auto-updates status on save, so it should be 'ongoing'
    notice_after.created_at = items_after_time
    notice_after.save(update_fields=['created_at'])
    print(f"✓ Created notice AFTER permission: {notice_after.internal_title} (created: {notice_after.created_at}, status: {notice_after.status})")
    
    # Manually trigger notification creation for the notice
    from notifications.utils import create_notice_posted_notification
    create_notice_posted_notification(notice_after)
    print()
    
    # Wait a moment for notifications to be created
    time.sleep(0.5)
    
    # Check final notifications
    print("6️⃣  FINAL NOTIFICATION CHECK")
    print("-" * 80)
    
    final_notifications = Notification.objects.filter(recipient=test_member)
    print(f"📊 Total notifications for test user: {final_notifications.count()}")
    
    # Verify notifications exist for items created after permission
    bulletin_after_notification = Notification.objects.filter(
        recipient=test_member,
        entity_type='bulletin',
        entity_id=bulletin_after.id
    ).exists()
    
    announcement_after_notification = Notification.objects.filter(
        recipient=test_member,
        entity_type='announcement',
        entity_id=announcement_after.id
    ).exists()
    
    notice_after_notification = Notification.objects.filter(
        recipient=test_member,
        entity_type='notice',
        entity_id=notice_after.id
    ).exists()
    
    print(f"   - Notification for bulletin AFTER permission: {'✓ EXISTS (GOOD!)' if bulletin_after_notification else '❌ NOT EXISTS (BAD!)'}")
    print(f"   - Notification for announcement AFTER permission: {'✓ EXISTS (GOOD!)' if announcement_after_notification else '❌ NOT EXISTS (BAD!)'}")
    print(f"   - Notification for notice AFTER permission: {'✓ EXISTS (GOOD!)' if notice_after_notification else '❌ NOT EXISTS (BAD!)'}")
    print()
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    test_passed = (
        not bulletin_before_notification and
        not announcement_before_notification and
        not notice_before_notification and
        bulletin_after_notification and
        announcement_after_notification and
        notice_after_notification
    )
    
    if test_passed:
        print("✅ TEST PASSED!")
        print("   - No notifications for items created BEFORE permission ✓")
        print("   - Notifications exist for items created AFTER permission ✓")
    else:
        print("❌ TEST FAILED!")
        if bulletin_before_notification or announcement_before_notification or notice_before_notification:
            print("   - Found notifications for items created BEFORE permission (should not exist)")
        if not bulletin_after_notification or not announcement_after_notification or not notice_after_notification:
            print("   - Missing notifications for items created AFTER permission (should exist)")
    
    print("=" * 80)
    print()
    
    # Note: Test data is kept for inspection
    # To clean up manually, delete the created objects:
    # - Notifications for test_member
    # - bulletin_before, bulletin_after
    # - announcement_before, announcement_after
    # - notice_before, notice_after
    # - test_role
    # - test_user, test_member
    # - admin_user, admin_member
    
    return test_passed


if __name__ == "__main__":
    try:
        result = test_permission_grant_notifications()
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

