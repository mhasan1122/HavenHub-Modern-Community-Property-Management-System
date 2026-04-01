# Generated manually to preserve existing images

from django.db import migrations


def migrate_existing_images(apps, schema_editor):
    """
    Migrate existing logo and login_page_image to CompanyImage model
    This migration creates CompanyImage records but doesn't set them as active
    since the ForeignKey fields don't exist yet. They will be set in the next migration.
    """
    CompanySettings = apps.get_model('company_settings', 'CompanySettings')
    CompanyImage = apps.get_model('company_settings', 'CompanyImage')
    
    try:
        settings = CompanySettings.objects.first()
        if settings:
            # Migrate logo if it exists
            if settings.logo:
                CompanyImage.objects.create(
                    image_type='logo',
                    image=settings.logo
                )
            
            # Migrate login_page_image if it exists
            if settings.login_page_image:
                CompanyImage.objects.create(
                    image_type='login_image',
                    image=settings.login_page_image
                )
    except Exception as e:
        # If CompanyImage doesn't exist yet, skip this migration
        pass


def reverse_migrate_images(apps, schema_editor):
    """
    Reverse migration - not really needed since we're removing fields
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('company_settings', '0002_create_companyimage'),
    ]

    operations = [
        migrations.RunPython(migrate_existing_images, reverse_migrate_images),
    ]

