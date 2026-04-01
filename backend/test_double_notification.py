#!/usr/bin/env python
"""
Test script to verify login user receives BOTH notifications when adding themselves as owner.
Scenario: Login user (who has manager permission) adds themselves + other owners.
Expected: Login user receives:
  1. "You Were Added as Owner" (self-notification)
  2. "New Owners Added" (manager notification with all owner names)
"""

import os
import sys
import django
from datetime import date

# Add the backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from towers.models import Member, Unit, Tower, Floor, Owner
from notifications.models import Notification
from notifications.utils import create_bulk_owner_added_notification, create_owner_added_self_notification
from group_role.models import MembersRole, Role, RolePermission
from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT


def run_test():
    print("\n" + "="*80)
    print("TESTING DOUBLE NOTIFICATION FOR LOGIN USER")
    print("="*80 + "\n")

    # Clean up previous test data
    print("🧹 Cleaning up previous test data...")
    User.objects.filter(username__in=['test_login_manager', 'test_other_owner1', 'test_other_owner2']).delete()
    
    try:
        # Create test users and members
        print("\n📝 Step 1: Creating test users and members...")
        
        # Create login user (manager with permission)
        login_user = User.objects.create_user(
            username='test_login_manager',
            email='login_manager@test.com',
            password='password123'
        )
        login_member = Member.objects.create(
            user=login_user,
            full_name='Login Manager User',
            general_contact='1234567890',
            general_email='login@test.com',
            is_org_member=True
        )
        
        # Assign "View Unit Resident" permission to login user
        manager_role = Role.objects.filter(is_active=True).first()
        if manager_role:
            # Check if permission exists for this role
            role_permission = RolePermission.objects.filter(
                role=manager_role,
                permission_id=PERMISSION_VIEW_UNIT_RESIDENT,
                is_active=True
            ).first()
            
            if role_permission:
                # Assign role to login user
                MembersRole.objects.get_or_create(
                    member=login_member,
                    role=manager_role,
                    defaults={'is_active': True}
                )
                print(f"✅ Created login member with manager permission: {login_member.full_name} (ID: {login_member.id})")
            else:
                print(f"⚠️  Warning: Role {manager_role.role_name} doesn't have 'View Unit Resident' permission")
                print(f"   Login user may not receive manager notification")
        else:
            print(f"⚠️  Warning: No active roles found")
        
        # Create two other owner members (without manager permission)
        other_owners = []
        for i in range(1, 3):
            owner_user = User.objects.create_user(
                username=f'test_other_owner{i}',
                email=f'other_owner{i}@test.com',
                password='password123'
            )
            owner_member = Member.objects.create(
                user=owner_user,
                full_name=f'Other Owner {i}',
                general_contact=f'555000000{i}',
                general_email=f'owner{i}@test.com',
                is_org_member=False  # Not a manager
            )
            other_owners.append(owner_member)
            print(f"✅ Created other owner: {owner_member.full_name} (ID: {owner_member.id})")
        
        # Create tower, floor, and unit
        print("\n🏢 Step 2: Creating test tower, floor, and unit...")
        
        tower = Tower.objects.create(
            tower_name='Double Notification Test Tower',
            tower_number=888,
            num_floors=10,
            num_units=100,
            unit_naming_type='Number',
            add_tower_number_to_unit_name=False,
            units_per_floor='Same as Every Floor'
        )
        
        floor = Floor.objects.create(
            tower=tower,
            floor_no=3,
            number_of_units=10
        )
        
        unit = Unit.objects.create(
            floor=floor,
            unit_name='301-DBL',
            unit_status='no_owner',
            area=1500,
            number_of_rooms=3,
            number_of_bathrooms=2
        )
        print(f"✅ Created unit: {unit.floor.tower.tower_name}, Unit {unit.unit_name} (ID: {unit.id})")
        
        # SCENARIO: Login user adds themselves + 2 other owners
        print("\n🔄 Step 3: Login user adds themselves + 2 other owners...")
        
        from django.utils import timezone
        timestamp_before = timezone.now()
        
        created_owners = []
        
        # Add login user as owner
        login_owner = Owner.objects.create(
            member=login_member,
            unit=unit,
            ownership_percentage=33.33,
            date_of_ownership=date.today()
        )
        created_owners.append(login_owner)
        print(f"  ✅ Added login user as owner: {login_member.full_name} (33.33%)")
        
        # Add other owners
        for i, other_member in enumerate(other_owners):
            owner = Owner.objects.create(
                member=other_member,
                unit=unit,
                ownership_percentage=33.33 if i == 0 else 33.34,
                date_of_ownership=date.today()
            )
            created_owners.append(owner)
            print(f"  ✅ Added other owner: {other_member.full_name} ({owner.ownership_percentage}%)")
        
        # Create self-notifications for all owners
        print("\n📧 Step 4: Creating self-notifications for all owners...")
        for owner in created_owners:
            create_owner_added_self_notification(owner)
            print(f"  ✅ Self-notification created for {owner.member.full_name}")
        
        # Create batch manager notification
        print("\n📧 Step 5: Creating batch manager notification...")
        create_bulk_owner_added_notification(created_owners, creator=login_member)
        print(f"  ✅ Batch manager notification created")
        
        # VERIFICATION
        print("\n" + "="*80)
        print("VERIFICATION RESULTS")
        print("="*80 + "\n")
        
        # Get all notifications for login user created after timestamp
        login_user_notifications = Notification.objects.filter(
            recipient=login_member,
            created_at__gte=timestamp_before
        ).order_by('-created_at')
        
        print(f"📋 Total notifications for login user: {login_user_notifications.count()}")
        
        all_tests_passed = True
        
        # Check for self-notification
        self_notifications = [n for n in login_user_notifications if n.notification_type.code == 'owner_added_self']
        print(f"\n🔔 Self-notifications (owner_added_self): {len(self_notifications)}")
        if len(self_notifications) > 0:
            notif = self_notifications[0]
            print(f"   Title: {notif.title}")
            print(f"   Message: {notif.message}")
            print(f"   ✅ PASS: Login user received self-notification")
        else:
            print(f"   ❌ FAIL: Login user did NOT receive self-notification")
            all_tests_passed = False
        
        # Check for manager notification with all owner names
        manager_notifications = [
            n for n in login_user_notifications 
            if 'Login Manager User' in n.message 
            and 'Other Owner 1' in n.message 
            and 'Other Owner 2' in n.message
        ]
        
        print(f"\n🔔 Manager notifications with all 3 owner names: {len(manager_notifications)}")
        if len(manager_notifications) > 0:
            notif = manager_notifications[0]
            print(f"   Title: {notif.title}")
            print(f"   Message: {notif.message}")
            print(f"   ✅ PASS: Login user received manager notification with all owner names")
        else:
            print(f"   ❌ FAIL: Login user did NOT receive manager notification")
            
            # Check if ANY manager notifications exist
            any_manager = [n for n in login_user_notifications if n.notification_type.code != 'owner_added_self']
            if len(any_manager) > 0:
                print(f"   Found {len(any_manager)} other notifications:")
                for n in any_manager[:3]:
                    print(f"     - {n.title}: {n.message[:100]}...")
            all_tests_passed = False
        
        # Summary
        print(f"\n📊 SUMMARY:")
        print(f"   Login user notifications: {login_user_notifications.count()}")
        print(f"   - Self-notifications: {len(self_notifications)}")
        print(f"   - Manager notifications: {len(manager_notifications)}")
        
        if len(self_notifications) > 0 and len(manager_notifications) > 0:
            print(f"\n   ✅✅ DOUBLE NOTIFICATION SUCCESS!")
            print(f"   Login user receives BOTH notifications as expected:")
            print(f"   1. 'You Were Added as Owner'")
            print(f"   2. 'New Owners Added' (with all owner names)")
        elif len(self_notifications) > 0:
            print(f"\n   ⚠️  Login user only received self-notification")
            print(f"   Missing manager notification")
            all_tests_passed = False
        elif len(manager_notifications) > 0:
            print(f"\n   ⚠️  Login user only received manager notification")
            print(f"   Missing self-notification")
            all_tests_passed = False
        else:
            print(f"\n   ❌ Login user received NO notifications")
            all_tests_passed = False
        
        # Print summary
        print("\n" + "="*80)
        if all_tests_passed:
            print("✅ ALL TESTS PASSED!")
        else:
            print("❌ SOME TESTS FAILED!")
        print("="*80 + "\n")
        
        return all_tests_passed
        
    except Exception as e:
        print(f"\n❌ ERROR during test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = run_test()
    sys.exit(0 if success else 1)
