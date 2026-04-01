"""
Management command to fix incorrect payment_result_status values in ServiceFeeBilling records
"""
from django.core.management.base import BaseCommand
from django.db.models import Sum
from service_fee_management.models import ServiceFeeBilling, ServiceFeePayment
from decimal import Decimal


class Command(BaseCommand):
    help = 'Fix incorrect payment_result_status values for all billing records'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n' + '='*80))
        self.stdout.write(self.style.SUCCESS('FIXING PAYMENT RESULT STATUS FOR ALL BILLING RECORDS'))
        self.stdout.write(self.style.SUCCESS('='*80 + '\n'))

        # Get all billing records that have a related payment
        billings = ServiceFeeBilling.objects.filter(
            servicefeepaymentid__isnull=False,
            payment_type='service_fee_bill_payment'
        ).order_by('servicefeepaymentid', 'created_at')

        total_checked = 0
        total_fixed = 0
        
        # Group by payment to process in order
        current_payment_id = None
        cumulative_total = Decimal('0')
        
        for billing in billings:
            total_checked += 1
            payment = billing.servicefeepaymentid
            
            # Reset cumulative total when we move to a new payment
            if current_payment_id != payment.id:
                current_payment_id = payment.id
                # Calculate cumulative total from all previous billings for this payment
                cumulative_total = ServiceFeeBilling.objects.filter(
                    servicefeepaymentid=payment,
                    created_at__lt=billing.created_at
                ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
            
            # Add this billing's amount to cumulative total
            cumulative_total += billing.total_paid
            
            # Get the bill amount (use payment.amount as the total bill)
            bill_amount = payment.amount
            
            # Calculate correct payment_result_status
            if cumulative_total >= bill_amount:
                correct_status = 'full'
            else:
                correct_status = 'partial'
            
            # Check if it needs updating
            if billing.payment_result_status != correct_status:
                old_status = billing.payment_result_status
                billing.payment_result_status = correct_status
                billing.save(update_fields=['payment_result_status'])
                
                total_fixed += 1
                self.stdout.write(
                    f"✅ Fixed {billing.transaction_id}: "
                    f"{old_status} → {correct_status} "
                    f"(Paid: {cumulative_total}/{bill_amount})"
                )
        
        self.stdout.write(self.style.SUCCESS('\n' + '='*80))
        self.stdout.write(self.style.SUCCESS(f'SUMMARY:'))
        self.stdout.write(self.style.SUCCESS(f'  Total records checked: {total_checked}'))
        self.stdout.write(self.style.SUCCESS(f'  Total records fixed: {total_fixed}'))
        self.stdout.write(self.style.SUCCESS('='*80 + '\n'))
        
        if total_fixed > 0:
            self.stdout.write(self.style.SUCCESS(f'✅ Successfully fixed {total_fixed} billing records!'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All billing records already have correct status!'))
