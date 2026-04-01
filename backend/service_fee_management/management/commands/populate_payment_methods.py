"""
Management command to populate initial payment methods
"""
from django.core.management.base import BaseCommand
from service_fee_management.models import PaymentMethod


class Command(BaseCommand):
    help = 'Populate initial payment methods'

    def handle(self, *args, **kwargs):
        from django.db import connection
        
        # Delete all existing payment methods using raw SQL to bypass FK constraints
        with connection.cursor() as cursor:
            # Get count before delete
            cursor.execute('SELECT COUNT(*) FROM service_fee_payment_methods;')
            deleted_count = cursor.fetchone()[0]
            
            if deleted_count > 0:
                # Disable foreign key checks
                cursor.execute('SET FOREIGN_KEY_CHECKS=0;')
                
                # Delete all payment methods with raw SQL
                cursor.execute('DELETE FROM service_fee_payment_methods;')
                
                # Reset auto increment
                cursor.execute('ALTER TABLE service_fee_payment_methods AUTO_INCREMENT = 1;')
                
                # Re-enable foreign key checks
                cursor.execute('SET FOREIGN_KEY_CHECKS=1;')
                
                self.stdout.write(
                    self.style.WARNING(f'Force deleted {deleted_count} existing payment methods')
                )
        
        payment_methods = [
            {
                'id': 1,
                'method_name': 'Cash',
                'display_order': 1,
                'description': 'Cash payment',
                'account_name': 'Cash on Hand',
                'account_code': '1111'
            },
            {
                'id': 2,
                'method_name': 'bKash',
                'display_order': 2,
                'description': 'bKash mobile financial service',
                'account_name': 'Mobile Banking Services',
                'account_code': '1125'
            },
            {
                'id': 3,
                'method_name': 'Nagad',
                'display_order': 3,
                'description': 'Nagad mobile financial service',
                'account_name': 'Mobile Banking Services',
                'account_code': '1125'
            },
            {
                'id': 4,
                'method_name': 'Rocket',
                'display_order': 4,
                'description': 'Rocket mobile financial service',
                'account_name': 'Mobile Banking Services',
                'account_code': '1125'
            },
            {
                'id': 5,
                'method_name': 'SSLCommerz',
                'display_order': 5,
                'description': 'SSLCommerz payment gateway',
                'account_name': 'N/A Account',
                'account_code': '1122'
            },
            {
                'id': 6,
                'method_name': 'Bank Transfer',
                'display_order': 6,
                'description': 'Bank transfer payment',
                'account_name': 'Bank Account',
                'account_code': '1121'
            },
        ]

        from service_fee_management.utils.voucher_generator import get_or_create_item_account
        from accounts.models import Account

        created_count = 0

        for method_data in payment_methods:
            # Resolve account
            account = Account.objects.filter(accountCode=method_data['account_code']).first()
            if not account:
                account = get_or_create_item_account(
                    method_data['account_name'],
                    account_type='asset',
                    default_entry_type='debit'
                )
            
            method = PaymentMethod.objects.create(
                id=method_data['id'],
                method_name=method_data['method_name'],
                display_order=method_data['display_order'],
                description=method_data.get('description', ''),
                default_account=account,
                is_active=True
            )
            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Created payment method: {method.method_name} linked to account {account.accountName}')
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nSummary: Created {created_count} new payment methods with fresh data'
            )
        )
