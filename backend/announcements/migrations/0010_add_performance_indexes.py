# Generated migration for announcement performance optimization

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0009_alter_announcement_label'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['-is_pinned', '-created_at'], name='announcemen_is_pinn_idx'),
        ),
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['status', '-created_at'], name='announcemen_status_idx'),
        ),
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['priority'], name='announcemen_priorit_idx'),
        ),
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['start_date', 'end_date'], name='announcemen_start_d_idx'),
        ),
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['creator'], name='announcemen_creator_idx'),
        ),
    ]
