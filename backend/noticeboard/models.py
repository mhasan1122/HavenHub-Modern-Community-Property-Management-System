from django.db import models
from django.core.validators import FileExtensionValidator
from user.models import Member
from towers.models import Tower, Unit
import os

def upload_to_notice_attachments(instance, filename):
    return os.path.join('notices', f'{instance.notice.id}_{instance.notice.created_at.strftime("%Y%m%d")}', filename)

class Notice(models.Model):
    PRIORITY_CHOICES = [
        ('urgent', 'Urgent'),
        ('high', 'High'),
        ('normal', 'Normal'),
        ('low', 'Low'),
    ]

    POST_AS_CHOICES = [
        ('creator', 'Creator'),
        ('group', 'Group'),
        ('member', 'Member'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('upcoming', 'Upcoming'),
        ('ongoing', 'Ongoing'),
        ('expired', 'Expired'),
    ]

    # Notice content fields
    internal_title = models.CharField(max_length=255, blank=True)  # Auto-generated for admin purposes

    # Author information
    creator = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='created_notices')
    post_as = models.CharField(max_length=20, choices=POST_AS_CHOICES, default='creator')
    posted_group = models.ForeignKey('group_role.Group', on_delete=models.SET_NULL, null=True, blank=True, related_name='group_notices')
    posted_member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='member_notices')

    # Store names directly
    group_name = models.CharField(max_length=255, null=True, blank=True)
    member_name = models.CharField(max_length=255, null=True, blank=True)

    # Priority and label
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES)
    label = models.CharField(max_length=500, blank=True, null=True, default='')  # Custom text input

    # Visibility timing
    start_date = models.DateField()
    start_time = models.TimeField()
    end_date = models.DateField()
    end_time = models.TimeField()

    # Status (calculated based on dates)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')

    # Audience - Many-to-many relationships
    target_towers = models.ManyToManyField(Tower, blank=True, related_name='notices')
    target_units = models.ManyToManyField(Unit, blank=True, related_name='notices')

    # Metadata
    views = models.IntegerField(default=0)
    is_pinned = models.BooleanField(default=False)
    manually_expired = models.BooleanField(default=False)  # For frontend compatibility

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='notice_creator')
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='notice_updater')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-is_pinned', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['priority']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['creator']),
        ]

    def __str__(self):
        return f"Notice {self.id} - {self.creator.full_name} - {self.created_at.strftime('%Y-%m-%d')}"

    def save(self, *args, **kwargs):
        # Auto-generate internal title for admin purposes
        if not self.internal_title:
            self.internal_title = f"Notice {self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else 'New'}"

        # Auto-update status when saving
        if self.start_date and self.start_time and self.end_date and self.end_time:
            import datetime

            # Use timezone-naive datetime since USE_TZ = False in settings
            now = datetime.datetime.now()
            start_datetime = datetime.datetime.combine(self.start_date, self.start_time)
            end_datetime = datetime.datetime.combine(self.end_date, self.end_time)

            # If manually expired and the actual end time hasn't passed yet, keep it expired
            if self.manually_expired and now <= end_datetime:
                self.status = 'expired'
            else:
                # Otherwise, use normal date-based logic
                if now < start_datetime:
                    self.status = 'upcoming'
                elif start_datetime <= now <= end_datetime:
                    self.status = 'ongoing'
                else:
                    self.status = 'expired'

        super().save(*args, **kwargs)

    def update_status(self):
        """
        Update notice status based on current date/time
        """
        import datetime

        # Use timezone-naive datetime since USE_TZ = False in settings
        now = datetime.datetime.now()

        # Combine date and time for comparison
        start_datetime = datetime.datetime.combine(self.start_date, self.start_time)
        end_datetime = datetime.datetime.combine(self.end_date, self.end_time)

        old_status = self.status

        # If manually expired and the actual end time hasn't passed yet, keep it expired
        if self.manually_expired and now <= end_datetime:
            self.status = 'expired'
        else:
            # Otherwise, use normal date-based logic
            if now < start_datetime:
                self.status = 'upcoming'
            elif start_datetime <= now <= end_datetime:
                self.status = 'ongoing'
            else:
                self.status = 'expired'
                # Clear manually_expired flag if the notice has naturally expired
                if self.manually_expired and now > end_datetime:
                    self.manually_expired = False

        # Only save if status changed to avoid infinite recursion
        if old_status != self.status:
            super().save(update_fields=['status', 'manually_expired'])
            
            # Trigger notification if notice transitions from 'upcoming' to 'ongoing'
            if old_status == 'upcoming' and self.status == 'ongoing':
                try:
                    from notifications.utils import create_notice_posted_notification
                    # Re-fetch notice with relationships to ensure many-to-many relationships are loaded
                    notice_with_relations = Notice.objects.prefetch_related('target_towers', 'target_units').get(id=self.id)
                    create_notice_posted_notification(notice_with_relations)
                    print(f"[NOTIFICATION] Triggered notification for notice {self.id} transitioning from upcoming to ongoing")
                except Exception as e:
                    print(f"[NOTIFICATION] Error triggering notification for notice {self.id} on status transition: {e}")
                    import traceback
                    traceback.print_exc()


class NoticeAttachment(models.Model):
    """
    Model for storing notice attachments (images and PDFs)
    """

    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(
        upload_to=upload_to_notice_attachments,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf'])]
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)  # image/jpeg, image/png, etc.
    file_size = models.IntegerField()  # in bytes

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for Notice {self.notice.id}: {self.file_name}"


class NoticeHistory(models.Model):
    """
    Model for tracking notice edit history
    """

    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name='history')
    edited_by = models.ForeignKey(Member, on_delete=models.CASCADE)
    edited_at = models.DateTimeField(auto_now_add=True)

    # Store the changed fields as JSON
    changes = models.JSONField()  # Store what fields were changed

    def __str__(self):
        return f"Edit history for Notice {self.notice.id} by {self.edited_by.full_name}"
