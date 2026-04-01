"""
Management command to manually apply existing advance payments to unpaid bills.
This is useful for one-time migration or fixing existing data.

Usage:
    python manage.py apply_existing_advances
    python manage.py apply_existing_advances --unit-id=123
    python manage.py apply_existing_advances --account-holder-id=456 --account-holder-type=owner
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from service_fee_management.models import AdvancePayment
from service_fee_management.utils.advance_payment_applicator import apply_advance_to_existing_bills
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Apply existing advance payments to unpaid bills'

    def add_arguments(self, parser):
        parser.add_argument(
            '--unit-id',
            type=int,
            help='Apply advances for a specific unit ID only'
        )
        parser.add_argument(
            '--account-holder-id',
            type=int,
            help='Apply advances for a specific account holder ID only'
        )
        parser.add_argument(
            '--account-holder-type',
            type=str,
            default='owner',
            choices=['owner', 'resident'],
            help='Account holder type (default: owner)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes'
        )

    def handle(self, *args, **options):
        unit_id = options.get('unit_id')
        account_holder_id = options.get('account_holder_id')
        account_holder_type = options.get('account_holder_type', 'owner')
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN MODE - No changes will be made'))

        # Query for available advances
        advances_query = AdvancePayment.objects.filter(
            status__in=['available', 'partial']
        )

        if unit_id:
            advances_query = advances_query.filter(unit_id=unit_id)
        
        if account_holder_id:
            advances_query = advances_query.filter(
                account_holder_id=account_holder_id,
                account_holder_type=account_holder_type
            )

        advances = advances_query.select_related('unit').order_by('unit_id', 'created_at')

        if not advances.exists():
            self.stdout.write(self.style.WARNING('No available advances found'))
            return

        self.stdout.write(self.style.SUCCESS(f'Found {advances.count()} advance payment(s) to process'))

        # Group advances by unit and account holder
        advance_groups = {}
        for advance in advances:
            key = (advance.unit_id, advance.account_holder_id, advance.account_holder_type)
            if key not in advance_groups:
                advance_groups[key] = []
            advance_groups[key].append(advance)

        self.stdout.write(f'\nProcessing {len(advance_groups)} unit(s)...\n')

        total_applied = 0
        total_bills_updated = 0

        for (unit_id, acc_holder_id, acc_holder_type), unit_advances in advance_groups.items():
            total_advance = sum(adv.remaining_amount for adv in unit_advances)
            
            self.stdout.write(
                f'\n📋 Unit ID {unit_id}, Account Holder {acc_holder_id} ({acc_holder_type}): '
                f'৳{total_advance} in advances'
            )

            if dry_run:
                self.stdout.write(self.style.WARNING('   [DRY RUN] Would apply advances to unpaid bills'))
                continue

            # Apply advances
            try:
                result = apply_advance_to_existing_bills(
                    unit_id=unit_id,
                    account_holder_id=acc_holder_id,
                    account_holder_type=acc_holder_type
                )

                if result['success']:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'   ✅ {result["message"]}\n'
                            f'      Applied: ৳{result["total_applied"]}\n'
                            f'      Bills Updated: {result["bills_updated"]}\n'
                            f'      Remaining: ৳{result.get("remaining_advance", 0)}'
                        )
                    )
                    total_applied += result['total_applied']
                    total_bills_updated += result['bills_updated']
                else:
                    self.stdout.write(
                        self.style.ERROR(
                            f'   ❌ Error: {result.get("error", "Unknown error")}'
                        )
                    )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'   ❌ Exception: {str(e)}')
                )
                logger.error(f'Error applying advances for unit {unit_id}: {str(e)}', exc_info=True)

        # Summary
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN COMPLETE - No changes were made'))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✅ COMPLETE\n'
                    f'   Total Applied: ৳{total_applied}\n'
                    f'   Bills Updated: {total_bills_updated}\n'
                )
            )
