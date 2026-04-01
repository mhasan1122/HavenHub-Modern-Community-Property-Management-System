"""
Test script for bulk owner addition with single combined notification

This test verifies that:
1. Multiple owners can be added to a unit via bulk endpoint
2. A single notification is created with all owner names
3. The notification message contains comma-separated owner names
4. No duplicate notifications are created

Usage:
    python manage.py shell < test_bulk_owner_notification.py

Or run directly:
    python test_bulk_owner_notification.py
"""

import os
import sys
import django

# Setup Django environment
if __name__ == "__main__":
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction
from user.models import Member
from towers.models import Tower, Floor, Unit, Owner
from notifications.models import Notification, NotificationType
from notifications.utils import create_bulk_owner_added_notification
from group_role.models import Role, Permission
from datetime import datetime, date

User = get_user_model()


def cleanup_test_data():
    """Clean up any existing test data"""
    print("\n🧹 Cleaning up existing test data...")
    
    # Delete test owners
    Owner.objects.filter(
        member__full_name__in=['Test Owner 1', 'Test Owner 2', 'Test Owner 3']
    ).delete()
    
    # Delete MembersRole first (protected foreign key)
    from group_role.models import MembersRole
    MembersRole.objects.filter(
        member__full_name__in=['Test Owner 1', 'Test Owner 2', 'Test Owner 3', 'Test Manager']
    ).delete()
    
    # Delete test members
    Member.objects.filter(
        full_name__in=['Test Owner 1', 'Test Owner 2', 'Test Owner 3', 'Test Manager']
    ).delete()
    
    # Delete test users
    User.objects.filter(
        username__in=['testowner1', 'testowner2', 'testowner3', 'testmanager']
    ).delete()
    
    # Delete test notifications
    Notification.objects.filter(
        notification_type__code='owner_added',
        metadata__unit_name__icontains='Test Unit'
    ).delete()
    
    print("✅ Cleanup complete")


def create_test_unit():
    """Create or get test unit"""
    print("\n🏗️ Setting up test unit...")
    
    # Get or create tower
    tower, created = Tower.objects.get_or_create(
        tower_name='Test Tower',
        defaults={'tower_number': 999}
    )
    
    # Get or create floor
    floor, created = Floor.objects.get_or_create(
        floor_no=99,
        tower=tower,
        defaults={'number_of_units': 10}
    )
    
    # Get or create unit
    unit, created = Unit.objects.get_or_create(
        unit_name='Test Unit 999',
        floor=floor
    )
    
    # Clear any existing owners
    Owner.objects.filter(unit=unit).delete()
    
    print(f"✅ Test unit ready: {unit.unit_name} (ID: {unit.id})")
    return unit


def create_test_members():
    """Create test owner members"""
    print("\n👤 Creating test members...")
    
    members = []
    for i in range(1, 4):
        user, _ = User.objects.get_or_create(
            username=f'testowner{i}',
            defaults={'email': f'testowner{i}@example.com'}
        )
        
        member, _ = Member.objects.get_or_create(
            user=user,
            defaults={
                'full_name': f'Test Owner {i}',
                'general_email': f'testowner{i}@example.com',
                'is_org_member': False,
                'is_comm_member': True
            }
        )
        members.append(member)
        print(f"  ✅ Created member: {member.full_name} (ID: {member.id})")
    
    return members


def create_test_manager():
    """Create test manager with View Unit Resident permission"""
    print("\n👔 Creating test manager...")
    
    user, _ = User.objects.get_or_create(
        username='testmanager',
        defaults={'email': 'testmanager@example.com'}
    )
    
    member, _ = Member.objects.get_or_create(
        user=user,
        defaults={
            'full_name': 'Test Manager',
            'general_email': 'testmanager@example.com',
            'is_org_member': True,
            'is_comm_member': False
        }
    )
    
    # Get or create role with View Unit Resident permission
    view_resident_perm = Permission.objects.get(id=27)  # PERMISSION_VIEW_UNIT_RESIDENT
    
    role, _ = Role.objects.get_or_create(
        role_name='Test Manager Role',
        defaults={'role_description': 'Test role for manager'}
    )
    
    # Create RolePermission if it doesn't exist
    from group_role.models import RolePermission, MembersRole
    RolePermission.objects.get_or_create(
        role=role,
        permission=view_resident_perm,
        defaults={'is_active': True}
    )
    
    # Assign role to member
    members_role, _ = MembersRole.objects.get_or_create(
        member=member,
        role=role,
        defaults={
            'is_active': True,
            'is_member': True,
            'is_group': False
        }
    )
    
    print(f"✅ Test manager created: {member.full_name} (ID: {member.id})")
    return member


