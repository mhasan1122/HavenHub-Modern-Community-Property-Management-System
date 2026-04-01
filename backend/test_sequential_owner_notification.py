#!/usr/bin/env python
"""
Test script to verify sequential owner creation with batch notifications.
This test simulates the scenario where owners are created one by one (due to pending members/companies)
but notifications should be batched into a single combined notification.
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
from notifications.utils import create_bulk_owner_added_notification


def run_test():
    print("\n" + "="*80)
    print("TESTING SEQUENTIAL OWNER CREATION WITH BATCH NOTIFICATION")
    print("="*80 + "\n")

    # Clean up previous test data
    print("🧹 Cleaning up previous test data...")
    User.objects.filter(username__in=['test_creator_seq', 'test_owner1_seq', 'test_owner2_seq', 'test_owner3_seq']).delete()
    Notification.objects.filter(title__contains='Sequential Test').delete()
    
    try:
        # Create test users and members
        print("\n📝 Step 1: Creating test users and members...")
        
        creator_user = User.objects.create_user(
            username='test_creator_seq',
            email='creator_seq@test.com',
            password='password123'
        )
        creator_member = Member.objects.create(
            user=creator_user,
            full_name='Creator User',
            general_contact='1234567890',
            present_address='Test Address',
            nid_number='1234567890123'
        )
        print(f"✅ Created creator member: {creator_member.full_name} (ID: {creator_member.id})")
        
        # Create three owner members
        owner_members = []
        for i in range(1, 4):
            owner_user = User.objects.create_user(
                username=f'test_owner{i}_seq',
                email=f'owner{i}_seq@test.com',
                password='password123'
            )
            owner_member = Member.objects.create(
                user=owner_user,
                full_name=f'Owner {i} Sequential',
                general_contact=f'555000000{i}',
                present_address='Test Address',
                nid_number=f'9876543210{i}'
            )
            owner_members.append(owner_member)
            print(f"✅ Created owner member: {owner_member.full_name} (ID: {owner_member.id})")
        
        # Create tower, floor, and unit
        print("\n🏢 Step 2: Creating test tower, floor, and unit...")
        
        tower = Tower.objects.create(
            tower_name='Sequential Test Tower',
            tower_number=999,
            num_floors=10,
            num_units=100,
            unit_naming_type='Number',
            add_tower_number_to_unit_name=False,
            units_per_floor='Same as Every Floor'
        )
        
        floor = Floor.objects.create(
            tower=tower,
            floor_no=5,
            number_of_units=10
        )
        
        unit = Unit.objects.create(
            floor=floor,
            unit_name='501-SEQ',
            unit_status='no_owner',
            area=1200,
            number_of_rooms=3,
            number_of_bathrooms=2
        )
        print(f"✅ Created unit: {unit.floor.tower.tower_name}, Unit {unit.unit_name} (ID: {unit.id})")
        
        # SIMULATE SEQUENTIAL CREATION (like frontend with pending members/companies)
        print("\n🔄 Step 3: Creating owners sequentially (simulating pending member scenario)...")
        created_owners = []
        
        for i, owner_member in enumerate(owner_members):
            # Create owner one by one (with skip_notification flag conceptually)
            owner = Owner.objects.create(
                member=owner_member,
                unit=unit,
                ownership_percentage=33.33 if i < 2 else 33.34,
                date_of_ownership=date.today()
            )
            created_owners.append(owner)
            print(f"  ✅ Created owner {i+1}/3: {owner.member.full_name} ({owner.ownership_percentage}%)")
        
        # Now create batch notification (like frontend would call batch_owner_notification endpoint)
        print("\n📧 Step 4: Creating batch notification for all owners...")
        
        # Store timestamp before creating notifications
        from django.utils import timezone
        timestamp_before = timezone.now()
        
        # Check notification count before
        notifications_before = Notification.objects.count()
        
        # Create batch notification
        create_bulk_owner_added_notification(created_owners, creator=creator_member)
        
        # Check notification count after
        notifications_after = Notification.objects.count()
        notifications_created = notifications_after - notifications_before
        
        print(f"✅ Batch notification created. Notifications before: {notifications_before}, after: {notifications_after}")
        print(f"   New notifications: {notifications_created}")
        
        # VERIFICATION
        print("\n" + "="*80)
        print("VERIFICATION RESULTS")
        print("="*80 + "\n")
        
        # Check for manager notification with all owner names
        # The bulk notification should contain all three owner names
        all_recent_notifications = Notification.objects.filter(
            created_at__gte=timestamp_before
        ).order_by('-created_at')
        
        # Filter for notifications that contain all three owner names
        manager_notifications = [
            n for n in all_recent_notifications 
            if 'Owner 1 Sequential' in n.message 
            and 'Owner 2 Sequential' in n.message 
            and 'Owner 3 Sequential' in n.message
        ]
        
        print(f"📋 Manager notifications found with all 3 owner names: {len(manager_notifications)}")
        
        all_tests_passed = True
        
        if len(manager_notifications) == 0:
            # Check if ANY notifications were created
            any_notifications = [n for n in all_recent_notifications if 'Sequential Test Tower' in n.message]
            print(f"   Total notifications mentioning the tower: {len(any_notifications)}")
            if len(any_notifications) > 0:
                print("\n   Sample notification:")
                notif = any_notifications[0]
                print(f"   Title: {notif.title}")
                print(f"   Message: {notif.message[:200]}...")
            print("❌ FAIL: No manager notifications with all owner names found!")
            all_tests_passed = False
        else:
            notification = manager_notifications[0]
            print(f"\n📄 Manager Notification Details:")
            print(f"   Title: {notification.title}")
            print(f"   Message: {notification.message}")
            print(f"   Total recipients: {len(manager_notifications)}")
            
            # Check if all owner names are in the message
            owner_names = [owner.member.full_name for owner in created_owners]
            missing_names = []
            
            for name in owner_names:
                if name not in notification.message:
                    missing_names.append(name)
            
            if missing_names:
                print(f"   ❌ FAIL: Missing owner names in notification: {', '.join(missing_names)}")
                all_tests_passed = False
            else:
                print(f"   ✅ PASS: All owner names present in notification")
            
            # Check format
            if ',' in notification.message or 'and' in notification.message:
                print(f"   ✅ PASS: Names are properly formatted (comma-separated or with 'and')")
            else:
                print(f"   ⚠️  WARNING: Names might not be properly formatted")
        
        # Check that all notifications have the same message (confirming they're batched)
        print(f"\n📊 Notification consistency check:")
        if len(manager_notifications) > 1:
            first_message = manager_notifications[0].message
            all_same = all(n.message == first_message for n in manager_notifications)
            if all_same:
                print(f"   ✅ PASS: All {len(manager_notifications)} notifications have identical messages (properly batched)")
            else:
                print(f"   ❌ FAIL: Notifications have different messages (not properly batched)")
                all_tests_passed = False
        
        # Verify the message format
        if len(manager_notifications) > 0:
            sample_message = manager_notifications[0].message
            if 'Owner 1 Sequential, Owner 2 Sequential, Owner 3 Sequential' in sample_message or \
               'Owner 1 Sequential, Owner 2 Sequential and Owner 3 Sequential' in sample_message:
                print(f"   ✅ PASS: Owner names are formatted correctly")
            else:
                print(f"   ⚠️  WARNING: Owner name format may not be optimal")
                print(f"      Expected: 'Owner 1 Sequential, Owner 2 Sequential, Owner 3 Sequential'")
                print(f"      Got: {sample_message[sample_message.find('501-SEQ'):sample_message.find('501-SEQ')+100] if '501-SEQ' in sample_message else 'N/A'}")
        
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
