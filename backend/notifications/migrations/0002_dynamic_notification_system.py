# Generated migration for dynamic notification system
# This migration converts the notification system to support multiple entity types dynamically

from django.db import migrations, models
from django.core import validators
import django.db.models.deletion


def create_notification_types(apps, schema_editor):
    """
    Create initial notification types for announcements
    """
    NotificationType = apps.get_model('notifications', 'NotificationType')
    
    # Create the three existing announcement notification types
    NotificationType.objects.get_or_create(
        code='announcement_published',
        defaults={
            'name': 'Announcement Published',
            'description': 'Notification when an announcement is published',
            'entity_type': 'announcement',
            'icon': '📢',
            'priority': 5,
            'is_active': True
        }
    )
    
    NotificationType.objects.get_or_create(
        code='announcement_scheduled',
        defaults={
            'name': 'Announcement Scheduled',
            'description': 'Notification when an announcement is scheduled',
            'entity_type': 'announcement',
            'icon': '⏰',
            'priority': 3,
            'is_active': True
        }
    )
    
    NotificationType.objects.get_or_create(
        code='announcement_ongoing',
        defaults={
            'name': 'Announcement Now Ongoing',
            'description': 'Notification when an announcement becomes ongoing',
            'entity_type': 'announcement',
            'icon': '🔔',
            'priority': 4,
            'is_active': True
        }
    )


def migrate_notification_data(apps, schema_editor):
    """
    Migrate existing notifications to use the new structure
    """
    Notification = apps.get_model('notifications', 'Notification')
    NotificationType = apps.get_model('notifications', 'NotificationType')
    
    # Map old notification_type strings to new NotificationType objects
    type_mapping = {
        'announcement_published': NotificationType.objects.get(code='announcement_published'),
        'announcement_scheduled': NotificationType.objects.get(code='announcement_scheduled'),
        'announcement_ongoing': NotificationType.objects.get(code='announcement_ongoing'),
    }
    
    # Update all existing notifications
    for notification in Notification.objects.all():
        old_type = notification.old_notification_type
        if old_type in type_mapping:
            notification.notification_type_new = type_mapping[old_type]
            # Set entity_type and entity_id from announcement_id
            notification.entity_type = 'announcement'
            notification.entity_id = notification.announcement_id or 0
            notification.save()


def reverse_migration(apps, schema_editor):
    """
    Reverse migration - convert back to old structure
    Note: This is a simplified reverse that may not fully restore the old state
    """
    # In reverse, we just need to ensure the migration can be rolled back
    # The actual data conversion would be complex and may not be needed
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        # Step 1: Create NotificationType model
        migrations.CreateModel(
            name='NotificationType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(help_text="Unique code for this notification type (e.g., 'announcement_published')", max_length=100, unique=True, validators=[validators.MinLengthValidator(3)])),
                ('name', models.CharField(help_text="Human-readable name (e.g., 'Announcement Published')", max_length=255)),
                ('description', models.TextField(blank=True, help_text='Description of when this notification is triggered', null=True)),
                ('entity_type', models.CharField(choices=[('announcement', 'Announcement'), ('bulletin', 'Bulletin'), ('member', 'Member'), ('notice', 'Notice'), ('payment', 'Payment'), ('service_fee', 'Service Fee'), ('document', 'Document'), ('other', 'Other')], help_text='Type of entity this notification relates to', max_length=50)),
                ('icon', models.CharField(blank=True, help_text="Icon or emoji for this notification type (e.g., '📢', '📋')", max_length=50, null=True)),
                ('is_active', models.BooleanField(default=True, help_text='Whether this notification type is currently active')),
                ('priority', models.IntegerField(default=0, help_text='Priority level (higher = more important)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Notification Type',
                'verbose_name_plural': 'Notification Types',
                'ordering': ['-priority', 'name'],
            },
        ),
        migrations.AddIndex(
            model_name='notificationtype',
            index=models.Index(fields=['code'], name='notificatio_code_idx'),
        ),
        migrations.AddIndex(
            model_name='notificationtype',
            index=models.Index(fields=['entity_type', 'is_active'], name='notificatio_entity__idx'),
        ),
        
        # Step 1.5: Ensure icon column uses utf8mb4 for emoji support
        migrations.RunSQL(
            sql="ALTER TABLE `notifications_notificationtype` MODIFY COLUMN `icon` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
            reverse_sql="ALTER TABLE `notifications_notificationtype` MODIFY COLUMN `icon` VARCHAR(50) NULL",
        ),
        
        # Step 2: Add new fields to Notification (nullable first)
        migrations.AddField(
            model_name='notification',
            name='notification_type_new',
            field=models.ForeignKey(help_text='Type of notification', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='notifications_new', to='notifications.notificationtype'),
        ),
        migrations.AddField(
            model_name='notification',
            name='entity_type',
            field=models.CharField(help_text="Type of entity (e.g., 'announcement', 'bulletin', 'member')", max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='notification',
            name='entity_id',
            field=models.IntegerField(help_text='ID of the related entity', null=True),
        ),
        migrations.AddField(
            model_name='notification',
            name='metadata',
            field=models.JSONField(blank=True, default=dict, help_text='Additional metadata about the notification (e.g., extra context)'),
        ),
        
        # Step 3: Preserve old notification_type field temporarily
        migrations.RenameField(
            model_name='notification',
            old_name='notification_type',
            new_name='old_notification_type',
        ),
        
        # Step 4: Populate NotificationType table
        migrations.RunPython(create_notification_types, reverse_migration),
        
        # Step 5: Migrate existing notification data
        migrations.RunPython(migrate_notification_data, reverse_migration),
        
        # Step 6: Remove old fields and rename new ones
        migrations.RemoveField(
            model_name='notification',
            name='old_notification_type',
        ),
        migrations.RemoveField(
            model_name='notification',
            name='announcement_id',
        ),
        migrations.RenameField(
            model_name='notification',
            old_name='notification_type_new',
            new_name='notification_type',
        ),
        
        # Step 7: Make new fields non-nullable
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.ForeignKey(help_text='Type of notification', on_delete=django.db.models.deletion.PROTECT, related_name='notifications', to='notifications.notificationtype'),
        ),
        migrations.AlterField(
            model_name='notification',
            name='entity_type',
            field=models.CharField(help_text="Type of entity (e.g., 'announcement', 'bulletin', 'member')", max_length=50),
        ),
        migrations.AlterField(
            model_name='notification',
            name='entity_id',
            field=models.IntegerField(help_text='ID of the related entity'),
        ),
        
        # Step 8: Add new indexes
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['entity_type', 'entity_id'], name='notificatio_entity__idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['entity_type', 'entity_id', 'recipient'], name='notificatio_entity__idx2'),
        ),
    ]

