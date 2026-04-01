"""
Test script to verify retroactive notification filtering with real users.

Test scenario:
1. shanjidahride1997@gmail.com creates announcement, bulletin, and notice
2. testuser@test.com initially has NO permissions
3. Grant permissions to testuser@test.com ONE BY ONE
4. After each permission grant, verify NO retroactive notifications

Expected result: testuser@test.com should NOT see notifications for items created before permission grant
"""

import os
import sys
import django
from datetime import datetime, timedelta

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from user.models import Member
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


def get_member_by_email(email):
    """Get member by email"""
    try:
        user = User.objects.get(email=email)
        return user.member
    except (User.DoesNotExist, Member.DoesNotExist):
        print(f"❌ User with email {email} not found")
        return None


def remove_all_permissions(member):
    """Remove all view permissions from a member"""
    print(f"🧹 Removing all permissions from {member.full_name} ({member.user.email})")
    
    # Get all active member roles
    member_roles = MembersRole.objects.filter(member=member, is_active=True)
    
    for mr in member_roles:
        # Get role permissions for view permissions
        view_permissions = RolePermission.objects.filter(
            role=mr.role,
            permission_id__in=[
                PERMISSION_VIEW_BULLETIN_BOARD,
                PERMISSION_VIEW_ANNOUNCEMENTS,
                PERMISSION_VIEW_NOTICE_BOARD
            ],
            is_active=True
        )
        
        # Deactivate these permissions
        for rp in view_permissions:
            rp.is_active = False
            rp.save()
            print(f"   ✓ Removed permission {rp.permission_id} from role {rp.role.role_name}")


def grant_permission(member, permission_id, permission_name, creator):
    """Grant a specific permission to a member"""
    print(f"\n➕ Granting {permission_name} permission to {member.full_name}")
    
    # Find or create a role for this member
    role_name = f"Test Role for {member.full_name}"
    role, created = Role.objects.get_or_create(
        role_name=role_name,
        defaults={
            'role_description': 'Test role for permission grant testing',
            'is_active': True
        }
    )
    
    if created:
        print(f"   ✓ Created role: {role.role_name}")
    
    # Grant permission to role
    permission, _ = Permission.objects.get_or_create(
        id=permission_id,
        defaults={"permission_name": permission_name}
    )
    
    role_permission, created = RolePermission.objects.get_or_create(
        role=role,
        permission=permission,
        defaults={
            'is_active': True,
            'created_by': creator,
            'created_at': timezone.now()
        }
    )
    
    if not created:
        role_permission.is_active = True
        role_permission.created_at = timezone.now()
        role_permission.save()
    
    print(f"   ✓ Permission granted at: {role_permission.created_at}")
    
    # Assign role to member if not already assigned
    members_role, created = MembersRole.objects.get_or_create(
        member=member,
        role=role,
        defaults={
            'is_active': True,
            'is_member': True,
            'created_by': creator,
            'created_at': timezone.now()
        }
    )
    
    if not created:
        members_role.is_active = True
        members_role.created_at = timezone.now()
        members_role.save()
    
    print(f"   ✓ Role assigned to member at: {members_role.created_at}")
    
    return role_permission.created_at


def check_notifications(member, entity_type, entity_id=None):
    """Check notifications for a member"""
    notifications = Notification.objects.filter(
        recipient=member,
        entity_type=entity_type
    ).order_by('-created_at')
    
    print(f"\n   📊 Notifications for {entity_type}:")
    print(f"      Total in database: {notifications.count()}")
    
    # If entity_id provided, check specifically for that entity
    if entity_id:
        entity_notifications = notifications.filter(entity_id=entity_id)
        print(f"      For new {entity_type} (ID {entity_id}): {entity_notifications.count()}")
        
        if entity_notifications.count() > 0:
            print(f"      ❌ Found notification for new {entity_type}!")
            for notif in entity_notifications:
                print(f"         - ID {notif.id}: {notif.title} (created: {notif.created_at})")
        
        return entity_notifications.count()
    
    if notifications.count() > 0:
        print(f"      List (all notifications):")
        for notif in notifications[:5]:  # Show first 5
            print(f"         - ID {notif.id}: {notif.title} (entity_id: {notif.entity_id}, created: {notif.created_at})")
    
    return notifications.count()


