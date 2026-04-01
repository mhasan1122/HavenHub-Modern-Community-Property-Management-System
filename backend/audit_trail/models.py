# models.py
from django.db import models
from user.models import Member  # adjust the import path

class AuditTrail(models.Model):
    EVENT_CHOICES = [
        ('MEMBER_CREATED','MEMBER CREATED'),
        ('MEMBER_UPDATED','MEMBER UPDATED'),
        ('MEMBER_STATUS_CHANGED','MEMBER STATUS CHANGED'),

        ('GROUP_CREATE', 'Group Created'),
        ('GROUP_UPDATE', 'Group Updated'),
        ('GROUP_STATUS_CHANGE', 'GROUP STATUS CHANGE'),
        
        ('ROLE_CREATED','ROLE CREATED'),
        ('ROLE_UPDATED','ROLE UPDATED'),
        ('ROLE_STATUS_CHANGED','ROLE STATUS CHANGED'),
        
        # Service Fee Payment Events
        ('PAYMENT_CREATED','PAYMENT CREATED'),
        ('PAYMENT_UPDATED','PAYMENT UPDATED'),
        ('PAYMENT_DELETED','PAYMENT DELETED'),
        ('PAYMENT_STATUS_CHANGED','PAYMENT STATUS CHANGED'),
        
        # Service Fee Events
        ('SERVICE_FEE_CREATED','SERVICE FEE CREATED'),
        ('SERVICE_FEE_UPDATED','SERVICE FEE UPDATED'),
        ('SERVICE_FEE_DELETED','SERVICE FEE DELETED'),
        ('SERVICE_FEE_STATUS_CHANGED','SERVICE FEE STATUS CHANGED'),
        ('SERVICE_FEE_CANCELLED','SERVICE FEE CANCELLED'),
        ('SERVICE_FEE_ACTIVATED','SERVICE FEE ACTIVATED'),
        ('SERVICE_FEE_DEACTIVATED','SERVICE FEE DEACTIVATED'),
        
        # Reminder Events
        ('REMINDER_CREATED','REMINDER CREATED'),
        ('REMINDER_UPDATED','REMINDER UPDATED'),
        ('REMINDER_DELETED','REMINDER DELETED'),
        ('REMINDER_STATUS_CHANGED','REMINDER STATUS CHANGED'),
        ('REMINDER_SENT','REMINDER SENT'),
        ('REMINDER_ACTIVATED','REMINDER ACTIVATED'),
        ('REMINDER_DEACTIVATED','REMINDER DEACTIVATED'),
        
        # Company Settings Events
        ('COMPANY_SETTINGS_UPDATED','COMPANY SETTINGS UPDATED'),
        ('COMPANY_IMAGE_UPLOADED','COMPANY IMAGE UPLOADED'),
        ('COMPANY_IMAGE_DELETED','COMPANY IMAGE DELETED'),
        
        # Bill Category Events
        ('BILL_CATEGORY_CREATED','BILL CATEGORY CREATED'),
        ('BILL_CATEGORY_UPDATED','BILL CATEGORY UPDATED'),
        ('BILL_CATEGORY_DELETED','BILL CATEGORY DELETED'),
        ('BILL_CATEGORY_STATUS_CHANGED','BILL CATEGORY STATUS CHANGED'),
    ]

    id = models.BigAutoField(primary_key=True)
    event_type = models.CharField(max_length=30, choices=EVENT_CHOICES)
    table_name = models.CharField(max_length=50)
    row_id = models.BigIntegerField()
    member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True)
    old_data = models.JSONField(null=True, blank=True)
    new_data = models.JSONField(null=True, blank=True)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.event_type} - {self.table_name} {self.row_id}"

