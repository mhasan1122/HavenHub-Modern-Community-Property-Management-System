"""
Test script to verify the ongoing notification fix
"""
import django
import os
import datetime
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from announcements.models import Announcement
from notifications.models import Notification
from notifications.utils import send_announcement_ongoing_notification
from user.models import Member
from towers.models import Tower

# Get a tower to target
tower = Tower.objects.first()
creator = Member.objects.filter(is_org_member=True).first()

if not creator:
    print('❌ No admin user found')
    exit(1)

# Create a test announcement that should be ongoing
now = datetime.datetime.now()
start_time = (now - datetime.timedelta(minutes=5)).time()  # Started 5 minutes ago
end_time = (now + datetime.timedelta(hours=2)).time()  # Ends in 2 hours

announcement = Announcement.objects.create(
    title='Test Ongoing Notification Fix',
    description='Testing if the notification is created when transitioning to ongoing',
    start_date=now.date(),
    end_date=now.date(),
    start_time=start_time,
    end_time=end_time,
    status='upcoming',  # Will be recalculated on save
    priority='normal',
    creator=creator,
    post_as='member',
    member_name=creator.full_name
)

# Add target tower
announcement.target_towers.add(tower)

print(f'✅ Created announcement: {announcement.title} (ID: {announcement.id})')
print(f'Status after creation: {announcement.status}')
print(f'Start time: {announcement.start_date} {announcement.start_time}')
print(f'Current time: {now}')

# Call update_status to transition it
print('\n⏳ Calling update_status()...')
announcement.update_status()
announcement.refresh_from_db()
print(f'Status after update_status(): {announcement.status}')

if announcement.status == 'ongoing':
    print('\n✅ Status is ongoing! Now calling send_announcement_ongoing_notification...')
    notifications = send_announcement_ongoing_notification(announcement)
    print(f'\n📊 Result: {len(notifications)} notifications created')
    
    # Check the notifications in the database
    notifs = Notification.objects.filter(entity_type='announcement', entity_id=announcement.id)
    print(f'\n📋 Total notifications in DB: {notifs.count()}')
    for n in notifs:
        print(f'\n  📢 Notification #{n.id}')
        print(f'     Type: {n.notification_type.code}')
        print(f'     Title: {n.title}')
        print(f'     Message: {n.message}')
        print(f'     Recipient: {n.recipient.full_name}')
        
    # Check specifically for admin notifications
    admin_notifs = notifs.filter(notification_type__code='admin_announcement_ongoing')
    print(f'\n✅ Admin "ongoing" notifications: {admin_notifs.count()}')
    for n in admin_notifs:
        print(f'   - {n.title}')
        print(f'   - {n.message}')
else:
    print(f'\n⚠️  Status is still "{announcement.status}", not ongoing')
    print('The start time may not have passed yet due to timing')
    
print('\n✅ Test complete!')
