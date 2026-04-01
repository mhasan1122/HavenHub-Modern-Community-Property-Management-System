"""
Test Script: Verify New Members Don't Receive Retroactive Notifications

This script tests whether new members receive past notifications when they are created
with announcement, bulletin, and notice view permissions.

Expected Behavior (NON-RETROACTIVE):
- New members should only receive notifications for items created AFTER they joined
- Past announcements, bulletins, and notices should NOT trigger notifications

Test Scenario:
1. Create existing announcements/bulletins/notices (created BEFORE new member)
2. Create a new member with view permissions
3. Verify member does NOT receive notifications for past items
4. Create new announcements/bulletins/notices (created AFTER new member)
5. Verify member DOES receive notifications for new items

Usage:
    python test_new_member_retroactive_notifications.py
"""

import os
import sys
import django
from datetime import datetime, timedelta
from django.utils import timezone

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member, MemberType
from django.contrib.auth.models import User
from announcements.models import Announcement
from bulletins.models import Bulletin
from noticeboard.models import Notice
from notifications.models import Notification
from group_role.models import Role, MembersRole, RolePermission
from group_role.permission_constants import (
    PERMISSION_VIEW_ANNOUNCEMENTS,
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_VIEW_NOTICE_BOARD,
)
from towers.models import Tower, Floor, Unit


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def cleanup_test_data():
    """Clean up test data created during this test"""
    print_section("CLEANUP: Removing Test Data")
    
    # Delete test members
    test_members = Member.objects.filter(full_name__startswith="TEST_MEMBER_")
    print(f"  Deleting {test_members.count()} test members...")
    for member in test_members:
        if member.user:
            member.user.delete()
    test_members.delete()
    
    # Delete test announcements, bulletins, notices
    Announcement.objects.filter(title__startswith="TEST_ANNOUNCEMENT_").delete()
    Bulletin.objects.filter(title__startswith="TEST_BULLETIN_").delete()
    Notice.objects.filter(internal_title__startswith="TEST_NOTICE_").delete()
    
    print("  Cleanup complete!")


def get_or_create_test_role():
    """Get or create a test role with view permissions for announcements, bulletins, and notices"""
    role, created = Role.objects.get_or_create(
        role_name="TestViewerRole",
        defaults={
            'is_active': True
        }
    )
    
    if created:
        print(f"  Created test role: {role.role_name}")
        
        # Add view permissions
        for permission_id in [PERMISSION_VIEW_ANNOUNCEMENTS, PERMISSION_VIEW_BULLETIN_BOARD, PERMISSION_VIEW_NOTICE_BOARD]:
            RolePermission.objects.get_or_create(
                role=role,
                permission_id=permission_id,
                defaults={'is_active': True}
            )
        print(f"  Added view permissions to role")
    else:
        print(f"  Using existing test role: {role.role_name}")
    
    return role


def get_or_create_admin_member():
    """Get or create an admin member for creating test entities"""
    try:
        # Try to find an existing admin/org member
        admin_member = Member.objects.filter(is_org_member=True).first()
        if admin_member:
            print(f"  Using existing admin member: {admin_member.full_name} (ID: {admin_member.id})")
            return admin_member
    except Exception:
        pass
    
    # Create a test admin member
    user = User.objects.create_user(username="test_admin_user", password="password123")
    member_type = MemberType.objects.first()
    
    admin_member = Member.objects.create(
        user=user,
        full_name="TEST_ADMIN_MEMBER",
        general_email="test_admin@example.com",
        member_type=member_type,
        is_org_member=True,
        created_at=timezone.now()
    )
    print(f"  Created test admin member: {admin_member.full_name} (ID: {admin_member.id})")
    return admin_member


