"""
Management command to manually trigger scheduled service fee generation
Useful for testing the scheduled task without waiting for cron

Usage:
    python manage.py generate_service_fees_scheduled
    python manage.py generate_service_fees_scheduled --unit-ids="12604"
    python manage.py generate_service_fees_scheduled --year=2025 --month=11
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
# from backend.service_fee_management.schedulerOLD import scheduled_generate_service_fees
from service_fee_management.utils.service_fee_generator import generate_service_fees
from service_fee_management.utils.voucher_generator import create_vouchers_for_generated_bills
from service_fee_management.models import ServiceFeePayment
from django.db import transaction


class Command(BaseCommand):
    help = 'Manually trigger scheduled service fee generation (for testing)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--unit-ids',
            type=str,
            help='Comma-separated unit IDs (e.g., "12604" or "1,2,3")',
            default=None
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Year to generate for (defaults to current year)',
            default=None
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Month to generate for (defaults to current month)',
            default=None
        )
        parser.add_argument(
            '--tower-id',
            type=int,
            help='Tower ID to filter by (optional)',
            default=None
        )
        parser.add_argument(
            '--service-fee-id',
            type=int,
            help='Service fee ID to filter by (optional)',
            default=None
        )
        parser.add_argument(
            '--force-regenerate',
            action='store_true',
            help='Force regenerate even if records exist',
            default=False
        )

    def handle(self, *args, **options):
        unit_ids = options.get('unit_ids')
        year = options.get('year')
        month = options.get('month')
        tower_id = options.get('tower_id')
        service_fee_id = options.get('service_fee_id')
        force_regenerate = options.get('force_regenerate', False)
        
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("🔄 SERVICE FEE GENERATION COMMAND"))
        self.stdout.write("=" * 80)
        
        # If year/month not specified, use current date
        if not year or not month:
            now = timezone.now()
            year = year or now.year
            month = month or now.month
            self.stdout.write(f"Using current date: {year}-{month:02d}")
        else:
            self.stdout.write(f"Generating for: {year}-{month:02d}")
        
        if unit_ids:
            self.stdout.write(f"Unit IDs filter: {unit_ids}")
        if tower_id:
            self.stdout.write(f"Tower ID filter: {tower_id}")
        if service_fee_id:
            self.stdout.write(f"Service Fee ID filter: {service_fee_id}")
        if force_regenerate:
            self.stdout.write(self.style.WARNING("⚠️  Force regenerate enabled"))
        
        self.stdout.write("=" * 80)
        self.stdout.write("")
        
        # Use the utility function directly for more control
        result = generate_service_fees(
            year=year,
            month=month,
            unit_ids=unit_ids,
            tower_id=tower_id,
            service_fee_ids=service_fee_id,
            force_regenerate=force_regenerate
        )
        
        if result['success']:
            self.stdout.write(self.style.SUCCESS("✅ Service fee generation completed successfully"))
            self.stdout.write(f"   Created: {result['created_count']}")
            self.stdout.write(f"   Regenerated: {result['regenerated_count']}")
            
            # --- START VOUCHER GENERATION ---
            if result['created_count'] > 0 or result['regenerated_count'] > 0:
                self.stdout.write("\n🔄 Starting voucher generation for created/updated bills...")
                newly_generated_payments = ServiceFeePayment.objects.filter(
                    service_period_year=year,
                    service_period_month=month,
                    # Optional: Add filters to match the command arguments
                ).select_related(
                    'unit', 'unit__floor', 'unit__floor__tower'
                ).prefetch_related(
                    'items', 'items__bill_category'
                )
                
                if tower_id:
                    newly_generated_payments = newly_generated_payments.filter(unit__floor__tower_id=tower_id)
                if unit_ids:
                    u_ids = [int(u.strip()) for u in unit_ids.split(',') if u.strip().isdigit()]
                    newly_generated_payments = newly_generated_payments.filter(unit_id__in=u_ids)
                
                if newly_generated_payments.exists():
                    v_result = create_vouchers_for_generated_bills(
                        newly_generated_payments,
                        year,
                        month,
                        created_by=None # System generated
                    )
                    
                    if v_result.get('success'):
                        self.stdout.write(self.style.SUCCESS(f"✅ Successfully created {v_result.get('created_count', 0)} voucher(s)"))
                    else:
                        self.stdout.write(self.style.ERROR(f"❌ Voucher creation failed: {v_result.get('errors')}"))
                else:
                    self.stdout.write(self.style.WARNING("⚠️ No payments found to voucher."))
            # --- END VOUCHER GENERATION ---
            
            if result['skipped_count'] > 0:
                self.stdout.write(self.style.NOTICE(f"\nℹ️  Skipped {result['skipped_count']} record(s)"))
        else:
            self.stdout.write(self.style.ERROR(f"❌ Service fee generation failed: {result.get('error', 'Unknown error')}"))
            return
        
        self.stdout.write("")
        self.stdout.write("=" * 80)

