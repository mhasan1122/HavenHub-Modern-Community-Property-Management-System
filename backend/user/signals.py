"""
Signals for user app to handle member-related notifications
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Member


@receiver(post_save, sender=Member)
def notify_org_member_added(sender, instance, created, **kwargs):
    """
    Notify users with "View Member List" permission when a new organization member is added.
    
    IMPORTANT: Only users who have "View Member List" permission at the time the member is
    created will receive this notification. This is NOT retroactive - users who get the
    permission later will NOT see notifications for existing members.
    """
    try:
        # Only notify for new members, not updates
        if not created:
            return
        
        # Skip when member was created as part of add-owner flow (owner_added notification is sent instead)
        if getattr(instance, '_skip_org_member_notification', False):
            return
        
        # Only notify for organization members
        if not instance.is_org_member:
            return
        
        from notifications.utils import create_org_member_added_notification
        
        # Create notifications for all users with "View Member List" permission
        create_org_member_added_notification(instance)
        
    except Exception as e:
        print(f"[SIGNAL] Error in notify_org_member_added: {e}")
        import traceback
        traceback.print_exc()
