"""
Management command to check and fix payment method issues
"""
from django.core.management.base import BaseCommand
from service_fee_management.models import ServiceFeePayment, PaymentMethod


class Command(BaseCommand):
    help = 'Check payment records for missing payment methods and optionally fix them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Fix payments with missing payment methods by setting a default',
        )
        parser.add_argument(
            '--default-method',
            type=str,
            default='Cash',
            help='Default payment method name to use when fixing (default: Cash)',
        )

    def handle(self, *args, **kwargs):
        fix = kwargs['fix']
        default_method_name = kwargs['default_method']
        
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('PAYMENT METHOD CHECK'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        
        # Check PaymentMethod table
        self.stdout.write('\n1. Checking PaymentMethod table...')
        payment_methods = PaymentMethod.objects.all()
        self.stdout.write(f'   Total payment methods: {payment_methods.count()}')
        
        if payment_methods.count() == 0:
            self.stdout.write(self.style.ERROR('   ❌ No payment methods found!'))
            self.stdout.write(self.style.WARNING('   Run: python manage.py populate_payment_methods'))
            return
        
        for pm in payment_methods:
            self.stdout.write(f'   - ID: {pm.id}, Name: {pm.method_name}, Active: {pm.is_active}')
        
        # Check payments with NULL payment_method_id
        self.stdout.write('\n2. Checking payments with missing payment methods...')
        null_method_payments = ServiceFeePayment.objects.filter(payment_method_rel__isnull=True)
        total_payments = ServiceFeePayment.objects.count()
        
        self.stdout.write(f'   Total payments: {total_payments}')
        self.stdout.write(f'   Payments with NULL payment_method: {null_method_payments.count()}')
        
        if null_method_payments.count() == 0:
            self.stdout.write(self.style.SUCCESS('   ✅ All payments have payment methods set!'))
            
            # Show sample payments
            self.stdout.write('\n3. Sample payments with payment methods:')
            sample_payments = ServiceFeePayment.objects.select_related('payment_method_rel')[:5]
            for payment in sample_payments:
                method_name = payment.payment_method_rel.method_name if payment.payment_method_rel else 'NULL'
                self.stdout.write(f'   - Payment ID: {payment.id}, Method: {method_name}, Amount: {payment.amount}')
            return
        
        # Show sample payments with NULL method
        self.stdout.write(self.style.WARNING(f'   ⚠️ Found {null_method_payments.count()} payments without payment methods'))
        self.stdout.write('\n   Sample payments with NULL payment_method:')
        for payment in null_method_payments[:10]:
            self.stdout.write(f'   - Payment ID: {payment.id}, Transaction: {payment.transaction_id}, Amount: {payment.amount}')
        
        if fix:
            # Get or create default payment method
            try:
                default_method = PaymentMethod.objects.get(method_name=default_method_name)
            except PaymentMethod.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'   ❌ Payment method "{default_method_name}" not found!'))
                self.stdout.write(self.style.WARNING('   Available methods:'))
                for pm in payment_methods:
                    self.stdout.write(f'      - {pm.method_name}')
                return
            
            self.stdout.write(f'\n3. Fixing payments by setting payment_method to: {default_method.method_name}')
            updated_count = null_method_payments.update(payment_method_rel=default_method)
            self.stdout.write(self.style.SUCCESS(f'   ✅ Updated {updated_count} payments'))
        else:
            self.stdout.write('\n3. To fix these payments, run:')
            self.stdout.write(self.style.WARNING(f'   python manage.py check_payment_methods --fix --default-method="Cash"'))
        
        self.stdout.write(self.style.SUCCESS('\nDone!'))

