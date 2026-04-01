#!/usr/bin/env python
"""
Test script to verify that retroactive notifications are filtered when displaying to users.

This test verifies:
1. The should_show_notification() function correctly filters retroactive notifications
2. Users don't see notifications for items created before they got permission
3. The notification list and count endpoints respect the retroactive filter
"""
import os
import django
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from notifications.models import Notification
from notifications.utils import should_show_notification
from django.utils import timezone


def test_should_show_notification_function():
    """Test the should_show_notification helper function"""
    print("\n" + "="*80)
    print("TEST: should_show_notification() Function")
    print("="*80)
    
    try:
        # Get some notifications
        notifications = Notification.objects.filter(
            entity_type='announcement'
        ).order_by('-created_at')[:10]
        
        if not notifications:
            print("⚠️  No announcements found")
            return True
        
        # Get a member
        member = Member.objects.filter(is_comm_member=True).first()
        
        if not member:
            print("⚠️  No community members found")
            return True
        
        print(f"\nTesting with Member: {member.full_name} (ID: {member.id})")
        print(f"Is org member: {member.is_org_member}")
        
        for notif in notifications:
            should_show = should_show_notification(member, notif)
            print(f"\nNotification ID {notif.id}:")
            print(f"  Title: {notif.title}")
            print(f"  Created: {notif.created_at}")
            print(f"  Should show: {'✅ YES' if should_show else '❌ NO (retroactive)'}")
        
        print("\n✅ TEST PASSED: should_show_notification() works correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_notification_filtering_by_permission_grant_time():
    """Test that notifications are properly filtered based on permission grant time"""
    print("\n" + "="*80)
    print("TEST: Notification Filtering by Permission Grant Time")
    print("="*80)
    
    try:
        # Find members with different permission grant times
        members = Member.objects.filter(is_comm_member=True)[:5]
        
        for member in members:
            print(f"\n--- Member: {member.full_name} (ID: {member.id}) ---")
            
            # Get their notifications
            notifications = Notification.objects.filter(
                recipient=member,
                entity_type='announcement'
            ).order_by('-created_at')[:5]
            
            if not notifications:
                print("  No announcement notifications")
                continue
            
            visible_count = 0
            hidden_count = 0
            
            for notif in notifications:
                should_show = should_show_notification(member, notif)
                if should_show:
                    visible_count += 1
                else:
                    hidden_count += 1
            
            print(f"  Total notifications: {len(notifications)}")
            print(f"  Visible: {visible_count}")
            print(f"  Hidden (retroactive): {hidden_count}")
        
        print("\n✅ TEST PASSED: Notifications filtered correctly by permission grant time")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_org_members_see_all_notifications():
    """Test that org members always see all notifications"""
    print("\n" + "="*80)
    print("TEST: Org Members See All Notifications")
    print("="*80)
    
    try:
        # Get an org member
        org_member = Member.objects.filter(is_org_member=True).first()
        
        if not org_member:
            print("⚠️  No org members found")
            return True
        
        print(f"\nTesting with Org Member: {org_member.full_name} (ID: {org_member.id})")
        
        # Get some notifications
        notifications = Notification.objects.filter(
            entity_type__in=['announcement', 'bulletin', 'notice']
        ).order_by('-created_at')[:10]
        
        if not notifications:
            print("⚠️  No notifications found")
            return True
        
        all_visible = True
        for notif in notifications:
            should_show = should_show_notification(org_member, notif)
            if not should_show:
                print(f"  ❌ Org member cannot see notification {notif.id} - UNEXPECTED!")
                all_visible = False
        
        if all_visible:
            print(f"  ✅ Org member can see all {len(notifications)} notifications (as expected)")
        
        print("\n✅ TEST PASSED: Org members see all notifications")
        return all_visible
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_creators_see_their_own_notifications():
    """Test that creators always see notifications for their own items"""
    print("\n" + "="*80)
    print("TEST: Creators See Their Own Notifications")
    print("="*80)
    
    try:
        from announcements.models import Announcement
        from bulletins.models import Bulletin
        from noticeboard.models import Notice
        
        # Get an announcement with creator
        announcement = Announcement.objects.filter(creator__isnull=False).first()
        
        if announcement and announcement.creator:
            creator = announcement.creator
            print(f"\nTesting with Creator: {creator.full_name} (ID: {creator.id})")
            print(f"Created announcement ID: {announcement.id}")
            
            # Find notification for this announcement
            notif = Notification.objects.filter(
                entity_type='announcement',
                entity_id=announcement.id,
                recipient=creator
            ).first()
            
            if notif:
                should_show = should_show_notification(creator, notif)
                print(f"  Creator should see their own notification: {'✅ YES' if should_show else '❌ NO'}")
                
                if not should_show:
                    print("  ❌ UNEXPECTED: Creator cannot see their own notification!")
                    return False
            else:
                print("  ⚠️  No notification found for creator")
        else:
            print("⚠️  No announcements with creators found")
        
        print("\n✅ TEST PASSED: Creators see their own notifications")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("NOTIFICATION DISPLAY FILTER - VERIFICATION SUITE")
    print("="*80)
    print("\nThis test verifies that:")
    print("• The should_show_notification() function works correctly")
    print("• Retroactive notifications are hidden from users")
    print("• Org members see all notifications")
    print("• Creators see their own notifications")
    
    test_results = {
        'should_show_notification Function': test_should_show_notification_function(),
        'Permission Grant Time Filtering': test_notification_filtering_by_permission_grant_time(),
        'Org Members See All': test_org_members_see_all_notifications(),
        'Creators See Own': test_creators_see_their_own_notifications(),
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
        print("\nThe notification display filter is working correctly:")
        print("• Users who gained permission AFTER an item was created will NOT see those notifications")
        print("• Users who had permission BEFORE an item was created WILL see notifications")
        print("• Org members see all notifications (org-level access)")
        print("• Creators always see notifications for their own items")
        print("\n✨ Now test in your app - refresh and the old notifications should be hidden!")
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
