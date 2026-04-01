# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contacts', '0002_importantcontact_photo'),
        ('user', '0002_delete_mymodel'),
    ]

    operations = [
        migrations.AddField(
            model_name='importantcontact',
            name='member',
            field=models.ForeignKey(
                blank=True,
                help_text='Linked organization member (optional)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='important_contacts',
                to='user.member',
            ),
        ),
    ]

