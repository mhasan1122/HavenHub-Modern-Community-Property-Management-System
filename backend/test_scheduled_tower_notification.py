"""
Test that scheduled announcements with tower targeting notify ALL admins
"""
import django
import os
import datetime
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from announcements.models import Announcement
from notifications.models import Notification
from notifications.utils import send_announcement_scheduled_notification
from user.models import Member
from towers.models import Tower

# Get a tower to target
tower = Tower.objects.first()
if not tower:
    print('❌ No tower found')
    exit(1)

# Get all admin users
admins = Member.objects.filter(is_org_member=True)
creator = admins.first()

if not creator:
    print('❌ No admin user found')
    exit(1)

print(f'✅ Found {admins.count()} admin users in the system')
print(f'📍 Using tower: {tower.tower_name} (ID: {tower.id})')

# Create a scheduled announcement targeting this tower
now = datetime.datetime.now()
start_time = (now + datetime.timedelta(hours=1)).time()  # Start 1 hour from now
end_time = (now + datetime.timedelta(hours=3)).time()  # End in 3 hours

announcement = Announcement.objects.create(
    title='Test Scheduled Tower Notification',
    description='Testing that all admins receive notification when tower is selected',
    start_date=now.date(),
    end_date=now.date(),
    start_time=start_time,
    end_time=end_time,
    status='upcoming',
    priority='normal',
    creator=creator,
    post_as='member',
    member_name=creator.full_name
)

# Add target tower (this is what the user does in the UI)
announcement.target_towers.add(tower)

print(f'\n✅ Created scheduled announcement: {announcement.title} (ID: {announcement.id})')
print(f'Status: {announcement.status}')
print(f'Target towers: {[t.tower_name for t in announcement.target_towers.all()]}')

# Call the scheduled notification function
print(f'\n⏳ Calling send_announcement_scheduled_notification...')
notifications = send_announcement_scheduled_notification(announcement)
print(f'\n📊 Result: {len(notifications)} admin notifications created')

# Check all admin notifications
admin_notifs = Notification.objects.filter(
    entity_type='announcement',
    entity_id=announcement.id,
    notification_type__code='admin_announcement_scheduled'
)

print(f'\n📋 Admin notifications in DB: {admin_notifs.count()}')
print(f'Total admins in system: {admins.count()}')

if admin_notifs.count() == admins.count():
    print(f'\n✅ SUCCESS: All {admins.count()} admins received the notification!')
else:
    print(f'\n⚠️  MISMATCH: Only {admin_notifs.count()} out of {admins.count()} admins received notifications')

print('\nNotification details:')
for n in admin_notifs[:5]:  # Show first 5
    print(f'  📢 Recipient: {n.recipient.full_name}')
    print(f'     Title: {n.title}')
    print(f'     Message: {n.message}')
    print()

print('✅ Test complete!')
