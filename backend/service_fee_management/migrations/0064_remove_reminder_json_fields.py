from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0063_remove_send_when_column'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='reminder',
            name='payment_status',
        ),
        migrations.RemoveField(
            model_name='reminder',
            name='tower_id',
        ),
        migrations.RemoveField(
            model_name='reminder',
            name='specific_target',
        ),
        migrations.RemoveField(
            model_name='reminder',
            name='audience',
        ),
    ]
