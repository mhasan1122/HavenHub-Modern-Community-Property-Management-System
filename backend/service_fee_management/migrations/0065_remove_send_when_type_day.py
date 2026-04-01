from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0064_remove_reminder_json_fields'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='reminder',
            name='send_when_type',
        ),
        migrations.RemoveField(
            model_name='reminder',
            name='send_when_day',
        ),
    ]
