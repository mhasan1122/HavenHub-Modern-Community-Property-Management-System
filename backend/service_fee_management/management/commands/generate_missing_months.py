"""
Management command to generate missing service fee months
Usage:
    python manage.py generate_missing_months --from-month=1 --from-year=2025 --to-month=11 --to-year=2025
"""
from django.core.management.base import BaseCommand
from service_fee_management.utils.service_fee_generator import generate_all_missing_months


class Command(BaseCommand):
    help = 'Generate missing service fee months'

    def add_arguments(self, parser):
        parser.add_argument(
            '--from-month',
            type=int,
            help='Start month (1-12)',
        )
        parser.add_argument(
            '--from-year',
            type=int,
            help='Start year',
        )
        parser.add_argument(
            '--to-month',
            type=int,
            help='End month (1-12)',
        )
        parser.add_argument(
            '--to-year',
            type=int,
            help='End year',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force regenerate existing records',
        )

    def handle(self, *args, **options):
        from_month = options.get('from_month')
        from_year = options.get('from_year')
        to_month = options.get('to_month')
        to_year = options.get('to_year')
        force = options.get('force', False)

        self.stdout.write(self.style.SUCCESS('\n' + '='*80))
        self.stdout.write(self.style.SUCCESS('Generating Missing Service Fee Months'))
        self.stdout.write(self.style.SUCCESS('='*80))

        result = generate_all_missing_months(
            from_month=from_month,
            from_year=from_year,
            to_month=to_month,
            to_year=to_year,
            force_regenerate=force
        )

        if result['success']:
            self.stdout.write(self.style.SUCCESS(f"\n✅ SUCCESS: {result['message']}"))
            self.stdout.write(f"  Total Created: {result['total_created']}")
            self.stdout.write(f"  Total Regenerated: {result['total_regenerated']}")
            self.stdout.write(f"  Total Skipped: {result['total_skipped']}")
        else:
            self.stdout.write(self.style.ERROR(f"\n❌ ERROR: {result.get('error', 'Unknown error')}"))

        self.stdout.write(self.style.SUCCESS('='*80 + '\n'))
