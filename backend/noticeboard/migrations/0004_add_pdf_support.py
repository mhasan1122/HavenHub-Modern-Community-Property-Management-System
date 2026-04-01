# Generated manually to update file extensions for PDF support

import django.core.validators
import noticeboard.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('noticeboard', '0003_remove_title_description_safe'),
    ]

    operations = [
        migrations.AlterField(
            model_name='noticeattachment',
            name='file',
            field=models.FileField(upload_to=noticeboard.models.upload_to_notice_attachments, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf'])]),
        ),
    ]
