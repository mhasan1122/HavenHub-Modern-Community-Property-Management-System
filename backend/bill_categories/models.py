from django.db import models
from django.core.validators import RegexValidator


class BillCategory(models.Model):
    """
    Model for managing different types of bill categories (Electricity, Gas, Water, etc.)
    Used in service fee management to categorize various utility charges.
    """
    
    ICON_CHOICES = [
        ('zap', 'Electricity'),
        ('flame', 'Gas'),
        ('droplet', 'Water'),
        ('wifi', 'Internet'),
        ('trash', 'Waste'),
    ]
    
    COLOR_CHOICES = [
        ('orange', 'Orange'),
        ('red', 'Red'),
        ('blue', 'Blue'),
        ('purple', 'Purple'),
        ('green', 'Green'),
        ('teal', 'Teal'),
    ]
    
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Name of the bill category (e.g., Electricity, Gas, Water)"
    )
    
    description = models.TextField(
        blank=True,
        help_text="Brief description of this bill category"
    )
    
    icon = models.CharField(
        max_length=20,
        choices=ICON_CHOICES,
        default='zap',
        help_text="Icon representing this category"
    )
    
    color = models.CharField(
        max_length=20,
        choices=COLOR_CHOICES,
        default='teal',
        help_text="Color theme for this category"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this category is currently active"
    )
    
    default_account_head = models.ForeignKey(
        'accounts.DefaultAccountHead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bill_categories',
        help_text="Default accounting head for this category's revenue"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when this category was created"
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Date and time when this category was last updated"
    )
    
    class Meta:
        db_table = 'bill_category'
        verbose_name = 'Bill Category'
        verbose_name_plural = 'Bill Categories'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active'], name='bill_cat_active_idx'),
            models.Index(fields=['created_at'], name='bill_cat_created_idx'),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_color_display()})"
    
    def save(self, *args, **kwargs):
        # Capitalize first letter of name
        if self.name:
            self.name = self.name.strip()
        super().save(*args, **kwargs)
