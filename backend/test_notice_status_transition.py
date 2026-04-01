"""
Test script to verify notice notifications when status changes from upcoming to ongoing
"""
import os
import django
import datetime
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from noticeboard.models import Notice
from notifications.models import Notification, NotificationType
from user.models import Member
from towers.models import Tower, Unit


def test_notice_status_transition_notifications():
    """
    Test that notifications are sent when a notice transitions from upcoming to ongoing
    """
    print("=" * 80)
    print("Testing Notice Status Transition Notifications")
    print("=" * 80)
    
    # Get or create a test member
    try:
        member = Member.objects.filter(is_comm_member=True).first()
        if not member:
            print("❌ No community members found. Cannot test notifications.")
            return
        
        print(f"✅ Using test member: {member.full_name} (ID: {member.id})")
    except Exception as e:
        print(f"❌ Error finding member: {e}")
        return
    
    # Get test towers and units
    towers = Tower.objects.all()[:1]
    units = Unit.objects.all()[:2]
    
    if not towers.exists() or not units.exists():
        print("⚠️  Warning: No towers or units found for targeting")
    
    print("\n" + "-" * 80)
    print("Test 1: Creating an UPCOMING notice")
    print("-" * 80)
    
    # Create a notice with status 'upcoming' (start time in 5 seconds)
    now = datetime.datetime.now()
    start_time = now + datetime.timedelta(seconds=5)
    end_time = start_time + datetime.timedelta(hours=1)
    
    try:
        notice = Notice.objects.create(
            internal_title="Test Notice - Status Transition",
            creator=member,
            post_as='creator',
            priority='normal',
            label='Test',
            start_date=start_time.date(),
            start_time=start_time.time(),
            end_date=end_time.date(),
            end_time=end_time.time(),
            status='upcoming'
        )
        
        # Add target towers and units
        if towers.exists():
            notice.target_towers.add(*towers)
        if units.exists():
            notice.target_units.add(*units)
        
        print(f"✅ Created upcoming notice: {notice.id} - {notice.internal_title}")
        print(f"   Start: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Status: {notice.status}")
    except Exception as e:
        print(f"❌ Error creating notice: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Check for notifications (should be NONE for upcoming notices)
    notif_count = Notification.objects.filter(
        entity_type='notice',
        entity_id=notice.id,
        recipient=member
    ).count()
    
    if notif_count == 0:
        print(f"✅ PASS: No notifications created for upcoming notice (expected)")
    else:
        print(f"❌ FAIL: {notif_count} notifications found for upcoming notice (expected 0)")
    
    print("\n" + "-" * 80)
    print("Test 2: Transitioning notice from UPCOMING to ONGOING")
    print("-" * 80)
    
    # Wait for 6 seconds to let the start time pass
    print("⏳ Waiting 6 seconds for start time to pass...")
    import time
    time.sleep(6)
    
    # Manually trigger status update (simulating what the scheduler does)
    try:
        old_status = notice.status
        notice.update_status()
        notice.refresh_from_db()
        new_status = notice.status
        
        print(f"✅ Status updated: {old_status} → {new_status}")
        
        if new_status != 'ongoing':
            print(f"⚠️  Warning: Expected status to be 'ongoing', but got '{new_status}'")
    except Exception as e:
        print(f"❌ Error updating status: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Check for notifications (should be created now)
    time.sleep(1)  # Give a moment for notifications to be created
    
    notifications = Notification.objects.filter(
        entity_type='notice',
        entity_id=notice.id,
        recipient=member
    )
    
    notif_count = notifications.count()
    
    if notif_count > 0:
        print(f"✅ PASS: {notif_count} notification(s) created after transition to ongoing")
        for notif in notifications:
            print(f"   - Notification {notif.id}: {notif.title}")
            print(f"     Message: {notif.message}")
            print(f"     Created: {notif.created_at}")
    else:
        print(f"❌ FAIL: No notifications created after transition to ongoing")
    
    print("\n" + "-" * 80)
    print("Test 3: Creating a notice with ONGOING status directly")
    print("-" * 80)
    
    # Create a notice with status 'ongoing' (current time)
    now = datetime.datetime.now()
    start_time = now - datetime.timedelta(minutes=5)  # Started 5 minutes ago
    end_time = now + datetime.timedelta(hours=1)
    
    try:
        notice2 = Notice.objects.create(
            internal_title="Test Notice - Direct Ongoing",
            creator=member,
            post_as='creator',
            priority='high',
            label='Test',
            start_date=start_time.date(),
            start_time=start_time.time(),
            end_date=end_time.date(),
            end_time=end_time.time(),
            status='ongoing'
        )
        
        # Add target towers and units
        if towers.exists():
            notice2.target_towers.add(*towers)
        if units.exists():
            notice2.target_units.add(*units)
        
        print(f"✅ Created ongoing notice: {notice2.id} - {notice2.internal_title}")
        print(f"   Status: {notice2.status}")
        
        # Check for notifications
        time.sleep(1)
        
        notif_count2 = Notification.objects.filter(
            entity_type='notice',
            entity_id=notice2.id,
            recipient=member
        ).count()
        
        if notif_count2 > 0:
            print(f"✅ PASS: {notif_count2} notification(s) created for directly created ongoing notice")
        else:
            print(f"⚠️  Note: No notifications for directly created ongoing notice (depends on creation flow)")
        
    except Exception as e:
        print(f"❌ Error creating ongoing notice: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    
    # Get all notice-related notification types
    notice_notif_types = NotificationType.objects.filter(entity_type='notice')
    print(f"Notice notification types configured: {notice_notif_types.count()}")
    for nt in notice_notif_types:
        print(f"  - {nt.code}: {nt.name}")
    
    # Get total notice notifications
    total_notice_notifs = Notification.objects.filter(entity_type='notice')
    print(f"\nTotal notice notifications in system: {total_notice_notifs.count()}")
    
    print("\n✅ Test completed!")
    print("\nTo manually trigger the status checker, run:")
    print("  python manage.py check_notice_status_changes")


if __name__ == "__main__":
    test_notice_status_transition_notifications()