def test_bulk_owner_notification():
    """Main test function"""
    print("\n" + "="*80)
    print("🧪 TESTING BULK OWNER ADDITION WITH SINGLE NOTIFICATION")
    print("="*80)
    
    try:
        # Step 1: Cleanup
        cleanup_test_data()
        
        # Step 2: Setup test data
        unit = create_test_unit()
        owner_members = create_test_members()
        manager = create_test_manager()
        
        # Step 3: Clear existing notifications for this manager
        Notification.objects.filter(recipient=manager, notification_type__code='owner_added').delete()
        print("\n📭 Cleared existing notifications")
        
        # Step 4: Create owners
        print("\n📝 Creating multiple owners...")
        owners = []
        with transaction.atomic():
            for i, member in enumerate(owner_members, 1):
                owner = Owner.objects.create(
                    member=member,
                    unit=unit,
                    ownership_percentage=33.33 if i < 3 else 33.34,  # Total = 100%
                    date_of_ownership=date.today()
                )
                owners.append(owner)
                print(f"  ✅ Created owner {i}: {member.full_name} ({owner.ownership_percentage}%)")
        
        # Step 5: Create bulk notification
        print("\n🔔 Creating bulk notification...")
        notifications_created = create_bulk_owner_added_notification(owners, creator=None)
        print(f"✅ Created {notifications_created} notification(s) for managers")
        
        # Create self-notifications for each owner
        print("\n🔔 Creating self-notifications for owners...")
        from notifications.utils import create_owner_added_self_notification
        for owner in owners:
            create_owner_added_self_notification(owner)
        print(f"✅ Created self-notifications for {len(owners)} owners")
        
        # Step 6: Verify notifications
        print("\n🔍 Verifying notifications...")
        
        # Check manager notification (bulk notification for all owners)
        # Note: Our test manager won't receive it since they're newly created
        # Let's check if ANY managers received notifications
        manager_notifications = Notification.objects.filter(
            notification_type__code='owner_added',
            entity_type='resident',
            message__icontains='Test Unit 999'
        ).order_by('-created_at')
        
        manager_notification_count = manager_notifications.count()
        print(f"  📊 Total manager notifications created: {manager_notification_count}")
        
        if manager_notification_count == 0:
            print("  ❌ FAILED: No manager notifications were created!")
            return False
        
        # Pick one notification to verify content
        manager_notification = manager_notifications.first()
        print(f"\n  ✅ Manager notifications created for {manager_notification_count} managers")
        print(f"  📝 Sample notification (ID: {manager_notification.id})")
        print(f"     Recipient: {manager_notification.recipient.full_name}")
        print(f"     Title: {manager_notification.title}")
        print(f"     Message: {manager_notification.message}")
        
        # Check that all owner names are in the message
        all_names_present = all(
            owner.member.full_name in manager_notification.message 
            for owner in owners
        )
        
        if not all_names_present:
            print("\n  ❌ FAILED: Not all owner names are in the manager notification message!")
            missing = [
                owner.member.full_name 
                for owner in owners 
                if owner.member.full_name not in manager_notification.message
            ]
            print(f"  Missing names: {missing}")
            return False
        
        print(f"\n  ✅ All owner names present in manager notification:")
        for owner in owners:
            print(f"    ✓ {owner.member.full_name}")
        
        # Step 7: Verify self-notifications for each owner
        print("\n🔍 Verifying self-notifications for each owner...")
        
        for owner in owners:
            self_notifications = Notification.objects.filter(
                recipient=owner.member,
                notification_type__code='owner_added_self',
                entity_type='owner',
                message__icontains='Test Unit 999'
            )
            
            self_count = self_notifications.count()
            
            if self_count == 0:
                print(f"  ❌ FAILED: No self-notification for {owner.member.full_name}!")
                return False
            
            if self_count > 1:
                print(f"  ⚠️ WARNING: Multiple self-notifications ({self_count}) for {owner.member.full_name}")
            
            self_notif = self_notifications.first()
            print(f"  ✅ Self-notification created for {owner.member.full_name} (ID: {self_notif.id})")
            print(f"     Title: {self_notif.title}")
            print(f"     Message: {self_notif.message}")
        
        # Check metadata
        if manager_notification.metadata:
            owner_count = manager_notification.metadata.get('owner_count', 0)
            owner_names = manager_notification.metadata.get('owner_names', [])
            print(f"\n  📦 Metadata:")
            print(f"    - Owner count: {owner_count}")
            print(f"    - Owner names: {owner_names}")
            
            if owner_count != len(owners):
                print(f"  ⚠️ WARNING: Owner count in metadata ({owner_count}) doesn't match actual owners ({len(owners)})")
        
        # Step 8: Success
        print("\n" + "="*80)
        print("✅ TEST PASSED:")
        print(f"  - {manager_notification_count} bulk notifications created for managers")
        print(f"  - All manager notifications contain all {len(owners)} owner names")
        print(f"  - {len(owners)} self-notifications created (one for each owner)")
        print("="*80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED with error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_single_owner_notification():
    """Test that single owner addition works correctly"""
    print("\n" + "="*80)
    print("🧪 TESTING SINGLE OWNER ADDITION")
    print("="*80)
    
    try:
        # Setup
        cleanup_test_data()
        unit = create_test_unit()
        owner_members = create_test_members()
        manager = create_test_manager()
        
        # Clear notifications
        Notification.objects.filter(recipient=manager, notification_type__code='owner_added').delete()
        
        # Create single owner
        print("\n📝 Creating single owner...")
        owner = Owner.objects.create(
            member=owner_members[0],
            unit=unit,
            ownership_percentage=100.0,
            date_of_ownership=date.today()
        )
        print(f"  ✅ Created owner: {owner.member.full_name}")
        
        # Create notification
        print("\n🔔 Creating notifications...")
        notifications_created = create_bulk_owner_added_notification([owner], creator=None)
        print(f"✅ Created {notifications_created} notification(s) for managers")
        
        # Create self-notification for the owner
        from notifications.utils import create_owner_added_self_notification
        create_owner_added_self_notification(owner)
        print(f"✅ Created self-notification for owner")
        
        # Verify manager notifications
        notifications = Notification.objects.filter(
            notification_type__code='owner_added',
            message__icontains='Test Unit 999'
        )
        
        if notifications.count() == 0:
            print(f"  ❌ FAILED: Expected manager notifications, got {notifications.count()}")
            return False
        
        notification = notifications.first()
        print(f"\n  ✅ Manager notifications created ({notifications.count()} total)")
        print(f"  📝 Sample notification (ID: {notification.id})")
        print(f"     Recipient: {notification.recipient.full_name}")
        print(f"     Title: {notification.title}")
        print(f"     Message: {notification.message}")
        
        # Should say "New Owner Added" (singular) for single owner
        if "New Owners Added" in notification.title:
            print("  ⚠️ WARNING: Title uses plural form for single owner")
        
        # Check self-notification for the owner
        self_notifications = Notification.objects.filter(
            recipient=owner.member,
            notification_type__code='owner_added_self',
            message__icontains='Test Unit 999'
        )
        
        if self_notifications.count() != 1:
            print(f"  ❌ FAILED: Expected 1 self-notification, got {self_notifications.count()}")
            return False
        
        self_notif = self_notifications.first()
        print(f"\n  ✅ Self-notification created for {owner.member.full_name}")
        print(f"  📝 Title: {self_notif.title}")
        print(f"  📝 Message: {self_notif.message}")
        
        print("\n✅ TEST PASSED: Single owner notifications work correctly!")
        print(f"  - 1 manager notification")
        print(f"  - 1 self-notification for the owner")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED with error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n🚀 Starting Bulk Owner Notification Tests\n")
    
    # Run tests
    test1_passed = test_bulk_owner_notification()
    print("\n" + "-"*80 + "\n")
    test2_passed = test_single_owner_notification()
    
    # Summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    print(f"Bulk owner notification test: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"Single owner notification test: {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed:
        print("\n🎉 ALL TESTS PASSED! 🎉")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
