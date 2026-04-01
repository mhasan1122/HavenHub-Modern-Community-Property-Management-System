from django.core.management.base import BaseCommand
from service_fee_management.models import ServiceFeePayment
from django.db.models import Sum


class Command(BaseCommand):
    help = 'Consolidate multiple partial payments into single rows for each month'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - No changes will be made"))
        
        # Find all months with multiple partial payments
        from django.db.models import Count
        
        # Group by unit, service_fee, month, year
        grouped_payments = ServiceFeePayment.objects.filter(
            payment_status='completed',
            service_status='partial'
        ).values(
            'unit_id', 'service_fee_id', 'service_period_month', 'service_period_year'
        ).annotate(
            payment_count=Count('id'),
            total_amount=Sum('amount')
        ).filter(payment_count__gt=1)
        
        if not grouped_payments.exists():
            self.stdout.write(self.style.SUCCESS("✅ No duplicate partial payments found"))
            return
        
        self.stdout.write(f"Found {grouped_payments.count()} months with multiple partial payments:")
        
        for group in grouped_payments:
            unit_id = group['unit_id']
            service_fee_id = group['service_fee_id']
            month = group['service_period_month']
            year = group['service_period_year']
            payment_count = group['payment_count']
            total_amount = group['total_amount']
            
            self.stdout.write(f"\n📅 {month:02d}/{year} - Unit {unit_id} - Service Fee {service_fee_id}")
            self.stdout.write(f"   Multiple payments: {payment_count}")
            self.stdout.write(f"   Total amount: {total_amount} TK")
            
            if not dry_run:
                # Get all payments for this group
                payments = ServiceFeePayment.objects.filter(
                    unit_id=unit_id,
                    service_fee_id=service_fee_id,
                    service_period_month=month,
                    service_period_year=year,
                    payment_status='completed',
                    service_status='partial'
                ).order_by('created_at')
                
                # Keep the first payment, delete the rest
                first_payment = payments.first()
                other_payments = payments.exclude(id=first_payment.id)
                
                # Update the first payment with total amount
                from decimal import Decimal
                first_payment.amount = Decimal(str(total_amount))
                first_payment.notes = f"Consolidated payment for {month}/{year} (was {payment_count} separate payments)"
                first_payment.save()
                
                # Delete other payments
                deleted_count = other_payments.count()
                other_payments.delete()
                
                self.stdout.write(f"   ✅ Consolidated into payment ID {first_payment.id}")
                self.stdout.write(f"   🗑️  Deleted {deleted_count} duplicate payments")
            else:
                self.stdout.write(f"   Would consolidate {payment_count} payments into one")
        
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f"\n✅ Consolidation completed!"))
        else:
            self.stdout.write(self.style.WARNING(f"\n🔍 Run without --dry-run to apply changes"))
