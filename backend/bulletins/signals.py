"""
Django signals for bulletins app
NOTE: Bulletin notifications are NOT sent on creation.
Instead, notifications are sent only when bulletins are approved or rejected,
and only to the specific user who created the bulletin.
See notifications/utils.py:
- create_bulletin_approved_notification()
- create_bulletin_rejected_notification()
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Bulletin
import logging

logger = logging.getLogger(__name__)


# Signal disabled - bulletins now only notify creator on approve/reject
# @receiver(post_save, sender=Bulletin)
# def send_bulletin_notifications(sender, instance, created, **kwargs):
#     """DISABLED: Bulletins no longer notify all users on creation"""
#     pass
