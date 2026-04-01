"""
Backfill total_paid on ServiceFeePayment (service_fee_management_servicefeegenerate) from
the sum of ServiceFeeBilling.total_paid. Gateway payments (e.g. Paystation) create billing
rows but may not have updated the bill's total_paid; this syncs existing data so Payment
History and other reports show correctly.
"""
from django.core.management.base import BaseCommand
from django.db.models import Sum
from service_fee_management.models import ServiceFeeBilling, ServiceFeePayment
from decimal import Decimal


class Command(BaseCommand):
    help = 'Backfill total_paid on bill records from payment details (fixes gateway-paid bills not showing in history)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only report what would be updated, do not save',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be saved'))

        self.stdout.write(self.style.SUCCESS('\n' + '='*80))
        self.stdout.write(self.style.SUCCESS('BACKFILL BILL total_paid FROM PAYMENT DETAILS'))
        self.stdout.write(self.style.SUCCESS('='*80 + '\n'))

        # All payments that have at least one billing record
        payments_with_billings = ServiceFeePayment.objects.filter(
            billing_records__isnull=False
        ).distinct()

        updated = 0
        for payment in payments_with_billings:
            total_from_billings = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=payment
            ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')

            if total_from_billings != payment.total_paid:
                self.stdout.write(
                    f"  Payment id={payment.id} unit={payment.unit_id} "
                    f"{payment.service_period_month}/{payment.service_period_year}: "
                    f"total_paid {payment.total_paid} → {total_from_billings}"
                )
                if not dry_run:
                    payment.total_paid = total_from_billings
                    payment.save(update_fields=['total_paid'])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f'\nUpdated {updated} bill(s).' + (' (dry run)' if dry_run else '')))
