from django.core.management.base import BaseCommand
from django.utils import timezone
from announcements.models import Announcement
import datetime


class Command(BaseCommand):
    help = 'Check and display announcement statuses, and optionally fix them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Fix announcement statuses based on current date/time',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Checking announcements...'))
        
        announcements = Announcement.objects.all().order_by('id')
        
        if not announcements.exists():
            self.stdout.write(self.style.WARNING('No announcements found in database.'))
            return
        
        now = datetime.datetime.now()
        self.stdout.write(f'Current time: {now}')
        self.stdout.write('-' * 80)
        
        ongoing_count = 0
        upcoming_count = 0
        expired_count = 0
        draft_count = 0
        fixed_count = 0
        
        for announcement in announcements:
            # Calculate what the status should be
            if announcement.start_date and announcement.start_time and announcement.end_date and announcement.end_time:
                start_datetime = datetime.datetime.combine(announcement.start_date, announcement.start_time)
                end_datetime = datetime.datetime.combine(announcement.end_date, announcement.end_time)
                
                # Calculate expected status
                if announcement.manually_expired and now <= end_datetime:
                    expected_status = 'expired'
                elif now < start_datetime:
                    expected_status = 'upcoming'
                elif start_datetime <= now <= end_datetime:
                    expected_status = 'ongoing'
                else:
                    expected_status = 'expired'
            else:
                expected_status = 'draft'
            
            # Count current statuses
            if announcement.status == 'ongoing':
                ongoing_count += 1
            elif announcement.status == 'upcoming':
                upcoming_count += 1
            elif announcement.status == 'expired':
                expired_count += 1
            elif announcement.status == 'draft':
                draft_count += 1
            
            # Display announcement info
            status_match = "✓" if announcement.status == expected_status else "✗"
            start_str = str(start_datetime) if announcement.start_date else "None"
            end_str = str(end_datetime) if announcement.end_date else "None"

            self.stdout.write(
                f'ID: {announcement.id:2d} | '
                f'Title: {announcement.title[:30]:30s} | '
                f'Current: {announcement.status:8s} | '
                f'Expected: {expected_status:8s} | '
                f'Match: {status_match}'
            )
            self.stdout.write(
                f'     Start: {start_str} | End: {end_str} | Manually Expired: {announcement.manually_expired}'
            )
            
            # Fix status if requested and needed
            if options['fix'] and announcement.status != expected_status:
                old_status = announcement.status
                announcement.update_status()
                self.stdout.write(
                    self.style.SUCCESS(f'  → Fixed: {old_status} → {announcement.status}')
                )
                fixed_count += 1
        
        self.stdout.write('-' * 80)
        self.stdout.write(f'Summary:')
        self.stdout.write(f'  Total announcements: {announcements.count()}')
        self.stdout.write(f'  Ongoing: {ongoing_count}')
        self.stdout.write(f'  Upcoming: {upcoming_count}')
        self.stdout.write(f'  Expired: {expired_count}')
        self.stdout.write(f'  Draft: {draft_count}')
        
        if options['fix']:
            self.stdout.write(self.style.SUCCESS(f'  Fixed: {fixed_count} announcements'))
        else:
            self.stdout.write(self.style.WARNING('Use --fix to update announcement statuses'))
