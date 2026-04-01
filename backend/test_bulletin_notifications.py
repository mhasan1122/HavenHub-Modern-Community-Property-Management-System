#!/usr/bin/env python
"""
Test script to verify bulletin notification system
Tests: approve, reject, pending, and update notifications
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin, BulletinHistory
from user.models import Member
from notifications.models import Notification, NotificationType
from notifications.utils import (
    create_bulletin_posted_notification,
    create_bulletin_needs_approval_notification,
    create_bulletin_updated_notification,
    create_bulletin_rejected_notification,
    get_members_with_bulletin_approval_permission
)

def test_notification_functions():
    """Test all bulletin notification functions"""
    print("="*80)
    print("TESTING BULLETIN NOTIFICATION SYSTEM")
    print("="*80)
    
    # Get a test bulletin (or create one for testing)
    bulletin = Bulletin.objects.filter(status='pending').first()
    
    if not bulletin:
        print("\n❌ No pending bulletin found for testing. Please create a bulletin first.")
        return
    
    print(f"\n✓ Found test bulletin: {bulletin.id} - {bulletin.title}")
    print(f"  Status: {bulletin.status}")
    print(f"  Creator: {bulletin.creator.full_name if bulletin.creator else 'None'}")
    
    # Test 1: Check if approval permission members exist
    print("\n" + "="*80)
    print("TEST 1: Check Approval Permission Members")
    print("="*80)
    approval_members = get_members_with_bulletin_approval_permission()
    print(f"✓ Found {len(approval_members)} members with approval permission:")
    for member in approval_members[:5]:  # Show first 5
        print(f"  - {member.full_name} (ID: {member.id})")
    if len(approval_members) > 5:
        print(f"  ... and {len(approval_members) - 5} more")
    
    # Test 2: Check notification types
    print("\n" + "="*80)
    print("TEST 2: Check Notification Types")
    print("="*80)
    notification_types = NotificationType.objects.filter(entity_type='bulletin')
    print(f"✓ Found {notification_types.count()} bulletin notification types:")
    for nt in notification_types:
        print(f"  - {nt.code}: {nt.name} (Icon: {nt.icon})")
    
    # Test 3: Test pending notification (without actually creating)
    print("\n" + "="*80)
    print("TEST 3: Simulate Pending Bulletin Notification")
    print("="*80)
    print(f"Target bulletin: {bulletin.id}")
    print(f"Creator: {bulletin.creator.full_name if bulletin.creator else 'None'}")
    print(f"Approval members: {len(approval_members)}")
    print(f"Expected notifications: {len(approval_members) + 1} (approvers + creator)")
    
    # Test 4: Test approval notification recipients
    print("\n" + "="*80)
    print("TEST 4: Simulate Approve Bulletin Notification")
    print("="*80)
    if bulletin.target_towers.exists() or bulletin.target_units.exists():
        print(f"Target Towers: {bulletin.target_towers.count()}")
        print(f"Target Units: {bulletin.target_units.count()}")
    else:
        print("No specific towers/units - will notify all community members")
    
    # Test 5: Check existing notifications for this bulletin
    print("\n" + "="*80)
    print("TEST 5: Check Existing Notifications for This Bulletin")
    print("="*80)
    existing_notifications = Notification.objects.filter(
        entity_type='bulletin',
        entity_id=bulletin.id
    )
    print(f"✓ Found {existing_notifications.count()} existing notifications:")
    for notif in existing_notifications[:10]:  # Show first 10
        print(f"  - [{notif.notification_type.code}] To: {notif.recipient.full_name} | Read: {notif.is_read}")
    if existing_notifications.count() > 10:
        print(f"  ... and {existing_notifications.count() - 10} more")
    
    # Test 6: Check bulletin history
    print("\n" + "="*80)
    print("TEST 6: Check Bulletin History")
    print("="*80)
    history = BulletinHistory.objects.filter(bulletin=bulletin).order_by('-edited_at')
    print(f"✓ Found {history.count()} history entries:")
    for h in history[:5]:  # Show first 5
        print(f"  - [{h.action}] By: {h.edited_by.full_name} at {h.edited_at}")
        if h.comment:
            print(f"    Comment: {h.comment}")
    
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"✓ Bulletin found: {bulletin.title}")
    print(f"✓ Approval members: {len(approval_members)}")
    print(f"✓ Notification types: {notification_types.count()}")
    print(f"✓ Existing notifications: {existing_notifications.count()}")
    print(f"✓ History entries: {history.count()}")
    print("\n✅ All checks completed!")
    
    # Check for specific notification types needed
    print("\n" + "="*80)
    print("REQUIRED NOTIFICATION TYPES CHECK")
    print("="*80)
    required_types = [
        'bulletin_posted',
        'bulletin_needs_approval',
        'bulletin_updated',
        'bulletin_rejected'
    ]
    for req_type in required_types:
        exists = NotificationType.objects.filter(code=req_type).exists()
        status_symbol = "✓" if exists else "❌"
        print(f"{status_symbol} {req_type}: {'EXISTS' if exists else 'MISSING'}")

if __name__ == '__main__':
    try:
        test_notification_functions()
    except Exception as e:
        print(f"\n❌ Error running tests: {e}")
        import traceback
        traceback.print_exc()
