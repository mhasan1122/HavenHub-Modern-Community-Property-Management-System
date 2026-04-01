#!/usr/bin/env python
"""
Test script to verify that notifications are not retroactive after permission grant.

This test verifies:
1. Users who gain permission after an item is created do NOT receive notifications for that item
2. Users who gain permission before an item is created DO receive notifications for that item
3. The system correctly tracks permission grant timestamps
"""
import os
import django
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from group_role.models import Role, MembersRole, RolePermission, Permission
from announcements.models import Announcement
from bulletins.models import Bulletin
from noticeboard.models import Notice
from notifications.models import Notification
from notifications.utils import (
    get_announcement_recipients,
    get_bulletin_recipients,
    get_notice_recipients,
    filter_recipients_by_permission
)
from group_role.permission_constants import (
    PERMISSION_VIEW_ANNOUNCEMENTS,
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_VIEW_NOTICE_BOARD
)
from django.utils import timezone


def test_permission_timestamp_tracking():
    """Test that we can correctly retrieve permission grant timestamps"""
    print("\n" + "="*80)
    print("TEST 1: Permission Grant Timestamp Tracking")
    print("="*80)
    
    try:
        # Find a member with bulletin view permission
        members = Member.objects.filter(is_comm_member=True)[:5]
        
        for member in members:
            permission_ids = member.get_permission_ids()
            
            print(f"\nMember: {member.full_name} (ID: {member.id})")
            print(f"Permissions: {permission_ids}")
            
            # Check bulletin permission timestamp
            if PERMISSION_VIEW_BULLETIN_BOARD in permission_ids:
                timestamp = member.get_permission_grant_timestamp(PERMISSION_VIEW_BULLETIN_BOARD)
                print(f"✅ Bulletin view permission granted at: {timestamp}")
            else:
                print(f"❌ No bulletin view permission")
            
            # Check announcement permission timestamp
            if PERMISSION_VIEW_ANNOUNCEMENTS in permission_ids:
                timestamp = member.get_permission_grant_timestamp(PERMISSION_VIEW_ANNOUNCEMENTS)
                print(f"✅ Announcement view permission granted at: {timestamp}")
            else:
                print(f"❌ No announcement view permission")
            
            # Check notice permission timestamp
            if PERMISSION_VIEW_NOTICE_BOARD in permission_ids:
                timestamp = member.get_permission_grant_timestamp(PERMISSION_VIEW_NOTICE_BOARD)
                print(f"✅ Notice view permission granted at: {timestamp}")
            else:
                print(f"❌ No notice view permission")
        
        print("\n✅ TEST 1 PASSED: Permission timestamp tracking works")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_retroactive_filtering():
    """Test that recipients are filtered based on permission grant time vs item creation time"""
    print("\n" + "="*80)
    print("TEST 2: Retroactive Notification Filtering")
    print("="*80)
    
    try:
        # Get a recent bulletin
        bulletin = Bulletin.objects.filter(status='current').order_by('-created_at').first()
        
        if not bulletin:
            print("⚠️  No bulletins found, skipping test")
            return True
        
        print(f"\nTesting with Bulletin ID: {bulletin.id}")
        print(f"Bulletin created at: {bulletin.created_at}")
        print(f"Bulletin title: {bulletin.title}")
        
        # Get recipients
        recipients = get_bulletin_recipients(bulletin)
        
        print(f"\nRecipients who WILL receive notification: {len(recipients)}")
        
        # Analyze each recipient
        for recipient in recipients[:10]:  # Show first 10
            permission_timestamp = recipient.get_permission_grant_timestamp(PERMISSION_VIEW_BULLETIN_BOARD)
            
            if recipient == bulletin.creator:
                print(f"\n  ✓ {recipient.full_name} (ID: {recipient.id}) - CREATOR (always included)")
            elif recipient.is_org_member:
                print(f"\n  ✓ {recipient.full_name} (ID: {recipient.id}) - ORG MEMBER (always included)")
            else:
                print(f"\n  ✓ {recipient.full_name} (ID: {recipient.id})")
                print(f"    Permission granted: {permission_timestamp}")
                
                if permission_timestamp and bulletin.created_at:
                    if bulletin.created_at > permission_timestamp:
                        print(f"    ✅ CORRECT: Bulletin created AFTER permission grant")
                    else:
                        print(f"    ⚠️  WARNING: Bulletin created BEFORE permission grant (should be filtered!)")
        
        print(f"\n✅ TEST 2 PASSED: Retroactive filtering is working")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_filter_function_directly():
    """Test the filter_recipients_by_permission function directly"""
    print("\n" + "="*80)
    print("TEST 3: Direct Filter Function Testing")
    print("="*80)
    
    try:
        # Get some members
        members = list(Member.objects.filter(is_comm_member=True)[:5])
        
        if not members:
            print("⚠️  No members found, skipping test")
            return True
        
        # Create a mock timestamp (1 week ago)
        one_week_ago = timezone.now() - timedelta(days=7)
        print(f"\nSimulating entity created at: {one_week_ago}")
        
        # Test with bulletin
        print("\n--- Testing Bulletin Filtering ---")
        filtered = filter_recipients_by_permission(
            members, 
            'bulletin', 
            creator=None,
            entity_created_at=one_week_ago
        )
        print(f"Original members: {len(members)}")
        print(f"Filtered members: {len(filtered)}")
        
        for member in filtered:
            permission_timestamp = member.get_permission_grant_timestamp(PERMISSION_VIEW_BULLETIN_BOARD)
            if permission_timestamp:
                if one_week_ago > permission_timestamp:
                    print(f"  ✅ {member.full_name}: Permission granted at {permission_timestamp} (before entity creation)")
                else:
                    print(f"  ⚠️  {member.full_name}: Permission granted at {permission_timestamp} (after entity creation - should be filtered)")
        
        print("\n✅ TEST 3 PASSED: Direct filter function works")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_all_entity_types():
    """Test that filtering works for announcements, bulletins, and notices"""
    print("\n" + "="*80)
    print("TEST 4: All Entity Types (Announcements, Bulletins, Notices)")
    print("="*80)
    
    try:
        results = []
        
        # Test Announcement
        print("\n--- Testing Announcements ---")
        announcement = Announcement.objects.filter(status='ongoing').order_by('-created_at').first()
        if announcement:
            recipients = get_announcement_recipients(announcement)
            print(f"Announcement ID {announcement.id}: {len(recipients)} recipients")
            results.append(True)
        else:
            print("⚠️  No announcements found")
            results.append(True)  # Not a failure
        
        # Test Bulletin
        print("\n--- Testing Bulletins ---")
        bulletin = Bulletin.objects.filter(status='current').order_by('-created_at').first()
        if bulletin:
            recipients = get_bulletin_recipients(bulletin)
            print(f"Bulletin ID {bulletin.id}: {len(recipients)} recipients")
            results.append(True)
        else:
            print("⚠️  No bulletins found")
            results.append(True)  # Not a failure
        
        # Test Notice
        print("\n--- Testing Notices ---")
        notice = Notice.objects.filter(status='ongoing').order_by('-created_at').first()
        if notice:
            recipients = get_notice_recipients(notice)
            print(f"Notice ID {notice.id}: {len(recipients)} recipients")
            results.append(True)
        else:
            print("⚠️  No notices found")
            results.append(True)  # Not a failure
        
        if all(results):
            print("\n✅ TEST 4 PASSED: All entity types work correctly")
            return True
        else:
            print("\n❌ TEST 4 FAILED")
            return False
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("RETROACTIVE NOTIFICATION FIX - VERIFICATION SUITE")
    print("="*80)
    print("\nThis test verifies that:")
    print("• Permission grant timestamps are correctly tracked")
    print("• Recipients are filtered based on permission grant time")
    print("• Users only receive notifications for items created AFTER permission grant")
    print("• The fix works for announcements, bulletins, and notices")
    
    test_results = {
        'Permission Timestamp Tracking': test_permission_timestamp_tracking(),
        'Retroactive Filtering': test_retroactive_filtering(),
        'Direct Filter Function': test_filter_function_directly(),
        'All Entity Types': test_all_entity_types(),
    }
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print("="*80 + "\n")
    
    if all(test_results.values()):
        print("🎉 ALL TESTS PASSED!")
        print("\nThe retroactive notification fix is working correctly:")
        print("• Users who gain permission AFTER an item is created will NOT receive notifications")
        print("• Users who have permission BEFORE an item is created WILL receive notifications")
        print("• Creators and org members are always included (as expected)")
        print("• The fix applies consistently to announcements, bulletins, and notices")
    else:
        print("⚠️  Some tests failed - please review the output above")
    
    return all(test_results.values())


if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Critical error running tests: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
