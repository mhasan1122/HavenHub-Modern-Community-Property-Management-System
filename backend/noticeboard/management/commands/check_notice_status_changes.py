from django.core.management.base import BaseCommand
from noticeboard.models import Notice
from notifications.utils import create_notice_posted_notification
import datetime


class Command(BaseCommand):
    help = 'Check for notices that moved from upcoming to ongoing and send notifications'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Checking for notice status changes...'))
        
        # Get all upcoming notices with prefetched relationships
        upcoming_notices = Notice.objects.filter(status='upcoming').prefetch_related('target_units', 'target_towers')
        
        if not upcoming_notices.exists():
            self.stdout.write('No upcoming notices found.')
            return
        
        now = datetime.datetime.now()
        updated_count = 0
        notification_count = 0
        
        for notice in upcoming_notices:
            # Check if notice should be ongoing now
            if notice.start_date and notice.start_time:
                start_datetime = datetime.datetime.combine(
                    notice.start_date,
                    notice.start_time
                )
                
                # If start time has passed, update status
                if now >= start_datetime:
                    old_status = notice.status
                    notice.update_status()
                    
                    if notice.status == 'ongoing' and old_status == 'upcoming':
                        updated_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'Notice {notice.id} ({notice.internal_title[:50]}) '
                                f'changed from upcoming to ongoing'
                            )
                        )
                        
                        # Send notifications
                        try:
                            # Re-fetch notice with relationships to ensure many-to-many relationships are loaded
                            notice_with_relations = Notice.objects.prefetch_related('target_towers', 'target_units').get(id=notice.id)
                            notifications = create_notice_posted_notification(notice_with_relations)
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
        else:
            self.stdout.write(self.style.SUCCESS('✅ Notice status changes processed successfully!'))
