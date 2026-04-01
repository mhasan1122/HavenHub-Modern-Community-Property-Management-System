import os
import django
import datetime

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from noticeboard.models import Notice
from notifications.models import Notification, NotificationType
from user.models import Member
from django.utils import timezone

def test_notice_notifications():
    print("Starting notification verification tests...")
    
    # 1. Get or create a recipient
    member = Member.objects.first()
    if not member:
        print("No member found for testing.")
        return
    
    print(f"Using member: {member.full_name} (ID: {member.id})")
    
    # 2. Test: Create UPCOMING notice
    print("\nTest 1: Creating UPCOMING notice...")
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    upcoming_notice = Notice.objects.create(
        internal_title="Test Upcoming Notice",
        creator=member,
        priority="normal",
        start_date=tomorrow,
        start_time=datetime.time(10, 0),
        end_date=tomorrow + datetime.timedelta(days=1),
        end_time=datetime.time(10, 0),
    )
    
    from notifications.utils import create_notice_posted_notification
    # Simulate view logic
    create_notice_posted_notification(upcoming_notice)
    
    # Check if notification exists
    notif_count = Notification.objects.filter(
        entity_type='notice',
        entity_id=upcoming_notice.id,
        recipient=member
    ).count()
    
    if notif_count == 0:
        print("PASS: No notification created for upcoming notice.")
    else:
        print(f"FAIL: {notif_count} notifications created for upcoming notice.")
    
    # 3. Test: Transition UPCOMING to ONGOING
    print("\nTest 2: Transitioning UPCOMING to ONGOING...")
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    upcoming_notice.start_date = yesterday
    upcoming_notice.update_status() # This should trigger notification
    
    notif_count = Notification.objects.filter(
        entity_type='notice',
        entity_id=upcoming_notice.id,
        recipient=member
    ).count()
    
    if notif_count > 0:
        print("PASS: Notification created after transition to ongoing.")
    else:
        print("FAIL: No notification created after transition to ongoing.")
    
    # 4. Test: Create ONGOING notice
    print("\nTest 3: Creating ONGOING notice...")
    ongoing_notice = Notice.objects.create(
        internal_title="Test Ongoing Notice",
        creator=member,
        priority="normal",
        start_date=yesterday,
        start_time=datetime.time(10, 0),
        end_date=tomorrow,
        end_time=datetime.time(10, 0),
    )
    
    # Simulate view logic
    create_notice_posted_notification(ongoing_notice)
    
    notif_count = Notification.objects.filter(
        entity_type='notice',
        entity_id=ongoing_notice.id,
        recipient=member
    ).count()
    
    if notif_count > 0:
        print("PASS: Notification created for ongoing notice.")
    else:
        print("FAIL: No notification created for ongoing notice.")
        
    print("\nCleaning up test notices...")
    upcoming_notice.delete()
    ongoing_notice.delete()
    # Note: Notifications are deleted via CASCADE or manually
    Notification.objects.filter(entity_type='notice', entity_id__in=[upcoming_notice.id, ongoing_notice.id]).delete()

if __name__ == "__main__":
    test_notice_notifications()
