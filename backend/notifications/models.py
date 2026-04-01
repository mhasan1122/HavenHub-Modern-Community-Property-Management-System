from django.db import models
from django.core.validators import MinLengthValidator
from user.models import Member


class NotificationType(models.Model):
    """
    Master table for notification types - allows dynamic addition of new notification types
    Supports: announcements, bulletins, member creation, notices, and future types
    """
    # Entity types that can trigger notifications
    ENTITY_TYPES = [
        ('announcement', 'Announcement'),
        ('bulletin', 'Bulletin'),
        ('member', 'Member'),
        ('notice', 'Notice'),
        ('payment', 'Payment'),
        ('bill', 'Bill'),
        ('service_fee', 'Service Fee'),
        ('document', 'Document'),
        ('role', 'Role'),
        ('group', 'Group'),
        ('unit', 'Unit'),
        ('resident', 'Resident'),
        ('unit_staff', 'Unit Staff'),
        ('other', 'Other'),
    ]
    
    # Unique code for the notification type (e.g., 'announcement_published', 'bulletin_created')
    code = models.CharField(
        max_length=100,
        unique=True,
        validators=[MinLengthValidator(3)],
        help_text="Unique code for this notification type (e.g., 'announcement_published')"
    )
    
    # Display name
    name = models.CharField(
        max_length=255,
        help_text="Human-readable name (e.g., 'Announcement Published')"
    )
    
    # Description
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of when this notification is triggered"
    )
    
    # Entity type this notification relates to
    entity_type = models.CharField(
        max_length=50,
        choices=ENTITY_TYPES,
        help_text="Type of entity this notification relates to"
    )
    
    # Icon/emoji for display (optional)
    icon = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Icon or emoji for this notification type (e.g., '📢', '📋')"
    )
    
    # Whether this notification type is active
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this notification type is currently active"
    )
    
    # Priority level (for sorting/filtering)
    priority = models.IntegerField(
        default=0,
        help_text="Priority level (higher = more important)"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-priority', 'name']
        indexes = [
            models.Index(fields=['code'], name='notificatio_code_64d00e_idx'),
            models.Index(fields=['entity_type', 'is_active'], name='notificatio_entity__e6db54_idx'),
        ]
        verbose_name = "Notification Type"
        verbose_name_plural = "Notification Types"
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class Notification(models.Model):
    """
    Main notification model - stores all notifications for users
    Uses generic entity references to support multiple entity types dynamically
    """
    recipient = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="The member who receives this notification"
    )
    
    # Reference to notification type (instead of hardcoded choices)
    notification_type = models.ForeignKey(
        NotificationType,
        on_delete=models.PROTECT,
        related_name='notifications',
        help_text="Type of notification"
    )
    
    # Generic entity reference - supports announcements, bulletins, members, notices, etc.
    entity_type = models.CharField(
        max_length=50,
        help_text="Type of entity (e.g., 'announcement', 'bulletin', 'member')"
    )
    entity_id = models.IntegerField(
        help_text="ID of the related entity"
    )
    
    # Notification content
    title = models.CharField(
        max_length=255,
        help_text="Notification title"
    )
    message = models.TextField(
        help_text="Notification message"
    )
    
    # Read status
    is_read = models.BooleanField(
        default=False,
        help_text="Whether the notification has been read"
    )
    
    # Channel - where the notification is shown
    CHANNEL_CHOICES = [
        ('web', 'Web Only'),
        ('mobile', 'Mobile Only'),
        ('both', 'Both Web and Mobile'),
    ]
    channel = models.CharField(
        max_length=10,
        choices=CHANNEL_CHOICES,
        default='web',
        help_text="Channel where this notification should be displayed"
    )
    
    # Additional metadata (JSON field for flexibility)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata about the notification (e.g., extra context)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at'], name='notificatio_recipie_7c8f9a_idx'),
            models.Index(fields=['recipient', 'is_read'], name='notificatio_recipie_a1b2c3_idx'),
            models.Index(fields=['notification_type'], name='notificatio_notific_d6e074_idx'),
            models.Index(fields=['entity_type', 'entity_id'], name='notificatio_entity__950da6_idx'),
            models.Index(fields=['entity_type', 'entity_id', 'recipient'], name='notificatio_entity__08aa77_idx'),
        ]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
    
    def __str__(self):
        return f"{self.title} - {self.recipient.full_name}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        from django.utils import timezone
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
    
    @property
    def entity_reference(self):
        """Get a string reference to the entity"""
        return f"{self.entity_type}:{self.entity_id}"


class DeviceToken(models.Model):
    """
    Model to store push notification device tokens for mobile devices
    Supports both Expo Push Tokens and FCM (Firebase Cloud Messaging) tokens
    """
    TOKEN_TYPES = [
        ('expo', 'Expo Push Token'),
        ('fcm', 'FCM Token'),
    ]
    
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='device_tokens',
        help_text="The member who owns this device"
    )
    
    push_token = models.CharField(
        max_length=500,  # Increased from 255 to support longer FCM tokens
        help_text="Push notification token (Expo or FCM)"
    )
    
    token_type = models.CharField(
        max_length=10,
        choices=TOKEN_TYPES,
        default='expo',
        help_text="Type of push token (Expo or FCM)"
    )
    
    device_type = models.CharField(
        max_length=20,
        choices=[('ios', 'iOS'), ('android', 'Android'), ('web', 'Web')],
        help_text="Type of device"
    )
    
    device_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Device identifier/model name"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this device token is active"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['member', 'is_active']),
            models.Index(fields=['push_token']),
            models.Index(fields=['token_type', 'is_active']),
        ]
        # Removed unique_together to allow multiple registrations of the same token
        # (e.g., after cache clearing, user can re-register)
        verbose_name = "Device Token"
        verbose_name_plural = "Device Tokens"
    
    def __str__(self):
        return f"{self.member.full_name} - {self.device_type} ({self.token_type.upper()}: {self.push_token[:20]}...)"

