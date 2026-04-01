"""
Django signals for announcements app
Automatically create notifications and send push notifications when announcements are created
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Announcement
from notifications.models import Notification, NotificationType
from user.models import Member
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Announcement, dispatch_uid="announcement_notifications_signal")
def send_announcement_notifications(sender, instance, created, **kwargs):
    """
    Send notifications and push notifications when an announcement is created or published
    
    DISABLED: Notifications are now handled by the views (AnnouncementListCreateView and AnnouncementDetailView)
    to ensure M2M relationships (target_towers, target_units) are saved BEFORE sending notifications.
    The post_save signal fires before M2M relations are saved, causing targeted announcements to be treated as Global.
    """
    return
    
    # Logic below is preserved for reference but disabled
    if not created:
        # Only send notifications when first created
        return
    
    try:
        # Check announcement status - only send notifications for 'ongoing' announcements
        if instance.status != 'ongoing':
            logger.info(f"Announcement #{instance.id} has status '{instance.status}' - skipping immediate notification. Scheduler will handle when it becomes 'ongoing'.")
            return
        
        # Import the proper notification function
        from notifications.utils import send_announcement_published_notification
        
        logger.info(f"Announcement #{instance.id} is 'ongoing' - sending notifications now")
        
        # Use the unified notification system
        notifications = send_announcement_published_notification(instance)
        
        logger.info(f"Created {len(notifications)} notifications for announcement #{instance.id}")
            
    except Exception as e:
        logger.error(f"Error sending announcement notifications: {str(e)}")
