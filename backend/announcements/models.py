from django.db import models
from django.core.validators import FileExtensionValidator
from user.models import Member
from towers.models import Tower, Unit
import os

def upload_to_announcement_attachments(instance, filename):

    return os.path.join('announcements', f'{instance.announcement.id}_{instance.announcement.title[:20]}', filename)

class Announcement(models.Model):
   

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

    # Basic announcement information
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    # Author information
    creator = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='created_announcements')
    post_as = models.CharField(max_length=20, choices=POST_AS_CHOICES, default='creator')
    posted_group = models.ForeignKey('group_role.Group', on_delete=models.SET_NULL, null=True, blank=True, related_name='group_announcements')
    posted_member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='member_announcements')
    
    # Store names directly
    group_name = models.CharField(max_length=255, null=True, blank=True)
    member_name = models.CharField(max_length=255, null=True, blank=True)

    # Priority and label
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES)
    label = models.CharField(max_length=500, blank=True, null=True, default='')  # Custom text input - no predefined choices

    # Visibility timing
    start_date = models.DateField()
    start_time = models.TimeField()
    end_date = models.DateField()
    end_time = models.TimeField()

    # Status (calculated based on dates)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')

    # Audience - Many-to-many relationships
    target_towers = models.ManyToManyField(Tower, blank=True, related_name='announcements')
    target_units = models.ManyToManyField(Unit, blank=True, related_name='announcements')

    # Metadata
    views = models.IntegerField(default=0)
    is_pinned = models.BooleanField(default=False)
    manually_expired = models.BooleanField(default=False)  # For frontend compatibility

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='announcement_creator')
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='announcement_updater')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-is_pinned', '-created_at']),  # For list view ordering
            models.Index(fields=['status', '-created_at']),  # For status filtering
            models.Index(fields=['priority']),  # For priority filtering
            models.Index(fields=['start_date', 'end_date']),  # For date range queries
            models.Index(fields=['creator']),  # For creator filtering
        ]

    def __str__(self):
        return f"{self.title} - {self.creator.full_name}"

    def update_status(self):
        """
        Update announcement status based on current date/time
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
                # Clear manually_expired flag if the announcement has naturally expired
                if self.manually_expired and now > end_datetime:
                    self.manually_expired = False

        # Only save if status changed to avoid infinite recursion
        if old_status != self.status:
            super().save(update_fields=['status', 'manually_expired'])

    def save(self, *args, **kwargs):
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


class AnnouncementAttachment(models.Model):
    """
    Model for storing announcement attachments (images, PDFs, DOCs)
    """

    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(
        upload_to=upload_to_announcement_attachments,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf', 'doc', 'docx'])]
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)  # image/jpeg, application/pdf, etc.
    file_size = models.IntegerField()  # in bytes

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for {self.announcement.title}: {self.file_name}"


class AnnouncementHistory(models.Model):
    """
    Model for tracking announcement edit history
    """

    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='history')
    edited_by = models.ForeignKey(Member, on_delete=models.CASCADE)
    edited_at = models.DateTimeField(auto_now_add=True)

    # Store the changed fields as JSON
    changes = models.JSONField()  # Store what fields were changed

    def __str__(self):
        return f"Edit history for {self.announcement.title} by {self.edited_by.full_name}"
