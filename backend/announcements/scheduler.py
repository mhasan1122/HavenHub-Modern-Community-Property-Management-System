"""
Scheduler for checking announcement status changes and sending notifications
"""
import threading
import time
import logging
from django.utils import timezone
import datetime

logger = logging.getLogger(__name__)


class AnnouncementStatusScheduler:
    """
    Background scheduler that checks for announcements moving from upcoming to ongoing
    """
    def __init__(self):
        self.running = False
        self.thread = None
        self.check_interval = 60  # Check every 60 seconds

    def start(self):
        """Start the scheduler in a background thread"""
        if self.running:
            logger.warning("Announcement status scheduler is already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info("✅ Announcement Status Scheduler started")

    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Announcement Status Scheduler stopped")

    def _run(self):
        """Main scheduler loop"""
        while self.running:
            try:
                self._check_status_changes()
            except Exception as e:
                logger.error(f"Error in announcement status scheduler: {e}", exc_info=True)
            
            # Sleep for the check interval
            time.sleep(self.check_interval)

    def _check_status_changes(self):
        """Check for announcements that need status updates"""
        try:
            from announcements.models import Announcement
            from notifications.utils import send_announcement_ongoing_notification

            # Get all upcoming announcements with prefetched relationships
            upcoming_announcements = Announcement.objects.filter(status='upcoming').prefetch_related('target_units', 'target_towers')
            
            if not upcoming_announcements.exists():
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
                            logger.info(
                                f'Announcement {announcement.id} ({announcement.title[:50]}) '
                                f'changed from upcoming to ongoing'
                            )

                            # Send notifications
                            try:
                                notifications = send_announcement_ongoing_notification(announcement)
                                notification_count += len(notifications)
                                logger.info(f'Sent {len(notifications)} notifications for announcement {announcement.id}')
                            except Exception as e:
                                logger.error(f'Error sending notifications for announcement {announcement.id}: {e}')

            if updated_count > 0:
                logger.info(f'Updated {updated_count} announcements, sent {notification_count} notifications')

        except Exception as e:
            logger.error(f"Error checking announcement status changes: {e}", exc_info=True)


# Global scheduler instance
_scheduler = None


def get_scheduler():
    """Get or create the global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = AnnouncementStatusScheduler()
    return _scheduler


def start_announcement_status_scheduler():
    """Start the announcement status scheduler"""
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
    return scheduler
