# Generated manually to set initial active images

from django.db import migrations


def set_initial_active_images(apps, schema_editor):
    """
    Set the first logo and login_image as active after ForeignKey fields are added
    """
    CompanySettings = apps.get_model('company_settings', 'CompanySettings')
    CompanyImage = apps.get_model('company_settings', 'CompanyImage')
    
    try:
        settings = CompanySettings.objects.first()
        if settings:
            # Set first logo as active if no active logo exists
            if not settings.active_logo:
                first_logo = CompanyImage.objects.filter(image_type='logo').first()
                if first_logo:
                    settings.active_logo = first_logo
                    settings.save(update_fields=['active_logo'])
            
            # Set first login_image as active if no active login_image exists
            if not settings.active_login_image:
                first_login_image = CompanyImage.objects.filter(image_type='login_image').first()
                if first_login_image:
                    settings.active_login_image = first_login_image
                    settings.save(update_fields=['active_login_image'])
    except Exception as e:
        pass


def reverse_set_active_images(apps, schema_editor):
    """
    Reverse migration - not needed
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('company_settings', '0003_remove_fields_and_add_foreign_keys'),
    ]

    operations = [
        migrations.RunPython(set_initial_active_images, reverse_set_active_images),
    ]

