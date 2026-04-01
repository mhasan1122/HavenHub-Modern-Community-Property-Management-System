# Generated manually to update priority choices

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='announcement',
            name='priority',
            field=models.CharField(choices=[('urgent', 'Urgent'), ('high', 'High'), ('normal', 'Normal'), ('low', 'Low')], max_length=10),
        ),
    ]
