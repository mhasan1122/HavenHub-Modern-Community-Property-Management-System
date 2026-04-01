from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0061_move_send_times_to_reminder'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='reminder',
            name='send_when_times',
        ),
    ]
