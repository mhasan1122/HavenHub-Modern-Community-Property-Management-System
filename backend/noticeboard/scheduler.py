"""
Scheduler for checking notice status changes and sending notifications
"""
import threading
import time
import logging
from django.utils import timezone
import datetime

logger = logging.getLogger(__name__)


class NoticeStatusScheduler:
    """
    Background scheduler that checks for notices moving from upcoming to ongoing
    """
    def __init__(self):
        self.running = False
        self.thread = None
        self.check_interval = 60  # Check every 60 seconds

    def start(self):
        """Start the scheduler in a background thread"""
        if self.running:
            logger.warning("Notice status scheduler is already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info("✅ Notice Status Scheduler started")

    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Notice Status Scheduler stopped")

    def _run(self):
        """Main scheduler loop"""
        while self.running:
            try:
                self._check_status_changes()
            except Exception as e:
                logger.error(f"Error in notice status scheduler: {e}", exc_info=True)
            
            # Sleep for the check interval
            time.sleep(self.check_interval)

    def _check_status_changes(self):
        """Check for notices that need status updates"""
        try:
            from noticeboard.models import Notice
            from notifications.utils import create_notice_posted_notification

            # Get all upcoming notices with prefetched relationships
            upcoming_notices = Notice.objects.filter(status='upcoming').prefetch_related('target_units', 'target_towers')
            
            if not upcoming_notices.exists():
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
                            logger.info(
                                f'Notice {notice.id} ({notice.internal_title[:50]}) '
                                f'changed from upcoming to ongoing'
                            )

                            # Send notifications
                            try:
                                # Re-fetch notice with relationships to ensure many-to-many relationships are loaded
                                notice_with_relations = Notice.objects.prefetch_related('target_towers', 'target_units').get(id=notice.id)
                                notifications = create_notice_posted_notification(notice_with_relations)
                                notification_count += len(notifications)
                                logger.info(f'Sent {len(notifications)} notifications for notice {notice.id}')
                            except Exception as e:
                                logger.error(f'Error sending notifications for notice {notice.id}: {e}')

            if updated_count > 0:
                logger.info(f'Updated {updated_count} notices, sent {notification_count} notifications')

        except Exception as e:
            logger.error(f"Error checking notice status changes: {e}", exc_info=True)


# Global scheduler instance
_scheduler = None


def get_scheduler():
    """Get or create the global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = NoticeStatusScheduler()
    return _scheduler


def start_notice_status_scheduler():
    """Start the notice status scheduler"""
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
    return scheduler