def test_retroactive_notifications():
    """Main test function"""
    print("=" * 80)
    print("TESTING RETROACTIVE NOTIFICATION FILTERING WITH REAL USERS")
    print("=" * 80)
    print()
    
    # Get the creator (shanjidahride1997@gmail.com)
    creator = get_member_by_email("shanjidahride1997@gmail.com")
    if not creator:
        return False
    
    print(f"✓ Creator: {creator.full_name} ({creator.user.email})")
    
    # Get the test user (testuser@test.com - from our test)
    test_user = get_member_by_email("testuser@test.com")
    if not test_user:
        return False
    
    print(f"✓ Test user: {test_user.full_name} ({test_user.user.email})")
    print()
    
    # Remove all permissions from test user
    remove_all_permissions(test_user)
    print()
    
    # Create items with creator
    print("1️⃣  CREATING ITEMS (as shanjidahride1997@gmail.com)")
    print("-" * 80)
    
    creation_time = timezone.now()
    print(f"📅 Creation time: {creation_time}")
    print()
    
    # Create bulletin
    bulletin = Bulletin.objects.create(
        title=f"Test Bulletin - Retroactive Check {creation_time.strftime('%Y%m%d%H%M%S')}",
        description="This bulletin should NOT trigger retroactive notifications",
        creator=creator,
        post_as="creator",
        priority="normal",
        status="current"
    )
    print(f"✓ Created bulletin: {bulletin.title} (ID: {bulletin.id})")
    
    # Create announcement
    future_date = timezone.now() + timedelta(days=30)
    # Use current time to ensure 'ongoing' status
    start_time = timezone.now() - timedelta(hours=1)
    announcement = Announcement.objects.create(
        title=f"Test Announcement - Retroactive Check {creation_time.strftime('%Y%m%d%H%M%S')}",
        description="This announcement should NOT trigger retroactive notifications",
        creator=creator,
        post_as="creator",
        priority="normal",
        start_date=start_time.date(),
        start_time=start_time.time(),
        end_date=future_date.date(),
        end_time=future_date.time(),
    )
    print(f"✓ Created announcement: {announcement.title} (ID: {announcement.id}, status: {announcement.status})")
    
    # Create notice
    notice = Notice.objects.create(
        internal_title=f"Test Notice - Retroactive Check {creation_time.strftime('%Y%m%d%H%M%S')}",
        label="This notice should NOT trigger retroactive notifications",
        creator=creator,
        post_as="creator",
        priority="normal",
        start_date=start_time.date(),
        start_time=start_time.time(),
        end_date=future_date.date(),
        end_time=future_date.time(),
    )
    print(f"✓ Created notice: {notice.internal_title} (ID: {notice.id}, status: {notice.status})")
    print()
    
    # Wait a moment to ensure clear timestamp separation
    import time
    time.sleep(2)
    
    # TEST 1: Grant ANNOUNCEMENT permission
    print("2️⃣  TEST 1: GRANTING ANNOUNCEMENT PERMISSION")
    print("-" * 80)
    
    announcement_permission_time = grant_permission(
        test_user,
        PERMISSION_VIEW_ANNOUNCEMENTS,
        "View Announcements",
        creator
    )
    
    time.sleep(1)  # Wait for any signals to process
    
    # Check notifications for the NEW announcement we just created
    announcement_notif_count = check_notifications(test_user, 'announcement', announcement.id)
    
    # Verify
    if announcement_notif_count == 0:
        print(f"\n   ✅ PASS: No retroactive notifications for announcements")
        print(f"      Announcement created at: {announcement.created_at}")
        print(f"      Permission granted at:   {announcement_permission_time}")
        print(f"      ✓ No notification shown (announcement created BEFORE permission)")
    else:
        print(f"\n   ❌ FAIL: Found {announcement_notif_count} retroactive notifications")
        print(f"      Announcement created at: {announcement.created_at}")
        print(f"      Permission granted at:   {announcement_permission_time}")
        print(f"      ❌ Notification shown (but announcement was created BEFORE permission)")
    
    # TEST 2: Grant BULLETIN permission
    print("\n3️⃣  TEST 2: GRANTING BULLETIN PERMISSION")
    print("-" * 80)
    
    bulletin_permission_time = grant_permission(
        test_user,
        PERMISSION_VIEW_BULLETIN_BOARD,
        "View Bulletin Board",
        creator
    )
    
    time.sleep(1)  # Wait for any signals to process
    
    # Check notifications for the NEW bulletin we just created
    bulletin_notif_count = check_notifications(test_user, 'bulletin', bulletin.id)
    
    # Verify
    if bulletin_notif_count == 0:
        print(f"\n   ✅ PASS: No retroactive notifications for bulletins")
        print(f"      Bulletin created at:  {bulletin.created_at}")
        print(f"      Permission granted at: {bulletin_permission_time}")
        print(f"      ✓ No notification shown (bulletin created BEFORE permission)")
    else:
        print(f"\n   ❌ FAIL: Found {bulletin_notif_count} retroactive notifications")
        print(f"      Bulletin created at:  {bulletin.created_at}")
        print(f"      Permission granted at: {bulletin_permission_time}")
        print(f"      ❌ Notification shown (but bulletin was created BEFORE permission)")
    
    # TEST 3: Grant NOTICE permission
    print("\n4️⃣  TEST 3: GRANTING NOTICE PERMISSION")
    print("-" * 80)
    
    notice_permission_time = grant_permission(
        test_user,
        PERMISSION_VIEW_NOTICE_BOARD,
        "View Notice Board",
        creator
    )
    
    time.sleep(1)  # Wait for any signals to process
    
    # Check notifications for the NEW notice we just created
    notice_notif_count = check_notifications(test_user, 'notice', notice.id)
    
    # Verify
    if notice_notif_count == 0:
        print(f"\n   ✅ PASS: No retroactive notifications for notices")
        print(f"      Notice created at:     {notice.created_at}")
        print(f"      Permission granted at: {notice_permission_time}")
        print(f"      ✓ No notification shown (notice created BEFORE permission)")
    else:
        print(f"\n   ❌ FAIL: Found {notice_notif_count} retroactive notifications")
        print(f"      Notice created at:     {notice.created_at}")
        print(f"      Permission granted at: {notice_permission_time}")
        print(f"      ❌ Notification shown (but notice was created BEFORE permission)")
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    test_passed = (
        announcement_notif_count == 0 and
        bulletin_notif_count == 0 and
        notice_notif_count == 0
    )
    
    if test_passed:
        print("✅ ALL TESTS PASSED!")
        print("   - No retroactive notifications for announcements ✓")
        print("   - No retroactive notifications for bulletins ✓")
        print("   - No retroactive notifications for notices ✓")
        print("\n   👉 User only receives notifications for items created AFTER permission grant")
    else:
        print("❌ SOME TESTS FAILED!")
        if announcement_notif_count > 0:
            print(f"   - Found {announcement_notif_count} retroactive announcement notifications (should be 0)")
        if bulletin_notif_count > 0:
            print(f"   - Found {bulletin_notif_count} retroactive bulletin notifications (should be 0)")
        if notice_notif_count > 0:
            print(f"   - Found {notice_notif_count} retroactive notice notifications (should be 0)")
    
    print("=" * 80)
    print()
    
    # Cleanup instructions
    print("📝 Note: Test items and permissions have been created.")
    print(f"   - Bulletin ID: {bulletin.id}")
    print(f"   - Announcement ID: {announcement.id}")
    print(f"   - Notice ID: {notice.id}")
    print(f"   - Test user: {test_user.full_name} ({test_user.user.email})")
    print()
    
    return test_passed


if __name__ == "__main__":
    try:
        result = test_retroactive_notifications()
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