def test_retroactive_notifications():
    """
    Main test function to verify non-retroactive notification behavior
    """
    print_section("TEST: New Member Retroactive Notifications")
    print("Testing whether new members receive past notifications...")
    print(f"Test started at: {timezone.now()}")
    
    try:
        # Step 1: Setup - Get admin member and test role
        print_section("STEP 1: Setup")
        admin_member = get_or_create_admin_member()
        test_role = get_or_create_test_role()
        
        # Get a test unit for targeting
        test_unit = Unit.objects.first()
        if not test_unit:
            print("  ⚠️  No units found in database. Creating test unit...")
            tower = Tower.objects.create(tower_name="TEST_TOWER")
            floor = Floor.objects.create(floor_name="Floor 1", tower=tower)
            test_unit = Unit.objects.create(unit_name="TEST_UNIT", floor=floor)
        print(f"  Using test unit: {test_unit.unit_name} (ID: {test_unit.id})")
        
        # Step 2: Create PAST items (before new member exists)
        print_section("STEP 2: Creating Past Items (Before New Member)")
        past_timestamp = timezone.now() - timedelta(days=5)
        
        from datetime import date, time
        today = date.today()
        start_time = time(9, 0)
        end_time = time(17, 0)
        
        # Create past announcement
        past_announcement = Announcement.objects.create(
            title="TEST_ANNOUNCEMENT_PAST",
            description="This announcement was created BEFORE the new member",
            priority="normal",
            start_date=today,
            start_time=start_time,
            end_date=today + timedelta(days=30),
            end_time=end_time,
            status="ongoing",
            creator=admin_member,
            created_at=past_timestamp
        )
        past_announcement.target_units.add(test_unit)
        print(f"  ✓ Created past announcement (ID: {past_announcement.id}) at {past_timestamp}")
        
        # Create past bulletin
        past_bulletin = Bulletin.objects.create(
            title="TEST_BULLETIN_PAST",
            description="This bulletin was created BEFORE the new member",
            status="current",
            creator=admin_member,
            created_at=past_timestamp
        )
        past_bulletin.target_units.add(test_unit)
        print(f"  ✓ Created past bulletin (ID: {past_bulletin.id}) at {past_timestamp}")
        
        # Create past notice
        past_notice = Notice.objects.create(
            internal_title="TEST_NOTICE_PAST",
            priority="normal",
            start_date=today,
            start_time=start_time,
            end_date=today + timedelta(days=30),
            end_time=end_time,
            status="ongoing",
            creator=admin_member,
            created_at=past_timestamp
        )
        past_notice.target_units.add(test_unit)
        print(f"  ✓ Created past notice (ID: {past_notice.id}) at {past_timestamp}")
        
        # Step 3: Create NEW MEMBER with view permissions
        print_section("STEP 3: Creating New Member with View Permissions")
        member_type = MemberType.objects.first()
        if not member_type:
            member_type = MemberType.objects.create(type_name="Test Type")
        
        # Check existing ongoing bulletins/announcements/notices in the system
        existing_bulletins = Bulletin.objects.filter(status='current')
        existing_announcements = Announcement.objects.filter(status='ongoing')
        existing_notices = Notice.objects.filter(status='ongoing')
        print(f"  📊 Existing in database:")
        print(f"     - {existing_bulletins.count()} current bulletins")
        print(f"     - {existing_announcements.count()} ongoing announcements")
        print(f"     - {existing_notices.count()} ongoing notices")
        if existing_bulletins.exists():
            print(f"     - Bulletin IDs: {list(existing_bulletins.values_list('id', flat=True)[:5])}")
            print(f"     - Created: {[b.created_at.strftime('%Y-%m-%d %H:%M') for b in existing_bulletins[:3]]}")
        
        # Generate unique username
        import random
        username = f"test_member_{random.randint(10000, 99999)}"
        user = User.objects.create_user(
            username=username,
            password="password123"
        )
        
        new_member = Member.objects.create(
            user=user,
            full_name="TEST_MEMBER_NEW",
            general_email="test_new_member@example.com",
            member_type=member_type,
            created_at=timezone.now(),
            created_by=admin_member
        )
        print(f"  ✓ Created new member: {new_member.full_name} (ID: {new_member.id})")
        print(f"    Member created at: {new_member.created_at}")
        
        # Assign role with view permissions
        MembersRole.objects.create(
            member=new_member,
            role=test_role,
            is_member=True,
            is_group=False
        )
        print(f"  ✓ Assigned role '{test_role.role_name}' with view permissions")
        
        # Try to associate member with test unit (as resident) - optional
        try:
            from towers.models import Resident
            Resident.objects.create(
                member=new_member,
                unit=test_unit,
                is_active=True,
                notice_period=0  # Add default notice_period
            )
            print(f"  ✓ Associated member with unit {test_unit.unit_name}")
        except Exception as e:
            print(f"  ⚠️  Could not associate with unit: {e}")
            print(f"     (This is OK - member still has permissions via role)")
        
        # Step 4: Manually trigger notification handling (simulating serializer behavior)
        print_section("STEP 4: Triggering Notification Handling")
        from notifications.utils import handle_new_member_notifications
        notification_summary = handle_new_member_notifications(new_member)
        print(f"  Notification summary: {notification_summary}")
        
        # Step 5: Verify NO notifications for PAST items
        print_section("STEP 5: Verifying NO Retroactive Notifications")
        
        past_announcement_notifs = Notification.objects.filter(
            recipient=new_member,
            entity_type='announcement',
            entity_id=past_announcement.id
        )
        past_bulletin_notifs = Notification.objects.filter(
            recipient=new_member,
            entity_type='bulletin',
            entity_id=past_bulletin.id
        )
        past_notice_notifs = Notification.objects.filter(
            recipient=new_member,
            entity_type='notice',
            entity_id=past_notice.id
        )
        
        print(f"  Past announcement notifications: {past_announcement_notifs.count()}")
        print(f"  Past bulletin notifications: {past_bulletin_notifs.count()}")
        print(f"  Past notice notifications: {past_notice_notifs.count()}")
        
        # Check results
        has_past_notifs = (
            past_announcement_notifs.exists() or
            past_bulletin_notifs.exists() or
            past_notice_notifs.exists()
        )
        
        if has_past_notifs:
            print("\n  ❌ FAIL: New member received retroactive notifications!")
            print("     This is incorrect - members should NOT receive past notifications")
        else:
            print("\n  ✅ PASS: No retroactive notifications created!")
            print("     This is correct - members should only see future notifications")
        
        # Step 6: Create NEW items (after new member exists)
        print_section("STEP 6: Creating New Items (After New Member)")
        
        new_announcement = Announcement.objects.create(
            title="TEST_ANNOUNCEMENT_NEW",
            description="This announcement was created AFTER the new member",
            priority="normal",
            start_date=today,
            start_time=start_time,
            end_date=today + timedelta(days=30),
            end_time=end_time,
            status="ongoing",
            creator=admin_member,
            created_at=timezone.now()
        )
        new_announcement.target_units.add(test_unit)
        print(f"  ✓ Created new announcement (ID: {new_announcement.id})")
        
        new_bulletin = Bulletin.objects.create(
            title="TEST_BULLETIN_NEW",
            description="This bulletin was created AFTER the new member",
            status="current",
            creator=admin_member,
            created_at=timezone.now()
        )
        new_bulletin.target_units.add(test_unit)
        print(f"  ✓ Created new bulletin (ID: {new_bulletin.id})")
        
        new_notice = Notice.objects.create(
            internal_title="TEST_NOTICE_NEW",
            priority="normal",
            start_date=today,
            start_time=start_time,
            end_date=today + timedelta(days=30),
            end_time=end_time,
            status="ongoing",
            creator=admin_member,
            created_at=timezone.now()
        )
        new_notice.target_units.add(test_unit)
        print(f"  ✓ Created new notice (ID: {new_notice.id})")
        
        # Manually trigger notifications for new items
        from notifications.utils import (
            create_announcement_notification,
            create_bulletin_posted_notification,
            create_notice_posted_notification
        )
        create_announcement_notification(new_announcement, 'announcement_published')
        create_bulletin_posted_notification(new_bulletin)
        create_notice_posted_notification(new_notice)
        
        # Step 7: Verify notifications for NEW items
        print_section("STEP 7: Verifying Notifications for New Items")
        
        new_announcement_notifs = Notification.objects.filter(
            recipient=new_member,
            entity_type='announcement',
            entity_id=new_announcement.id
        )
        new_bulletin_notifs = Notification.objects.filter(
            recipient=new_member,
            entity_type='bulletin',
            entity_id=new_bulletin.id
        )
        new_notice_notifs = Notification.objects.filter(
            recipient=new_member,
            entity_type='notice',
            entity_id=new_notice.id
        )
        
        print(f"  New announcement notifications: {new_announcement_notifs.count()}")
        print(f"  New bulletin notifications: {new_bulletin_notifs.count()}")
        print(f"  New notice notifications: {new_notice_notifs.count()}")
        
        has_new_notifs = (
            new_announcement_notifs.exists() or
            new_bulletin_notifs.exists() or
            new_notice_notifs.exists()
        )
        
        if has_new_notifs:
            print("\n  ✅ PASS: New member received notifications for new items!")
            print("     This is correct - members should receive notifications for items created after they joined")
        else:
            print("\n  ❌ FAIL: New member did NOT receive notifications for new items!")
            print("     This is incorrect - members should receive notifications for new items")
        
        # Final Summary
        print_section("TEST SUMMARY")
        print(f"Member Creation Time: {new_member.created_at}")
        print(f"Past Items Created At: {past_timestamp}")
        print(f"New Items Created At: ~{timezone.now()}")
        print()
        print("Results:")
        print(f"  • Retroactive notifications (should be 0): {past_announcement_notifs.count() + past_bulletin_notifs.count() + past_notice_notifs.count()}")
        print(f"  • New item notifications (should be > 0): {new_announcement_notifs.count() + new_bulletin_notifs.count() + new_notice_notifs.count()}")
        print()
        
        if not has_past_notifs and has_new_notifs:
            print("✅ OVERALL RESULT: ALL TESTS PASSED!")
            print("   New members do NOT receive retroactive notifications (correct behavior)")
        elif has_past_notifs:
            print("❌ OVERALL RESULT: TEST FAILED!")
            print("   New members ARE receiving retroactive notifications (incorrect behavior)")
        else:
            print("⚠️  OVERALL RESULT: PARTIAL FAILURE!")
            print("   New members are not receiving any notifications")
        
    except Exception as e:
        print(f"\n❌ ERROR during test: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        cleanup_input = input("\nCleanup test data? (y/n): ")
        if cleanup_input.lower() == 'y':
            cleanup_test_data()
        else:
            print("\nTest data preserved for manual inspection.")


if __name__ == "__main__":
    test_retroactive_notifications()
