"""
Django management command to diagnose why push notifications aren't being sent

Usage:
    python manage.py check_push_notification --announcement-id 1
"""
from django.core.management.base import BaseCommand
from notifications.models import DeviceToken, Notification
from announcements.models import Announcement
from user.models import Member


class Command(BaseCommand):
    help = 'Diagnose why push notifications are not being sent'

    def add_arguments(self, parser):
        parser.add_argument(
            '--announcement-id',
            type=int,
            help='ID of announcement to check',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🔍 Push Notification Diagnostic'))
        self.stdout.write('=' * 80)
        
        # Check device tokens
        self.stdout.write('\n1️⃣  Checking Device Tokens...')
        device_tokens = DeviceToken.objects.filter(is_active=True).select_related('member')
        
        if not device_tokens.exists():
            self.stdout.write(self.style.ERROR('❌ NO ACTIVE DEVICE TOKENS FOUND!'))
            self.stdout.write('   This is likely the issue. The mobile app needs to:')
            self.stdout.write('   1. Be logged in')
            self.stdout.write('   2. Request notification permissions')
            self.stdout.write('   3. Register the device token with the backend')
            return
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ Found {device_tokens.count()} active device token(s):'))
            for token in device_tokens:
                self.stdout.write(f'   • Member: {token.member.full_name} (ID: {token.member.id})')
                self.stdout.write(f'     Platform: {token.platform} | Device: {token.device_id or "Unknown"}')
                self.stdout.write(f'     Token: {token.token[:60]}...')
                self.stdout.write(f'     Last used: {token.last_used_at}')
        
        # Check if announcement ID provided
        if not options['announcement_id']:
            # Get latest announcement
            announcement = Announcement.objects.filter(status='ongoing').order_by('-created_at').first()
            if not announcement:
                announcement = Announcement.objects.order_by('-created_at').first()
        else:
            try:
                announcement = Announcement.objects.get(id=options['announcement_id'])
            except Announcement.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'❌ Announcement with ID {options["announcement_id"]} not found'))
                return
        
        if not announcement:
            self.stdout.write(self.style.WARNING('⚠️  No announcements found'))
            return
        
        self.stdout.write(f'\n2️⃣  Checking Announcement: ID {announcement.id}')
        self.stdout.write(f'   Title: {announcement.title}')
        self.stdout.write(f'   Priority: {announcement.priority}')
        self.stdout.write(f'   Status: {announcement.status}')
        self.stdout.write(f'   Created: {announcement.created_at}')
        
        # Check notifications for this announcement
        self.stdout.write(f'\n3️⃣  Checking Notifications...')
        notifications = Notification.objects.filter(
            entity_type='announcement',
            entity_id=announcement.id
        ).select_related('recipient', 'notification_type')
        
        if not notifications.exists():
            self.stdout.write(self.style.ERROR('❌ NO NOTIFICATIONS FOUND FOR THIS ANNOUNCEMENT!'))
            self.stdout.write('   This means notifications were never created.')
            self.stdout.write('   Possible reasons:')
            self.stdout.write('   - Announcement status was not "ongoing" or "upcoming" when created')
            self.stdout.write('   - No recipients found (permission issues)')
            return
        
        self.stdout.write(self.style.SUCCESS(f'✅ Found {notifications.count()} notification(s):'))
        
        push_enabled_count = 0
        push_disabled_count = 0
        recipients_with_tokens = 0
        recipients_without_tokens = 0
        
        for notification in notifications:
            recipient = notification.recipient
            should_send_push = notification.metadata.get('should_send_push', False)
            has_token = DeviceToken.objects.filter(member=recipient, is_active=True).exists()
            
            if should_send_push:
                push_enabled_count += 1
                status_icon = '📲' if has_token else '⚠️'
            else:
                push_disabled_count += 1
                status_icon = '📱'
            
            if has_token:
                recipients_with_tokens += 1
            else:
                recipients_without_tokens += 1
            
            self.stdout.write(f'   {status_icon} Recipient: {recipient.full_name} (ID: {recipient.id})')
            self.stdout.write(f'      Push enabled: {should_send_push}')
            self.stdout.write(f'      Has device token: {has_token}')
            self.stdout.write(f'      Notification ID: {notification.id}')
            self.stdout.write(f'      Metadata: {notification.metadata}')
        
        # Summary
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('📊 Diagnostic Summary:'))
        self.stdout.write(f'   Total notifications: {notifications.count()}')
        self.stdout.write(f'   Push enabled: {push_enabled_count}')
        self.stdout.write(f'   Push disabled: {push_disabled_count}')
        self.stdout.write(f'   Recipients with device tokens: {recipients_with_tokens}')
        self.stdout.write(f'   Recipients without device tokens: {recipients_without_tokens}')
        
        # Recommendations
        self.stdout.write('\n💡 Recommendations:')
        
        if recipients_without_tokens > 0:
            self.stdout.write(self.style.WARNING(f'   ⚠️  {recipients_without_tokens} recipient(s) do not have device tokens'))
            self.stdout.write('      - These users need to log in to the mobile app')
            self.stdout.write('      - The app should register their device token automatically')
        
        if push_disabled_count > 0:
            self.stdout.write(f'   ℹ️  {push_disabled_count} notification(s) have push disabled')
            self.stdout.write('      - These notifications will only show in-app notifications')
        
        if push_enabled_count > 0 and recipients_with_tokens > 0:
            self.stdout.write(self.style.SUCCESS('   ✅ Push notifications should be working!'))
            self.stdout.write('      - Check backend logs for push notification errors')
            self.stdout.write('      - Verify Expo Push API is accessible')
            self.stdout.write('      - Check mobile app notification permissions')
        
        self.stdout.write('\n' + '=' * 80)
