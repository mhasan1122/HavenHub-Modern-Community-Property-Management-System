"""
Management command to recalculate all account balances from posted voucher entries.
This command should be run after implementing the balance calculation feature
to update existing account balances.

Usage:
    python manage.py recalculate_account_balances
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import Account


class Command(BaseCommand):
    help = 'Recalculate all account balances from posted voucher entries'

    def add_arguments(self, parser):
        parser.add_argument(
            '--account-id',
            type=int,
            help='Recalculate balance for a specific account ID only',
        )
        parser.add_argument(
            '--account-type',
            type=str,
            choices=['asset', 'liability', 'equity', 'revenue', 'expense'],
            help='Recalculate balances for accounts of a specific type only',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        account_id = options.get('account_id')
        account_type = options.get('account_type')

        # Build the queryset
        queryset = Account.objects.all()

        if account_id:
            queryset = queryset.filter(id=account_id)
            self.stdout.write(f'Recalculating balance for account ID: {account_id}')
        elif account_type:
            queryset = queryset.filter(accountType=account_type)
            self.stdout.write(f'Recalculating balances for all {account_type} accounts')
        else:
            self.stdout.write('Recalculating balances for all accounts')

        total_accounts = queryset.count()
        updated_count = 0
        error_count = 0

        self.stdout.write(f'Found {total_accounts} account(s) to process\n')

        for account in queryset:
            try:
                old_balance = account.currentBalance
                new_balance = account.recalculate_balance()
                
                if old_balance != new_balance:
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ {account.accountCode} - {account.accountName}: '
                            f'{old_balance} → {new_balance}'
                        )
                    )
                else:
                    self.stdout.write(
                        f'  {account.accountCode} - {account.accountName}: '
                        f'{new_balance} (no change)'
                    )
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Error updating {account.accountCode} - {account.accountName}: {str(e)}'
                    )
                )

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(f'\nRecalculation complete!'))
        self.stdout.write(f'Total accounts processed: {total_accounts}')
        self.stdout.write(self.style.SUCCESS(f'Accounts updated: {updated_count}'))
        
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'Errors encountered: {error_count}'))
        else:
            self.stdout.write(self.style.SUCCESS('No errors encountered'))
