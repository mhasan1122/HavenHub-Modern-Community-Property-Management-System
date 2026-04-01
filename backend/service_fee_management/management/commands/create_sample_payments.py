from django.core.management.base import BaseCommand
from service_fee.models import ServiceFee, ServiceFeePayment
from user.models import Member
from towers.models import Unit
from decimal import Decimal
import random
import datetime


class Command(BaseCommand):
    help = 'Create sample payment data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=20,
            help='Number of sample payments to create',
        )

    def handle(self, *args, **options):
        count = options['count']
        
        # Get available data
        service_fees = list(ServiceFee.objects.filter(is_active=True))
        members = list(Member.objects.all())
        units = list(Unit.objects.all())
        
        if not service_fees:
            self.stdout.write(
                self.style.ERROR('No active service fees found. Please create at least one service fee first.')
            )
            return
            
        if not members:
            self.stdout.write(
                self.style.ERROR('No members found. Please create at least one member first.')
            )
            return
            
        if not units:
            self.stdout.write(
                self.style.ERROR('No units found. Please create at least one unit first.')
            )
            return

        payment_methods = ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'sslcommerz']
        payment_statuses = ['pending', 'completed', 'failed']
        
        created_count = 0
        
        for i in range(count):
            try:
                service_fee = random.choice(service_fees)
                resident = random.choice(members)
                unit = random.choice(units)
                
                # Create payment with random data
                payment = ServiceFeePayment.objects.create(
                    service_fee=service_fee,
                    resident=resident,
                    unit=unit,
                    amount=Decimal(str(random.uniform(5000, 15000))).quantize(Decimal('0.01')),
                    currency='BDT',
                    payment_method=random.choice(payment_methods),
                    payment_status=random.choice(payment_statuses),
                    due_date=datetime.date.today() + datetime.timedelta(days=random.randint(-30, 30)),
                    service_period_month=random.randint(1, 12),
                    service_period_year=random.choice([2024, 2025]),
                    reference_number=f'REF{random.randint(100000, 999999)}',
                    notes=f'Sample payment {i+1}',
                    created_by=resident
                )
                
                created_count += 1
                
                if created_count % 5 == 0:
                    self.stdout.write(f'Created {created_count} payments...')
                    
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'Failed to create payment {i+1}: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} sample payments')
        )
