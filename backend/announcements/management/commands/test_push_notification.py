"""
Django management command to test push notifications by creating a test announcement

Usage:
    python manage.py test_push_notification
    python manage.py test_push_notification --priority high
    python manage.py test_push_notification --member-id 1
    python manage.py test_push_notification --check-tokens-only
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from announcements.models import Announcement
from notifications.models import DeviceToken, Notification
from notifications.utils import create_announcement_notification, get_announcement_recipients
from notifications.push_service import send_push_for_notifications
from user.models import Member
from towers.models import Tower, Unit
import datetime


class Command(BaseCommand):
    help = 'Test push notifications by creating a test announcement'

    def add_arguments(self, parser):
        parser.add_argument(
            '--priority',
            type=str,
            choices=['urgent', 'high', 'normal', 'low'],
            default='high',
            help='Priority level for the test announcement (default: high)',
        )
        parser.add_argument(
            '--member-id',
            type=int,
            help='ID of member to create announcement as (default: first member)',
        )
        parser.add_argument(
            '--check-tokens-only',
            action='store_true',
            help='Only check registered device tokens, do not create announcement',
        )
        parser.add_argument(
            '--title',
            type=str,
            default=None,
            help='Custom title for the test announcement',
        )
        parser.add_argument(
            '--description',
            type=str,
            default=None,
            help='Custom description for the test announcement',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🧪 Push Notification Test Script'))
        self.stdout.write('=' * 80)
        
        # Check device tokens
        self.stdout.write('\n📱 Checking registered device tokens...')
        device_tokens = DeviceToken.objects.filter(is_active=True).select_related('member')
        
        if not device_tokens.exists():
            self.stdout.write(self.style.WARNING('⚠️  No active device tokens found!'))
            self.stdout.write('   Make sure the mobile app is logged in and has registered for push notifications.')
            if not options['check_tokens_only']:
                self.stdout.write(self.style.ERROR('\n❌ Cannot test push notifications without device tokens.'))
                return
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ Found {device_tokens.count()} active device token(s):'))
            for token in device_tokens:
                self.stdout.write(f'   • {token.member.full_name} ({token.member.id})')
                self.stdout.write(f'     Platform: {token.platform} | Device: {token.device_id or "Unknown"}')
                self.stdout.write(f'     Token: {token.token[:50]}...')
                self.stdout.write(f'     Last used: {token.last_used_at}')
        
        if options['check_tokens_only']:
            return
        
        # Get member to create announcement as
        if options['member_id']:
            try:
                creator = Member.objects.get(id=options['member_id'])
            except Member.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'❌ Member with ID {options["member_id"]} not found'))
                return
        else:
            creator = Member.objects.first()
            if not creator:
                self.stdout.write(self.style.ERROR('❌ No members found in database'))
                return
        
        self.stdout.write(f'\n👤 Creating announcement as: {creator.full_name} (ID: {creator.id})')
        
        # Create test announcement
        priority = options['priority']
        title = options['title'] or f'Test Push Notification - {priority.upper()} Priority'
        description = options['description'] or f'This is a test announcement to verify push notifications are working correctly. Priority: {priority}'
        
        # Set dates: start now, end in 1 hour
        now = datetime.datetime.now()
        start_date = now.date()
        start_time = now.time()
        end_date = (now + datetime.timedelta(hours=1)).date()
        end_time = (now + datetime.timedelta(hours=1)).time()
        
        self.stdout.write(f'\n📢 Creating test announcement...')
        self.stdout.write(f'   Title: {title}')
        self.stdout.write(f'   Priority: {priority}')
        self.stdout.write(f'   Start: {start_date} {start_time}')
        self.stdout.write(f'   End: {end_date} {end_time}')
        
        # Create announcement
        announcement = Announcement.objects.create(
            title=title,
            description=description,
            creator=creator,
            post_as='creator',
            priority=priority,
            label='Test',
            start_date=start_date,
            start_time=start_time,
            end_date=end_date,
            end_time=end_time,
        )
        
        # Update status to 'ongoing' so notifications are sent
        announcement.update_status()
        announcement.save()
        
        self.stdout.write(self.style.SUCCESS(f'✅ Created announcement ID: {announcement.id}'))
        self.stdout.write(f'   Status: {announcement.status}')
        
        # Get recipients
        self.stdout.write(f'\n👥 Getting announcement recipients...')
        recipients = get_announcement_recipients(announcement)
        self.stdout.write(f'   Found {len(recipients)} recipient(s)')
        
        if not recipients:
            self.stdout.write(self.style.WARNING('⚠️  No recipients found for this announcement'))
            self.stdout.write('   This might be because:')
            self.stdout.write('   - No members have view permission for announcements')
            self.stdout.write('   - No target towers/units are set')
            return
        
        # Show recipients
        for recipient in recipients[:10]:  # Show first 10
            self.stdout.write(f'   • {recipient.full_name} (ID: {recipient.id})')
        if len(recipients) > 10:
            self.stdout.write(f'   ... and {len(recipients) - 10} more')
        
        # Create notifications
        self.stdout.write(f'\n🔔 Creating notifications...')
        notifications = create_announcement_notification(
            announcement,
            'announcement_published'
        )
        
        self.stdout.write(self.style.SUCCESS(f'✅ Created {len(notifications)} notification(s)'))
        
        # Check which notifications should send push
        push_enabled = [n for n in notifications if n.metadata.get('should_send_push', False)]
        push_disabled = [n for n in notifications if not n.metadata.get('should_send_push', False)]
        
        self.stdout.write(f'\n📲 Push Notification Status:')
        self.stdout.write(f'   Push enabled: {len(push_enabled)} notification(s)')
        self.stdout.write(f'   Push disabled (in-app only): {len(push_disabled)} notification(s)')
        
        if push_enabled:
            self.stdout.write(f'\n🚀 Sending push notifications...')
            # Send push notifications
            push_result = send_push_for_notifications(push_enabled)
            
            if push_result.get('success'):
                success_count = push_result.get('success_count', 0)
                error_count = push_result.get('error_count', 0)
                self.stdout.write(self.style.SUCCESS(f'✅ Push notifications sent!'))
                self.stdout.write(f'   Success: {success_count}')
                if error_count > 0:
                    self.stdout.write(self.style.WARNING(f'   Errors: {error_count}'))
                
                # Show results
                results = push_result.get('results', [])
                for i, result in enumerate(results[:5]):  # Show first 5 results
                    status = result.get('status', 'unknown')
                    if status == 'ok':
                        self.stdout.write(self.style.SUCCESS(f'   ✓ Token {i+1}: Sent successfully'))
                    else:
                        error = result.get('message', 'Unknown error')
                        self.stdout.write(self.style.ERROR(f'   ✗ Token {i+1}: {error}'))
            else:
                error = push_result.get('error', 'Unknown error')
                self.stdout.write(self.style.ERROR(f'❌ Failed to send push notifications: {error}'))
        else:
            self.stdout.write(self.style.WARNING('⚠️  No push notifications to send (should_send_push is False)'))
        
        # Summary
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('📊 Test Summary:'))
        self.stdout.write(f'   Announcement ID: {announcement.id}')
        self.stdout.write(f'   Priority: {priority}')
        self.stdout.write(f'   Recipients: {len(recipients)}')
        self.stdout.write(f'   Notifications created: {len(notifications)}')
        self.stdout.write(f'   Push notifications sent: {len(push_enabled)}')
        self.stdout.write(f'   Device tokens registered: {device_tokens.count()}')
        
        self.stdout.write('\n💡 Next steps:')
        self.stdout.write('   1. Check your mobile app for the push notification')
        self.stdout.write('   2. Verify the notification appears in the app')
        self.stdout.write('   3. Tap the notification to ensure it navigates correctly')
        
        self.stdout.write('\n' + '=' * 80)
