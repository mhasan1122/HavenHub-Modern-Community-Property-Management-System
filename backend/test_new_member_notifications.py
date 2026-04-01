"""
Test script for new member notification logic

This script verifies that new members only receive notifications for 
announcements, bulletins, and notices created AFTER they join (non-retroactive).

Usage:
    python manage.py shell < test_new_member_notifications.py
    or
    python manage.py shell
    >>> exec(open('test_new_member_notifications.py').read())
"""

from django.utils import timezone
from datetime import timedelta
from user.models import Member
from notifications.models import Notification
from bulletins.models import Bulletin
from announcements.models import Announcement
from noticeboard.models import Notice
from notifications.utils import handle_new_member_notifications

def test_new_member_notifications():
    """
    Test that new members only receive notifications for entities created after they join
    """
    print("\n" + "="*80)
    print("TESTING NEW MEMBER NON-RETROACTIVE NOTIFICATION LOGIC")
    print("="*80 + "\n")
    
    # Find a recently created member to test with
    recent_member = Member.objects.order_by('-created_at').first()
    
    if not recent_member:
        print("❌ No members found in database")
        return
    
    print(f"📋 Testing with member: {recent_member.full_name} (ID: {recent_member.id})")
    print(f"📅 Member created at: {recent_member.created_at}")
    print(f"🔑 Member permissions: {recent_member.get_permission_ids()}")
    print()
    
    # Get notifications for this member
    notifications = Notification.objects.filter(recipient=recent_member)
    
    # Group by entity type
    bulletin_notifications = notifications.filter(entity_type='bulletin')
    announcement_notifications = notifications.filter(entity_type='announcement')
    notice_notifications = notifications.filter(entity_type='notice')
    
    print(f"📬 Total notifications: {notifications.count()}")
    print(f"   - Bulletins: {bulletin_notifications.count()}")
    print(f"   - Announcements: {announcement_notifications.count()}")
    print(f"   - Notices: {notice_notifications.count()}")
    print()
    
    # Verify non-retroactive logic for bulletins
    print("="*80)
    print("BULLETIN NOTIFICATIONS - Checking Non-Retroactive Logic")
    print("="*80)
    retroactive_bulletins = 0
    correct_bulletins = 0
    
    for notif in bulletin_notifications:
        try:
            bulletin = Bulletin.objects.get(id=notif.entity_id)
            if bulletin.created_at <= recent_member.created_at:
                retroactive_bulletins += 1
                print(f"❌ RETROACTIVE: Bulletin {bulletin.id} ('{bulletin.title[:50]}...')")
                print(f"   Created: {bulletin.created_at} | Member joined: {recent_member.created_at}")
            else:
                correct_bulletins += 1
                print(f"✅ CORRECT: Bulletin {bulletin.id} ('{bulletin.title[:50]}...')")
                print(f"   Created: {bulletin.created_at} | Member joined: {recent_member.created_at}")
        except Bulletin.DoesNotExist:
            print(f"⚠️  Bulletin {notif.entity_id} not found (may have been deleted)")
    
    if bulletin_notifications.count() > 0:
        print(f"\n📊 Bulletin Results: {correct_bulletins} correct, {retroactive_bulletins} retroactive")
        if retroactive_bulletins == 0:
            print("✅ All bulletin notifications are NON-RETROACTIVE")
        else:
            print(f"❌ Found {retroactive_bulletins} retroactive bulletin notifications!")
    else:
        print("ℹ️  No bulletin notifications found for this member")
    print()
    
    # Verify non-retroactive logic for announcements
    print("="*80)
    print("ANNOUNCEMENT NOTIFICATIONS - Checking Non-Retroactive Logic")
    print("="*80)
    retroactive_announcements = 0
    correct_announcements = 0
    
    for notif in announcement_notifications:
        try:
            announcement = Announcement.objects.get(id=notif.entity_id)
            if announcement.created_at <= recent_member.created_at:
                retroactive_announcements += 1
                print(f"❌ RETROACTIVE: Announcement {announcement.id} ('{announcement.title[:50]}...')")
                print(f"   Created: {announcement.created_at} | Member joined: {recent_member.created_at}")
            else:
                correct_announcements += 1
                print(f"✅ CORRECT: Announcement {announcement.id} ('{announcement.title[:50]}...')")
                print(f"   Created: {announcement.created_at} | Member joined: {recent_member.created_at}")
        except Announcement.DoesNotExist:
            print(f"⚠️  Announcement {notif.entity_id} not found (may have been deleted)")
    
    if announcement_notifications.count() > 0:
        print(f"\n📊 Announcement Results: {correct_announcements} correct, {retroactive_announcements} retroactive")
        if retroactive_announcements == 0:
            print("✅ All announcement notifications are NON-RETROACTIVE")
        else:
            print(f"❌ Found {retroactive_announcements} retroactive announcement notifications!")
    else:
        print("ℹ️  No announcement notifications found for this member")
    print()
    
    # Verify non-retroactive logic for notices
    print("="*80)
    print("NOTICE NOTIFICATIONS - Checking Non-Retroactive Logic")
    print("="*80)
    retroactive_notices = 0
    correct_notices = 0
    
    for notif in notice_notifications:
        try:
            notice = Notice.objects.get(id=notif.entity_id)
            if notice.created_at <= recent_member.created_at:
                retroactive_notices += 1
                print(f"❌ RETROACTIVE: Notice {notice.id} ('{notice.internal_title[:50]}...')")
                print(f"   Created: {notice.created_at} | Member joined: {recent_member.created_at}")
            else:
                correct_notices += 1
                print(f"✅ CORRECT: Notice {notice.id} ('{notice.internal_title[:50]}...')")
                print(f"   Created: {notice.created_at} | Member joined: {recent_member.created_at}")
        except Notice.DoesNotExist:
            print(f"⚠️  Notice {notif.entity_id} not found (may have been deleted)")
    
    if notice_notifications.count() > 0:
        print(f"\n📊 Notice Results: {correct_notices} correct, {retroactive_notices} retroactive")
        if retroactive_notices == 0:
            print("✅ All notice notifications are NON-RETROACTIVE")
        else:
            print(f"❌ Found {retroactive_notices} retroactive notice notifications!")
    else:
        print("ℹ️  No notice notifications found for this member")
    print()
    
    # Final summary
    print("="*80)
    print("FINAL SUMMARY")
    print("="*80)
    total_retroactive = retroactive_bulletins + retroactive_announcements + retroactive_notices
    total_correct = correct_bulletins + correct_announcements + correct_notices
    
    print(f"Total notifications checked: {total_correct + total_retroactive}")
    print(f"✅ Non-retroactive (correct): {total_correct}")
    print(f"❌ Retroactive (incorrect): {total_retroactive}")
    print()
    
    if total_retroactive == 0:
        print("🎉 SUCCESS! All notifications follow the non-retroactive rule!")
        print("   New members only receive notifications for content created after they joined.")
    else:
        print("⚠️  WARNING! Some retroactive notifications found.")
        print("   This may indicate an issue with the notification logic.")
    print()


