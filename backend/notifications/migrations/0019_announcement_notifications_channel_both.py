# Data migration: show existing announcement notifications on both web and mobile
# so mobile app unread count matches what users see on web.

from django.db import migrations


def set_announcement_channel_both(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')
    updated = Notification.objects.filter(
        entity_type='announcement',
        channel='web'
    ).update(channel='both')
    if updated:
        print(f"[notifications] Set channel='both' for {updated} existing announcement notification(s)")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0018_notification_channel'),
    ]

    operations = [
        migrations.RunPython(set_announcement_channel_both, noop_reverse),
    ]
