#!/usr/bin/env python
"""
Test script to reproduce and verify the bulletin approval notification issue:
- User does not receive "Bulletin Posted" notification for previously pending bulletins
  after being granted permission when those bulletins are approved.

Expected behavior:
- User A should receive notifications for bulletins approved AFTER they receive permission,
  regardless of when the bulletin was created.
- Notification logic should be based on approval time, not creation time.

Test Scenario:
1. Create multiple pending bulletins (before User A has permission)
2. Onboard User A without bulletin permission
3. Grant Bulletin permission to User A
4. Admin approves one of the pending bulletins
5. Verify User A receives the "Bulletin Posted" notification
"""

import os
import sys
import django
from datetime import datetime, timedelta
from django.utils import timezone

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import transaction
from django.contrib.auth.models import User
from user.models import Member
from bulletins.models import Bulletin
from notifications.models import Notification
from group_role.models import Group, Role, GroupMembers, MembersRole, Permission, RolePermission
from group_role.permission_constants import (
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_APPROVE_REJECT_BULLETIN_BOARD,
)
from notifications.utils import create_bulletin_posted_notification
import time


class BulletinApprovalNotificationTest:
    def __init__(self):
        self.test_data = {}
        
    def cleanup(self):
        """Clean up test data"""
        print("\n" + "="*80)
        print("CLEANING UP TEST DATA")
        print("="*80)
        
        # Delete test bulletins
        if 'bulletin_ids' in self.test_data:
            deleted = Bulletin.objects.filter(id__in=self.test_data['bulletin_ids']).delete()
            print(f"✓ Deleted test bulletins: {deleted}")
        
        # Delete test notifications
        if 'user_a' in self.test_data:
            deleted = Notification.objects.filter(recipient=self.test_data['user_a']).delete()
            print(f"✓ Deleted User A's notifications: {deleted}")
        
        # Delete test users and members
        # Delete related records first to avoid protected foreign key errors
        if 'user_a' in self.test_data:
            member = self.test_data['user_a']
            # Delete group memberships
            GroupMembers.objects.filter(member=member).delete()
            # Delete role memberships
            MembersRole.objects.filter(member=member).delete()
            # Delete user and member
            if member.user:
                member.user.delete()
            member.delete()
            print(f"✓ Deleted User A")
        
        if 'admin_user' in self.test_data:
            member = self.test_data['admin_user']
            # Delete group memberships
            GroupMembers.objects.filter(member=member).delete()
            # Delete role memberships
            MembersRole.objects.filter(member=member).delete()
            # Delete user and member
            if member.user:
                member.user.delete()
            member.delete()
            print(f"✓ Deleted Admin User")
    
    def setup_test_data(self):
        """Setup test environment"""
        print("\n" + "="*80)
        print("SETTING UP TEST ENVIRONMENT")
        print("="*80)
        
        # Create test admin user with approval permission
        admin_username = f"test_admin_{int(time.time())}"
        admin_user_obj = User.objects.create_user(
            username=admin_username,
            email=f"{admin_username}@test.com",
            password="testpass123"
        )
        self.test_data['admin_user'] = Member.objects.create(
            user=admin_user_obj,
            full_name="Test Admin",
            general_email=admin_user_obj.email,
            general_contact="1234567890",
            is_org_member=True
        )
        print(f"✓ Created admin user: {self.test_data['admin_user'].full_name} (ID: {self.test_data['admin_user'].id})")
        
        # Create test User A (without bulletin permission initially)
        # Making them an org member so they're included in bulletin notifications without needing resident setup
        user_a_username = f"test_user_a_{int(time.time())}"
        user_a_obj = User.objects.create_user(
            username=user_a_username,
            email=f"{user_a_username}@test.com",
            password="testpass123"
        )
        self.test_data['user_a'] = Member.objects.create(
            user=user_a_obj,
            full_name="Test User A",
            general_email=user_a_obj.email,
            general_contact="0987654321",
            is_org_member=True  # Org members automatically receive bulletin notifications
        )
        print(f"✓ Created User A: {self.test_data['user_a'].full_name} (ID: {self.test_data['user_a'].id}) [org_member]")
        
        # Create pending bulletins (BEFORE User A has permission)
        print("\n" + "-"*80)
        print("STEP 1: Creating pending bulletins")
        print("-"*80)
        
        self.test_data['bulletin_ids'] = []
        for i in range(3):
            bulletin = Bulletin.objects.create(
                title=f"Test Bulletin {i+1} - Created Before Permission",
                description=f"This bulletin was created before User A had permission",
                creator=self.test_data['admin_user'],
                priority='normal',
                status='pending',
                post_as='creator'
            )
            self.test_data['bulletin_ids'].append(bulletin.id)
            print(f"  ✓ Created pending bulletin {i+1}: '{bulletin.title}' (ID: {bulletin.id})")
            print(f"    - Status: {bulletin.status}")
            print(f"    - Created at: {bulletin.created_at}")
        
        # Wait a bit to ensure distinct timestamps
        time.sleep(2)
        
        return True
    
    def test_scenario(self):
        """Run the full test scenario"""
        
        # STEP 2: Verify User A doesn't have bulletin permission
        print("\n" + "-"*80)
        print("STEP 2: Verifying User A doesn't have bulletin permission initially")
        print("-"*80)
        
        user_a = self.test_data['user_a']
        has_permission_before = PERMISSION_VIEW_BULLETIN_BOARD in user_a.get_permission_ids()
        print(f"  User A has view bulletin permission: {has_permission_before}")
        
        if has_permission_before:
            print("  ⚠ WARNING: User A already has permission, test may not be accurate")
        
        # Wait to ensure distinct timestamps
        time.sleep(2)
        
        # STEP 3: Grant bulletin permission to User A
        print("\n" + "-"*80)
        print("STEP 3: Granting bulletin permission to User A")
        print("-"*80)
        
        # Get or create a test group and role
        test_group, _ = Group.objects.get_or_create(
            group_name="Test Bulletin Group",
            defaults={'is_active': True}
        )
        
        test_role, _ = Role.objects.get_or_create(
            role_name="Test Bulletin Viewer",
            defaults={'is_active': True}
        )
        
        # Add view bulletin permission to the role
        view_permission = Permission.objects.filter(id=PERMISSION_VIEW_BULLETIN_BOARD).first()
        if view_permission:
            RolePermission.objects.get_or_create(
                role=test_role,
                permission=view_permission,
                defaults={'is_active': True}
            )
            print(f"  ✓ Added view bulletin permission to role '{test_role.role_name}'")
        
        # Add User A to the group
        GroupMembers.objects.get_or_create(
            group=test_group,
            member=user_a
        )
        print(f"  ✓ Added User A to group '{test_group.group_name}'")
        
        # Assign role to User A
        MembersRole.objects.get_or_create(
            member=user_a,
            role=test_role
        )
        print(f"  ✓ Assigned role '{test_role.role_name}' to User A")
        
        # Refresh user_a from database to get updated permissions
        user_a.refresh_from_db()
        
        # Verify permission was granted
        has_permission_after = PERMISSION_VIEW_BULLETIN_BOARD in user_a.get_permission_ids()
        print(f"  User A now has view bulletin permission: {has_permission_after}")
        
        if not has_permission_after:
            print("  ✗ ERROR: Failed to grant permission to User A")
            return False
        
        # Get permission grant timestamp
        permission_grant_time = user_a.get_permission_grant_timestamp(PERMISSION_VIEW_BULLETIN_BOARD)
        print(f"  Permission granted at: {permission_grant_time}")
        
        # Wait to ensure approval happens after permission grant
        time.sleep(2)
        
        # STEP 4: Admin approves one of the pending bulletins
        print("\n" + "-"*80)
        print("STEP 4: Admin approves a pending bulletin (after User A has permission)")
        print("-"*80)
        
        # Get the first pending bulletin
        bulletin_to_approve = Bulletin.objects.get(id=self.test_data['bulletin_ids'][0])
        print(f"  Approving bulletin: '{bulletin_to_approve.title}' (ID: {bulletin_to_approve.id})")
        print(f"    - Created at: {bulletin_to_approve.created_at}")
        print(f"    - Current status: {bulletin_to_approve.status}")
        
        # Check timestamps
        print(f"\n  Timestamp comparison:")
        print(f"    - Bulletin created at: {bulletin_to_approve.created_at}")
        print(f"    - Permission granted at: {permission_grant_time}")
        print(f"    - Bulletin created BEFORE permission: {bulletin_to_approve.created_at < permission_grant_time}")
        
        # Approve the bulletin (change status to 'current')
        bulletin_to_approve.status = 'current'
        bulletin_to_approve.save()
        approval_time = timezone.now()
        print(f"    - Approved at: {approval_time}")
        print(f"    - Approved AFTER permission: {approval_time > permission_grant_time}")
        
        # Create bulletin posted notifications with approval timestamp
        print(f"\n  Creating bulletin posted notifications...")
        notifications_created = create_bulletin_posted_notification(bulletin_to_approve, approval_timestamp=approval_time)
        print(f"  ✓ Created {len(notifications_created)} notifications")
        
        # STEP 5: Check if User A received the notification
        print("\n" + "-"*80)
        print("STEP 5: Checking if User A received the notification")
        print("-"*80)
        
        # Get User A's notifications
        user_a_notifications = Notification.objects.filter(
            recipient=user_a,
            entity_type='bulletin',
            entity_id=bulletin_to_approve.id
        )
        
        print(f"  User A's notifications for this bulletin: {user_a_notifications.count()}")
        
        if user_a_notifications.exists():
            for notif in user_a_notifications:
                print(f"    - Notification ID: {notif.id}")
                print(f"      Type: {notif.notification_type.code}")
                print(f"      Title: {notif.title}")
                print(f"      Message: {notif.message}")
                print(f"      Created at: {notif.created_at}")
        
        # Check if notification would be shown (retroactive check)
        from notifications.utils import should_show_notification
        
        if user_a_notifications.exists():
            notification = user_a_notifications.first()
            should_show = should_show_notification(user_a, notification)
            print(f"\n  Should show notification (retroactive check): {should_show}")
            
            if not should_show:
                print(f"    ✗ ISSUE FOUND: Notification exists but is hidden due to retroactive filtering")
                print(f"    - Bulletin created at: {bulletin_to_approve.created_at}")
                print(f"    - Permission granted at: {permission_grant_time}")
                print(f"    - Bulletin approved at: {approval_time}")
                print(f"    - The notification logic is checking creation time instead of approval time!")
        else:
            print(f"    ✗ ISSUE FOUND: No notification was created for User A")
        
        # STEP 6: Results
        print("\n" + "="*80)
        print("TEST RESULTS")
        print("="*80)
        
        success = user_a_notifications.exists()
        
        if success:
            notification_visible = should_show_notification(user_a, user_a_notifications.first())
            if notification_visible:
                print("✓ PASSED: User A received the notification and it's visible")
                return True
            else:
                print("✗ FAILED: User A received the notification but it's hidden by retroactive filtering")
                print("\nISSUE EXPLANATION:")
                print("The notification system is checking if the bulletin was CREATED after permission grant,")
                print("but it should check if the bulletin was APPROVED after permission grant.")
                print("\nSOLUTION:")
                print("1. Store approval timestamp in Bulletin model, OR")
                print("2. For bulletin_posted notifications, check notification creation time instead of entity creation time")
                return False
        else:
            print("✗ FAILED: User A did not receive the notification")
            print("\nThis could indicate an issue with the notification creation logic.")
            return False
    
    def run(self):
        """Run the complete test"""
        try:
            print("\n" + "="*80)
            print("BULLETIN APPROVAL NOTIFICATION TEST")
            print("="*80)
            print("This test reproduces the issue where users don't receive notifications")
            print("for bulletins approved after they receive permission.")
            
            # Setup
            if not self.setup_test_data():
                print("\n✗ Setup failed")
                return False
            
            # Run test
            result = self.test_scenario()
            
            return result
            
        except Exception as e:
            print(f"\n✗ ERROR during test: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            # Cleanup
            self.cleanup()


if __name__ == "__main__":
    test = BulletinApprovalNotificationTest()
    success = test.run()
    
    print("\n" + "="*80)
    if success:
        print("✓ TEST COMPLETED SUCCESSFULLY")
    else:
        print("✗ TEST FAILED - Issue reproduced")
    print("="*80)
    
    sys.exit(0 if success else 1)

