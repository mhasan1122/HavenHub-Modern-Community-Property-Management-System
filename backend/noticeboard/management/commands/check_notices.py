from django.core.management.base import BaseCommand
from django.utils import timezone
from noticeboard.models import Notice
import datetime


class Command(BaseCommand):
    help = 'Check and display notice statuses, and optionally fix them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Fix notice statuses based on current date/time',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Checking notices...'))
        
        notices = Notice.objects.all().order_by('id')
        
        if not notices.exists():
            self.stdout.write(self.style.WARNING('No notices found in database.'))
            return
        
        now = datetime.datetime.now()
        self.stdout.write(f'Current time: {now}')
        self.stdout.write('-' * 80)
        
        ongoing_count = 0
        upcoming_count = 0
        expired_count = 0
        draft_count = 0
        fixed_count = 0
        
        for notice in notices:
            # Calculate what the status should be
            if notice.start_date and notice.start_time and notice.end_date and notice.end_time:
                start_datetime = datetime.datetime.combine(notice.start_date, notice.start_time)
                end_datetime = datetime.datetime.combine(notice.end_date, notice.end_time)
                
                # Calculate expected status
                if notice.manually_expired and now <= end_datetime:
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
            if notice.status == 'ongoing':
                ongoing_count += 1
            elif notice.status == 'upcoming':
                upcoming_count += 1
            elif notice.status == 'expired':
                expired_count += 1
            elif notice.status == 'draft':
                draft_count += 1
            
            # Display notice info
            status_match = "✓" if notice.status == expected_status else "✗"
            start_str = str(start_datetime) if notice.start_date else "None"
            end_str = str(end_datetime) if notice.end_date else "None"

            self.stdout.write(
                f'ID: {notice.id:2d} | '
                f'Title: {notice.internal_title[:30]:30s} | '
                f'Current: {notice.status:8s} | '
                f'Expected: {expected_status:8s} | '
                f'Match: {status_match}'
            )
            self.stdout.write(
                f'     Start: {start_str} | End: {end_str} | Manually Expired: {notice.manually_expired}'
            )
            
            # Fix status if requested and needed
            if options['fix'] and notice.status != expected_status:
                old_status = notice.status
                notice.update_status()
                self.stdout.write(
                    self.style.SUCCESS(f'  → Fixed: {old_status} → {notice.status}')
                )
                fixed_count += 1
        
        self.stdout.write('-' * 80)
        self.stdout.write(f'Summary:')
        self.stdout.write(f'  Total notices: {notices.count()}')
        self.stdout.write(f'  Ongoing: {ongoing_count}')
        self.stdout.write(f'  Upcoming: {upcoming_count}')
        self.stdout.write(f'  Expired: {expired_count}')
        self.stdout.write(f'  Draft: {draft_count}')
        
        if options['fix']:
            self.stdout.write(self.style.SUCCESS(f'  Fixed: {fixed_count} notices'))
        else:
            self.stdout.write(self.style.WARNING(f'  Run with --fix to update incorrect statuses')) 