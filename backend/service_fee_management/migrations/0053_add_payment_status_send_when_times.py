from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0052_add_send_when_type_day'),
    ]

    operations = [
        migrations.AddField(
            model_name='reminder',
            name='payment_status',
            field=models.JSONField(default=list, null=True, blank=True, help_text="List of payment statuses to target (e.g., ['Paid','Due'])"),
        ),
        migrations.AddField(
            model_name='reminder',
            name='send_when_times',
            field=models.JSONField(default=list, null=True, blank=True, help_text="Global send times applied to send_when entries"),
        ),
    ]
