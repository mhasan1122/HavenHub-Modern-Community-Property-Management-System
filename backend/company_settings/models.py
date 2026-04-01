from django.db import models
from django.core.validators import FileExtensionValidator
import os


def upload_to_company_logo(instance, filename):
    """Generate path for company logo"""
    return os.path.join('company_settings', 'logo', filename)


def upload_to_login_image(instance, filename):
    """Generate path for login page image"""
    return os.path.join('company_settings', 'login_image', filename)


def upload_to_company_image(instance, filename):
    """Generate path for company images based on image type"""
    return os.path.join('company_settings', instance.image_type, filename)


class CompanySettings(models.Model):
    """
    Singleton model for company-wide settings.
    Only one instance should exist.
    """
    company_name = models.CharField(max_length=255, blank=True, default="")
    company_phone = models.CharField(max_length=20, blank=True, null=True)
    company_email = models.EmailField(blank=True, null=True)
    company_address = models.TextField(blank=True, null=True)
    
    # Active images (references to CompanyImage)
    active_logo = models.ForeignKey(
        'CompanyImage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_logo_settings',
        limit_choices_to={'image_type': 'logo'}
    )
    active_login_image = models.ForeignKey(
        'CompanyImage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_login_image_settings',
        limit_choices_to={'image_type': 'login_image'}
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company Settings"
        verbose_name_plural = "Company Settings"

    def __str__(self):
        return f"Company Settings - {self.company_name}"

    def save(self, *args, **kwargs):
        # Ensure only one instance exists
        if not self.pk and CompanySettings.objects.exists():
            # If an instance already exists, update it instead of creating a new one
            existing = CompanySettings.objects.first()
            self.pk = existing.pk
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Get or create the singleton instance"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class CompanyImage(models.Model):
    """
    Model to store company images (logos and login page images)
    """
    IMAGE_TYPE_CHOICES = [
        ('logo', 'Logo'),
        ('login_image', 'Login Page Image'),
    ]
    
    image_type = models.CharField(max_length=20, choices=IMAGE_TYPE_CHOICES)
    image = models.ImageField(
        upload_to=upload_to_company_image,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'svg', 'webp'])]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company Image"
        verbose_name_plural = "Company Images"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_image_type_display()} - {self.image.name}"