def test_manual_trigger():
    """
    Manually trigger notification creation for a member to test the logic
    """
    print("\n" + "="*80)
    print("MANUAL TRIGGER TEST - handle_new_member_notifications()")
    print("="*80 + "\n")
    
    recent_member = Member.objects.order_by('-created_at').first()
    
    if not recent_member:
        print("❌ No members found in database")
        return
    
    print(f"📋 Testing with member: {recent_member.full_name} (ID: {recent_member.id})")
    print(f"📅 Member created at: {recent_member.created_at}")
    print()
    
    # Count notifications before
    notifications_before = Notification.objects.filter(recipient=recent_member).count()
    print(f"📬 Notifications before: {notifications_before}")
    print()
    
    # Trigger the function
    print("🔄 Calling handle_new_member_notifications()...")
    result = handle_new_member_notifications(recent_member)
    print()
    
    # Count notifications after
    notifications_after = Notification.objects.filter(recipient=recent_member).count()
    print(f"📬 Notifications after: {notifications_after}")
    print()
    
    print("📊 Results from function:")
    print(f"   - Bulletins: {result['bulletins']}")
    print(f"   - Announcements: {result['announcements']}")
    print(f"   - Notices: {result['notices']}")
    print(f"   - Total: {sum(result.values())}")
    print()
    
    if notifications_after == notifications_before:
        print("ℹ️  No new notifications created (expected if all notifications already exist)")
    else:
        print(f"✅ Created {notifications_after - notifications_before} new notifications")


def show_statistics():
    """
    Show statistics about members and notifications
    """
    print("\n" + "="*80)
    print("DATABASE STATISTICS")
    print("="*80 + "\n")
    
    total_members = Member.objects.count()
    members_with_notifications = Notification.objects.values('recipient').distinct().count()
    
    print(f"👥 Total members: {total_members}")
    print(f"📬 Members with notifications: {members_with_notifications}")
    print()
    
    total_bulletins = Bulletin.objects.count()
    current_bulletins = Bulletin.objects.filter(status='current').count()
    
    print(f"📋 Total bulletins: {total_bulletins}")
    print(f"📋 Current bulletins: {current_bulletins}")
    print()
    
    total_announcements = Announcement.objects.count()
    ongoing_announcements = Announcement.objects.filter(status='ongoing').count()
    
    print(f"📢 Total announcements: {total_announcements}")
    print(f"📢 Ongoing announcements: {ongoing_announcements}")
    print()
    
    total_notices = Notice.objects.count()
    ongoing_notices = Notice.objects.filter(status='ongoing').count()
    
    print(f"📌 Total notices: {total_notices}")
    print(f"📌 Ongoing notices: {ongoing_notices}")
    print()
    
    total_notifications = Notification.objects.count()
    bulletin_notifications = Notification.objects.filter(entity_type='bulletin').count()
    announcement_notifications = Notification.objects.filter(entity_type='announcement').count()
    notice_notifications = Notification.objects.filter(entity_type='notice').count()
    
    print(f"📬 Total notifications: {total_notifications}")
    print(f"   - Bulletins: {bulletin_notifications}")
    print(f"   - Announcements: {announcement_notifications}")
    print(f"   - Notices: {notice_notifications}")
    print(f"   - Other: {total_notifications - bulletin_notifications - announcement_notifications - notice_notifications}")
    print()


# Run all tests
if __name__ == "__main__":
    show_statistics()
    test_new_member_notifications()
    # Uncomment to test manual trigger:
    # test_manual_trigger()

# If running in Django shell, you can call individual functions:
# >>> show_statistics()
# >>> test_new_member_notifications()
# >>> test_manual_trigger()

