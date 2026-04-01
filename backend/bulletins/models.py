from django.db import models
from django.core.validators import FileExtensionValidator
from user.models import Member
from towers.models import Tower, Unit
import os

def upload_to_bulletin_attachments(instance, filename):
    return os.path.join('bulletins', f'{instance.bulletin.id}_{instance.bulletin.title[:20]}', filename)

class Bulletin(models.Model):
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
        ('current', 'Current'),
        ('pending', 'Pending'),
        ('archive', 'Archive'),
    ]

    # Basic bulletin information
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    # Author information
    creator = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='created_bulletins')
    post_as = models.CharField(max_length=20, choices=POST_AS_CHOICES, default='creator')
    posted_group = models.ForeignKey('group_role.Group', on_delete=models.SET_NULL, null=True, blank=True, related_name='group_bulletins')
    posted_member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='member_bulletins')

    # Store names directly
    group_name = models.CharField(max_length=255, null=True, blank=True)
    member_name = models.CharField(max_length=255, null=True, blank=True)

    # Priority and label
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES)
    label = models.CharField(max_length=500, blank=False, null=True, default='')  # Custom text input - no predefined choices - REQUIRED

    # Status (manually set - no date-based logic)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    # Audience - Many-to-many relationships
    target_towers = models.ManyToManyField(Tower, blank=True, related_name='bulletins')
    target_units = models.ManyToManyField(Unit, blank=True, related_name='bulletins')

    # Metadata
    views = models.IntegerField(default=0)
    is_pinned = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='bulletin_creator')
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='bulletin_updater')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-is_pinned', '-created_at']),  # For list view ordering
            models.Index(fields=['status', '-created_at']),  # For status filtering
            models.Index(fields=['priority']),  # For priority filtering
            models.Index(fields=['creator']),  # For creator filtering
        ]

    def __str__(self):
        return f"{self.title} - {self.creator.full_name}"


class BulletinAttachment(models.Model):
    """
    Model for storing bulletin attachments (images, PDFs, DOCs)
    """
    bulletin = models.ForeignKey(Bulletin, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(
        upload_to=upload_to_bulletin_attachments,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf', 'doc', 'docx'])]
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)  # image/jpeg, application/pdf, etc.
    file_size = models.IntegerField()  # in bytes

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for {self.bulletin.title}: {self.file_name}"


class BulletinHistory(models.Model):
    """
    Model for tracking bulletin edit history with comments and approval workflow
    """
    bulletin = models.ForeignKey(Bulletin, on_delete=models.CASCADE, related_name='history')
    edited_by = models.ForeignKey(Member, on_delete=models.CASCADE)
    edited_at = models.DateTimeField(auto_now_add=True)

    # Store the changed fields as JSON
    changes = models.JSONField()  # Store what fields were changed

    # Comment and approval workflow
    comment = models.TextField(blank=True, null=True)
    action = models.CharField(max_length=20, choices=[
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('archived', 'Archived'),
        ('restored', 'Restored'),
    ], default='updated')

    def __str__(self):
        return f"Edit history for {self.bulletin.title} by {self.edited_by.full_name}"


class BulletinReport(models.Model):
    """
    Model for tracking reports submitted by community members about bulletin posts
    """
    REPORT_REASON_CHOICES = [
        ('spam', 'Spam or Advertising'),
        ('harassment', 'Harassment or Hate Speech'),
        ('pornographic', 'Pornographic or Explicit Content'),
        ('violence', 'Violence or Harmful Content'),
        ('illegal', 'Illegal Activity'),
        ('privacy', 'Privacy Violation'),
        ('false_info', 'False Information / Misinformation'),
        ('inappropriate', 'Inappropriate / Off-Topic'),
        ('other', 'Other'),
    ]

    bulletin = models.ForeignKey(Bulletin, on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='bulletin_reports')
    reason = models.CharField(max_length=20, choices=REPORT_REASON_CHOICES)
    details = models.TextField(blank=True, null=True, help_text="Optional additional details about the report")
    
    # Status tracking
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending Review'),
        ('reviewed', 'Reviewed'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ], default='pending')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['bulletin', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['reported_by']),
        ]

    def __str__(self):
        return f"Report on {self.bulletin.title} by {self.reported_by.full_name} - {self.get_reason_display()}"
