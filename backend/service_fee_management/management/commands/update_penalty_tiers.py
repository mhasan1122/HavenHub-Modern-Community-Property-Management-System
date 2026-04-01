"""
Management command to update penalty tiers for unpaid service fee payments
Run daily at 11:59:59 PM to check and update penalty tier status
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import datetime, timedelta
from service_fee_management.models import (
    ServiceFeePayment,
    ServiceFeePaymentLatePenaltyTier,
    ServiceFeeItem
)
from service_fee.models import LatePenaltyTier
from audit_trail.create_audit_trail import create_audit_trail
from decimal import Decimal


class Command(BaseCommand):
    help = 'Update penalty tiers for unpaid service fee payments based on days overdue'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(f'\n{"="*80}'))
        self.stdout.write(self.style.SUCCESS(f'Starting Penalty Tier Update - {timezone.now()}'))
        self.stdout.write(self.style.SUCCESS(f'{"="*80}\n'))

        # Process each payment independently so one failure doesn't roll back all others
        # (no outer atomic). Each payment has its own atomic block and error handling.
        # If one payment fails, we log it and continue with the rest.
        unpaid_payments = ServiceFeePayment.objects.filter(
            payment_status__in=['pending', 'partial'],
            late_penalty_enabled=True
        ).select_related(
            'service_fee', 'generation_config', 'unit'
        ).prefetch_related('items')

        total_processed = 0
        total_updated = 0
        total_created = 0
        total_failed = 0

        for payment in unpaid_payments:
            try:
                with transaction.atomic():
                    result = self.process_payment_penalty_tier(payment)
                    total_processed += 1
                    if result == 'updated':
                        total_updated += 1
                    elif result == 'created':
                        total_created += 1
            except Exception as e:
                total_failed += 1
                self.stdout.write(self.style.ERROR(
                    f'  Payment ID {payment.id}: error during tier update (skipped): {str(e)}'
                ))

        self.stdout.write(self.style.SUCCESS(f'\n{"="*80}'))
        self.stdout.write(self.style.SUCCESS(f'Penalty Tier Update Complete'))
        self.stdout.write(self.style.SUCCESS(f'{"="*80}'))
        self.stdout.write(self.style.SUCCESS(f'Total Payments Processed: {total_processed}'))
        self.stdout.write(self.style.SUCCESS(f'Penalty Tiers Created: {total_created}'))
        self.stdout.write(self.style.SUCCESS(f'Penalty Tiers Updated: {total_updated}'))
        self.stdout.write(self.style.WARNING(f'Total Payments Failed (skipped due to errors): {total_failed}'))
        self.stdout.write(self.style.SUCCESS(f'{"="*80}\n'))

    def process_payment_penalty_tier(self, payment):
        """
        Process a single payment and update its penalty tier status
        Returns: 'created', 'updated', or 'skipped'
        """
        try:
            # Calculate days overdue based on due_date
            today = timezone.now().date()
            due_date = payment.due_date

            if today <= due_date:
                # Not overdue yet
                return 'skipped'

            # Calculate days overdue (inclusive count from due date)
            # MATCH GENERATOR LOGIC: Exact difference, no +1
            days_overdue = (today - due_date).days

            # Get all penalty tiers for this payment from snapshot table
            # (All tiers were saved at generation time)
            payment_tiers = list(ServiceFeePaymentLatePenaltyTier.objects.filter(
                payment_id=payment.id
            ).order_by('days_overdue'))

            if not payment_tiers:
                # No tiers found (shouldn't happen if generated correctly)
                return 'skipped'

            # Threshold-based tier activation logic:
            # Sort tiers in DESCENDING order of days_overdue
            # Pick the first tier where days_overdue >= tier.days_overdue
            # Example: Tiers [1, 5]. Overdue 2.
            # Check 5: 2 >= 5? No.
            # Check 1: 2 >= 1? Yes -> Active Tier = 1.
            
            # Sort tiers descending (highest days first)
            payment_tiers.sort(key=lambda x: x.days_overdue, reverse=True)
            
            applicable_tier = None
            
            self.stdout.write(f'  Payment {payment.id}: {days_overdue} days overdue, checking {len(payment_tiers)} tiers (Descending)')
            for tier in payment_tiers:
                self.stdout.write(f'    Checking Tier: {tier.days_overdue} days = {tier.penalty_percentage}%')
                
                if days_overdue >= tier.days_overdue:
                    applicable_tier = tier
                    self.stdout.write(f'    → MATCHED tier: {tier.days_overdue} days ({days_overdue} >= {tier.days_overdue})')
                    break
                else:
                    self.stdout.write(f'    Skipped tier: {tier.days_overdue} days ({days_overdue} < {tier.days_overdue})')

            if not applicable_tier:
                self.stdout.write(f'    ❌ No applicable tier found for {days_overdue} days!')
                return 'skipped'

            # Check if this tier is already active
            # We DO NOT return 'skipped' here anymore because we must ensure:
            # 1. The ServiceFeeItem amount matches the tier (rounding might have changed)
            # 2. The Voucher is synchronized
            if applicable_tier.status == 'active':
                self.stdout.write(f'    ℹ️  Tier {applicable_tier.days_overdue} already active - proceeding to verify amounts/vouchers')


            # Deactivate all existing tiers for this payment
            ServiceFeePaymentLatePenaltyTier.objects.filter(
                payment_id=payment.id
            ).update(status='inactive')

            # Activate the applicable tier
            ServiceFeePaymentLatePenaltyTier.objects.filter(
                payment_id=payment.id,
                days_overdue=applicable_tier.days_overdue
            ).update(
                status='active',
                updated_at=timezone.now()
            )
            
            # Refresh the tier object to get updated data
            applicable_tier.refresh_from_db()

            # Calculate new penalty amount
            # CRITICAL: Always use base_service_amount, NEVER payment.amount
            # payment.amount now includes penalty, so using it would compound the penalty
            base_amount = payment.base_service_amount
            
            if not base_amount or base_amount == 0:
                self.stdout.write(self.style.WARNING(f'    ⚠️  Payment {payment.id} has no base_service_amount - skipping'))
                return 'skipped'
            
            raw_penalty_amount = (Decimal(str(base_amount)) * applicable_tier.penalty_percentage) / 100
            new_penalty_amount = round(raw_penalty_amount, 0)
            
            self.stdout.write(f'    Penalty calculation: {base_amount} × {applicable_tier.penalty_percentage}% = ৳{new_penalty_amount} (Rounded)')

            # Get old penalty amount (if exists)
            old_penalty = ServiceFeeItem.objects.filter(
                service_fee_payment=payment,
                item_type='penalty'
            ).first()
            old_penalty_amount = old_penalty.amount if old_penalty else Decimal('0')

            # Update or create penalty item in ServiceFeeItem
            penalty_item, item_created = ServiceFeeItem.objects.update_or_create(
                service_fee_payment=payment,
                item_type='penalty',
                defaults={
                    'item_name': 'Late Fee',
                    'amount': new_penalty_amount,
                    'penalty_tier': applicable_tier,  # Link the active tier snapshot
                    'description': f'Late penalty ({applicable_tier.penalty_percentage}%) - {days_overdue} days overdue'
                }
            )
            
            # Create audit trail for penalty item update
            try:
                if not item_created:
                    create_audit_trail(
                        None,
                        event_type='ITEM_UPDATED',
                        table_name='service_fee_management_servicefeeitem',
                        row_id=penalty_item.id,
                        old_data={
                            'item_type': 'penalty',
                            'amount': str(old_penalty_amount),
                            'item_name': 'Late Fee',
                            'description': penalty_item.description  # Old description
                        },
                        new_data={
                            'item_type': 'penalty',
                            'amount': str(new_penalty_amount),
                            'item_name': 'Late Fee',
                            'description': f'Late penalty ({applicable_tier.penalty_percentage}%) - {days_overdue} days overdue'
                        },
                        description=f'Penalty tier update: {days_overdue} days overdue, tier {applicable_tier.days_overdue} ({applicable_tier.penalty_percentage}%)'
                    )
            except Exception as audit_e:
                self.stdout.write(
                    self.style.WARNING(
                        f'    ⚠️  Failed to create audit trail for penalty item: {str(audit_e)}'
                    )
                )

            # Update ServiceFeePayment amount and remaining_amount
            # Calculate NEW total from all ServiceFeeItems (base_fee + bill_categories + penalty)
            from django.db.models import Sum
            total_from_items = ServiceFeeItem.objects.filter(
                service_fee_payment=payment
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

            # Get actual paid amount from allocations
            from service_fee_management.models import ServiceFeePaymentAllocation
            paid_amount = ServiceFeePaymentAllocation.objects.filter(
                service_fee_billing__servicefeepaymentid_id=payment.id
            ).aggregate(total=Sum('allocated_amount'))['total'] or Decimal('0')

            # Update payment amounts with NEW values
            payment.amount = total_from_items
            payment.remaining_amount = max(Decimal('0'), total_from_items - paid_amount)
            
            # Update tracking fields
            # Get total paid from billing records
            from service_fee_management.models import ServiceFeeBilling, PenaltyWaiver
            total_paid_from_billings = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=payment
            ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
            
            # Get total waivers
            total_waived = PenaltyWaiver.objects.filter(
                billing__servicefeepaymentid=payment
            ).aggregate(total=Sum('waived_amount'))['total'] or Decimal('0')
            
            # Calculate net penalty (gross - waivers)
            net_penalty = max(Decimal('0'), new_penalty_amount - total_waived)
            
            # Update tracking fields
            payment.total_paid = total_paid_from_billings
            payment.penalty_amount = net_penalty  # Net penalty after waivers
            payment.waived_amount = total_waived
            payment.gross_penalty_amount = new_penalty_amount  # Gross penalty before waivers
            
            # Update service_status based on actual payments made
            # IMPORTANT: Use total_paid_from_billings (actual cash/advance paid) NOT remaining_amount comparison.
            # remaining_amount < amount is NOT reliable because payment.amount grows when penalties are added —
            # a bill with zero cash paid but a new penalty would incorrectly show as 'partial'.
            old_status = payment.service_status
            old_amount = payment.amount
            old_remaining = payment.remaining_amount

            if payment.remaining_amount <= 0:
                # Fully cleared
                payment.service_status = 'paid'
            elif total_paid_from_billings > 0:
                # Some cash/advance has been paid → always 'partial', never 'overdue'
                payment.service_status = 'partial'
            else:
                # Zero payment made → check if past due date
                if today > payment.due_date:
                    payment.service_status = 'overdue'
                else:
                    payment.service_status = 'due'
            
            payment.save(update_fields=[
                'amount', 'remaining_amount', 'service_status',
                'total_paid', 'penalty_amount', 'waived_amount', 'gross_penalty_amount'
            ])
            
            status_changed = old_status != payment.service_status
            if status_changed:
                self.stdout.write(f'    📊 Status changed: {old_status} → {payment.service_status}')
            
            # Create audit trail for payment update
            try:
                create_audit_trail(
                    None,
                    event_type='PAYMENT_UPDATED',
                    table_name='service_fee_management_servicefeepayment',
                    row_id=payment.id,
                    old_data={
                        'amount': str(old_amount),
                        'remaining_amount': str(old_remaining),
                        'service_status': old_status,
                        'penalty_amount': str(payment.penalty_amount - (new_penalty_amount - old_penalty_amount)),
                        'gross_penalty_amount': str(payment.gross_penalty_amount - (new_penalty_amount - old_penalty_amount))
                    },
                    new_data={
                        'amount': str(payment.amount),
                        'remaining_amount': str(payment.remaining_amount),
                        'service_status': payment.service_status,
                        'penalty_amount': str(payment.penalty_amount),
                        'gross_penalty_amount': str(payment.gross_penalty_amount),
                        'penalty_tier_days_overdue': applicable_tier.days_overdue,
                        'penalty_tier_percentage': applicable_tier.penalty_percentage
                    },
                    description=f'Automatic penalty tier update: {days_overdue} days overdue, penalty increased from ৳{old_penalty_amount} to ৳{new_penalty_amount}'
                )
            except Exception as audit_e:
                self.stdout.write(
                    self.style.WARNING(
                        f'    ⚠️  Failed to create audit trail for payment update: {str(audit_e)}'
                    )
                )

            # ======================================================
            # UPDATE VOUCHER ENTRIES (Item-wise synchronization)
            # ======================================================
            penalty_difference = new_penalty_amount - old_penalty_amount
            
            from accounts.models import VoucherEntry, VoucherEntryDetails, Account, DefaultAccountHead
            from service_fee_management.utils.voucher_generator import get_or_create_item_account
            
            # Find existing voucher for this payment (reference_number = ServiceFeePayment.id)
            voucher = VoucherEntry.objects.filter(
                referenceNumber=str(payment.id),
                voucherType__name='ServiceFeeBill',
                status='draft'
            ).first()
            
            # Check if sync is needed:
            # 1. Penalty amount changed in this run
            # 2. Voucher exists but total doesn't match payment.amount
            # 3. Voucher details (lines) don't sum up to the total (Fix for stale lines)
            sync_needed = (penalty_difference != 0)
            
            if voucher:
                 # Check Header mismatch
                 if voucher.totalDebit != payment.amount:
                     sync_needed = True
                     self.stdout.write(f'    ⚠️  Voucher header total (৳{voucher.totalDebit}) mismatch with bill (৳{payment.amount}) - Forcing sync.')
                 
                 # Check Details mismatch (Sum of all lines)
                 current_detail_total = voucher.details.aggregate(total=Sum('creditAmount'))['total'] or Decimal('0')
                 # Allow small floating point difference
                 if abs(current_detail_total - payment.amount) > Decimal('0.1'):
                     sync_needed = True
                     self.stdout.write(f'    ⚠️  Voucher lines total (৳{current_detail_total}) mismatch with bill (৳{payment.amount}) - Forcing sync.')

            if sync_needed:
                if voucher:
                    self.stdout.write(f'    📋 Synchronizing voucher: {voucher.voucherNumber} (Draft)')
                    
                    # Store old values for audit
                    old_voucher_debit = voucher.totalDebit
                    old_voucher_credit = voucher.totalCredit
                    old_narration = voucher.narration
                    
                    # 1. Update Voucher Header
                    month_year = f"{payment.service_period_month}/{payment.service_period_year}"
                    voucher.totalDebit = payment.amount
                    voucher.totalCredit = payment.amount
                    voucher.narration = (
                        f"Service fee bill for {payment.unit.unit_name} - {month_year} "
                        f"(Penalty updated to {applicable_tier.penalty_percentage}%: ৳{new_penalty_amount})"
                    )
                    voucher.save()

                    # 2. Get standard accounts using the helper logic
                    # Accounts Receivable (Debit side)
                    accounts_receivable = get_or_create_item_account(
                        "Accounts Receivable",
                        account_type='asset',
                        transaction_key='service_fee_receivable',
                        default_entry_type='debit'
                    )
                    
                    # Service Fee Revenue (Default fallback)
                    service_fee_revenue_account = get_or_create_item_account(
                        "Monthly Service Fee Income",
                        account_type='revenue',
                        transaction_key='service_fee_income',
                        default_entry_type='credit'
                    )
                    
                    # Late Fee Income
                    late_fee_income_account = get_or_create_item_account(
                        "Late Fee Income",
                        account_type='revenue',
                        transaction_key='late_fee_income',
                        default_entry_type='credit'
                    )

                    # 3. Synchronize detail lines item-wise
                    # Delete existing details to ensure clean item-wise mapping
                    VoucherEntryDetails.objects.filter(voucherEntry=voucher).delete()
                    
                    details_to_create = []
                    
                    # Line 1: DEBIT Accounts Receivable (Total Bill Amount)
                    if accounts_receivable:
                        details_to_create.append(VoucherEntryDetails(
                            voucherEntry=voucher,
                            lineNumber=1,
                            account=accounts_receivable,
                            description=f"Bill receivable - Service fee from {payment.unit.unit_name} ({month_year})",
                            debitAmount=float(payment.amount),
                            creditAmount=0
                        ))
                    
                    # Line 2..N: CREDIT items from ServiceFeeItem
                    # USE FRESH QUERY - Do not use payment.items.all() as it is pre-fetched and STALE
                    payment_items = ServiceFeeItem.objects.filter(service_fee_payment=payment)
                    line_num = 2
                    for item in payment_items:
                        account_to_use = service_fee_revenue_account
                        item_name = item.item_name or item.item_type
                        
                        # Determine correct account for the item
                        if item.item_type == 'base_fee':
                            account_to_use = service_fee_revenue_account
                        elif item.item_type == 'penalty':
                            account_to_use = late_fee_income_account
                        elif item.item_type == 'bill_category':
                            # Use the linked head from BillCategory if available
                            if item.bill_category and item.bill_category.default_account_head:
                                account_to_use = item.bill_category.default_account_head.defaultAccount
                            else:
                                # Fallback to key-based lookup/creation
                                cat_name = item.bill_category.name if item.bill_category else item.item_name
                                cat_slug = cat_name.lower().replace(' ', '_').replace('-', '_')
                                trans_key = f"utility_income_{cat_slug}"
                                account_to_use = get_or_create_item_account(
                                    cat_name, 
                                    transaction_key=trans_key
                                )
                        
                        if not account_to_use:
                            account_to_use = service_fee_revenue_account
                            
                        details_to_create.append(VoucherEntryDetails(
                            voucherEntry=voucher,
                            lineNumber=line_num,
                            account=account_to_use,
                            description=f"{item_name} revenue - {payment.unit.unit_name} ({month_year})",
                            debitAmount=0,
                            creditAmount=float(item.amount or 0)
                        ))
                        line_num += 1
                    
                    for detail in details_to_create:
                        detail.entryDate = voucher.entryDate
                    
                    VoucherEntryDetails.objects.bulk_create(details_to_create)
                    
                    # Create audit trail for voucher update
                    try:
                        create_audit_trail(
                            None,
                            event_type='VOUCHER_UPDATED',
                            table_name='accounts_voucherentry',
                            row_id=voucher.id,
                            old_data={
                                'totalDebit': str(old_voucher_debit),
                                'totalCredit': str(old_voucher_credit),
                                'narration': old_narration
                            },
                            new_data={
                                'totalDebit': str(voucher.totalDebit),
                                'totalCredit': str(voucher.totalCredit),
                                'narration': voucher.narration
                            },
                            description=f'Voucher synchronized item-wise after penalty tier change. New total: ৳{payment.amount}'
                        )
                    except Exception as audit_e:
                        self.stdout.write(self.style.WARNING(f'    ⚠️  Audit trail failed: {str(audit_e)}'))
                    
                    self.stdout.write(self.style.SUCCESS(f'    ✅ Voucher {voucher.voucherNumber} synchronized item-wise.'))
                else:
                    self.stdout.write(self.style.WARNING(f'    ⚠️  No draft voucher found for payment ID {payment.id}'))
            else:
                self.stdout.write(f'    ℹ️  No penalty change - voucher update not needed')

            self.stdout.write(
                self.style.WARNING(
                    f'  Payment ID {payment.id} ({payment.service_period_month}/{payment.service_period_year}): '
                    f'Tier updated - {days_overdue} days overdue, '
                    f'{applicable_tier.penalty_percentage}% penalty = ৳{new_penalty_amount} '
                    f'(Old Penalty: ৳{old_penalty_amount}, New Total: ৳{payment.amount}, Remaining: ৳{payment.remaining_amount})'
                )
            )

            return 'updated'

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  Error processing payment ID {payment.id}: {str(e)}')
            )
            return 'skipped'
