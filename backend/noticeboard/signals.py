"""
Django signals for noticeboard app
Automatically create notifications and send push notifications when notices are created
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notice
from notifications.models import Notification, NotificationType
from user.models import Member
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Notice)
def send_notice_notifications(sender, instance, created, **kwargs):
    """
    Send notifications and push notifications when a notice is created
    DISABLED: Notifications are now handled by the views to prevent duplicates
    """
    # Notifications are handled by the views using create_notice_posted_notification
    return
    
    try:
        # Get notification type for notices
        notif_type, _ = NotificationType.objects.get_or_create(
            code='notice_new',
            defaults={
                'name': 'New Notice',
                'description': 'Notification for new notice',
                'entity_type': 'notice'
            }
        )
        
        # Get all members who should receive this notice
        # TESTING: Include creator so they can test push notifications
        members = Member.objects.filter(is_org_member=True)  # Include creator
        
        logger.info(f"Creating notifications for notice #{instance.id} to {members.count()} members (including creator for testing)")
        
        # Create notifications for each member
        notifications_created = []
        creator_name = instance.creator.full_name if instance.creator else "Admin"
        
        for member in members:
            notification = Notification.objects.create(
                recipient=member,
                notification_type=notif_type,
                title=f"New notice published by: {creator_name}",
                message=f"Notice '{instance.internal_title}' has been published",
                entity_type='notice',
                entity_id=instance.id,
                channel='mobile',  # Mark as mobile-only notification for push
                metadata={
                    'notice_id': instance.id,
                    'notice_title': instance.internal_title,
                    'priority': instance.priority,
                    'creator': creator_name,
                    'should_send_push': True,
                },
                is_read=False
            )
            notifications_created.append(notification)
        
        logger.info(f"Created {len(notifications_created)} notifications for notice #{instance.id}")
        
        # Send push notifications
        if notifications_created:
            from notifications.push_service import send_push_for_notifications
            result = send_push_for_notifications(notifications_created)
            logger.info(f"Push notification result: {result}")
            
    except Exception as e:
        logger.error(f"Error sending notice notifications: {str(e)}")
