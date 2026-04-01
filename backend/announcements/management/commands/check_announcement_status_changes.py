from django.core.management.base import BaseCommand
from django.utils import timezone
from announcements.models import Announcement
from notifications.utils import send_announcement_ongoing_notification
import datetime


class Command(BaseCommand):
    help = 'Check for announcements that moved from upcoming to ongoing and send notifications'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Checking for announcement status changes...'))
        
        # Get all upcoming announcements with prefetched relationships
        upcoming_announcements = Announcement.objects.filter(status='upcoming').prefetch_related('target_units', 'target_towers')
        
        if not upcoming_announcements.exists():
            self.stdout.write('No upcoming announcements found.')
            return
        
        now = datetime.datetime.now()
        updated_count = 0
        notification_count = 0
        
        for announcement in upcoming_announcements:
            # Check if announcement should be ongoing now
            if announcement.start_date and announcement.start_time:
                start_datetime = datetime.datetime.combine(
                    announcement.start_date,
                    announcement.start_time
                )
                
                # If start time has passed, update status
                if now >= start_datetime:
                    old_status = announcement.status
                    announcement.update_status()
                    
                    if announcement.status == 'ongoing' and old_status == 'upcoming':
                        updated_count += 1
                        self.stdout.write(
                            f'Announcement {announcement.id} ({announcement.title[:50]}) '
                            f'changed from upcoming to ongoing'
                        )
                        
                        # Send notifications
                        try:
                            notifications = send_announcement_ongoing_notification(announcement)
                            notification_count += len(notifications)
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'  → Sent {len(notifications)} notifications'
                                )
                            )
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(f'  → Error sending notifications: {e}')
                            )
        
        self.stdout.write('-' * 80)
        self.stdout.write(f'Summary:')
        self.stdout.write(f'  Status changes: {updated_count}')
        self.stdout.write(f'  Notifications sent: {notification_count}')
        
        if updated_count == 0:
            self.stdout.write(self.style.WARNING('No status changes detected.'))
