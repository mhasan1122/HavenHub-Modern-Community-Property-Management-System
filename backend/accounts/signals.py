from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal
from .models import Account, VoucherEntry, VoucherEntryDetails, VoucherType


@receiver(pre_save, sender=Account)
def cache_original_opening_balance(sender, instance, **kwargs):
    """
    Cache the original opening balance values before save.
    Used by post_save to detect if opening balance changed.
    """
    if instance.pk:
        try:
            original = Account.objects.filter(pk=instance.pk).values(
                'openingDebit', 'openingCredit', 'accountName', 'accountCode', 'openingBalanceDate'
            ).first()
            if original is not None:
                instance._original_opening_debit = original['openingDebit']
                instance._original_opening_credit = original['openingCredit']
                instance._original_account_name = original['accountName']
                instance._original_account_code = original['accountCode']
                instance._original_opening_date = original['openingBalanceDate']
                return
        except Exception:
            pass
    instance._original_opening_debit = None
    instance._original_opening_credit = None
    instance._original_account_name = None
    instance._original_account_code = None
    instance._original_opening_date = None


@receiver(post_save, sender=Account)
def create_opening_balance_voucher(sender, instance, created, **kwargs):
    """
    Create a voucher entry when an account's opening balance is set or updated.
    This signal will automatically generate a journal voucher for the opening balance
    so it appears in the account ledger.
    
    Note: This uses a skip_signal flag to prevent duplicate signal triggering during
    account save operations that occur within the signal itself.
    """
    # Skip if this signal was triggered from within the signal itself
    if getattr(instance, '_skip_opening_balance_signal', False):
        return
    
    # For new accounts with opening balance
    if created and (instance.openingDebit != 0 or instance.openingCredit != 0):
        _create_opening_balance_voucher(instance)
    elif not created:
        # For existing accounts, check if any relevant field changed
        orig_debit = getattr(instance, '_original_opening_debit', None)
        orig_credit = getattr(instance, '_original_opening_credit', None)
        orig_name = getattr(instance, '_original_account_name', None)
        orig_code = getattr(instance, '_original_account_code', None)
        orig_date = getattr(instance, '_original_opening_date', None)

        curr_debit = Decimal(str(instance.openingDebit)) if instance.openingDebit else Decimal('0')
        curr_credit = Decimal(str(instance.openingCredit)) if instance.openingCredit else Decimal('0')
        orig_debit_val = Decimal(str(orig_debit)) if orig_debit is not None else None
        orig_credit_val = Decimal(str(orig_credit)) if orig_credit is not None else None

        opening_debit_changed = orig_debit_val is not None and orig_debit_val != curr_debit
        opening_credit_changed = orig_credit_val is not None and orig_credit_val != curr_credit
        name_changed = orig_name is not None and orig_name != instance.accountName
        code_changed = orig_code is not None and orig_code != instance.accountCode
        date_changed = orig_date is not None and orig_date != instance.openingBalanceDate

        if opening_debit_changed or opening_credit_changed or name_changed or code_changed or date_changed:
            _create_opening_balance_voucher(instance)


def _create_opening_balance_voucher(account):
    """
    Helper function to create or update a journal voucher for opening balance using openingDebit/openingCredit.
    This handles both new account creation and updates to existing accounts.
    """
    opening_debit = Decimal(str(account.openingDebit)) if account.openingDebit else Decimal('0')
    opening_credit = Decimal(str(account.openingCredit)) if account.openingCredit else Decimal('0')
    
    with transaction.atomic():
        # Get or create a dedicated 'Opening Balance' voucher type
        opening_balance_voucher_type, _ = VoucherType.objects.get_or_create(
            name='OpeningBalance',
            defaults={
                'displayName': 'Opening Balance Voucher',
                'description': 'Voucher for account seeding / opening balance',
                'prefix': 'OB'
            }
        )

        # Better lookup: find any Opening Balance voucher where this account is a detail
        # This is more reliable than searching by voucher number string
        existing_voucher = VoucherEntry.objects.filter(
            voucherType=opening_balance_voucher_type,
            details__account=account
        ).distinct().first()

        # If balance is now zero, remove the voucher if it exists
        if opening_debit == 0 and opening_credit == 0:
            if existing_voucher:
                existing_voucher.delete()
            return

        # Generate a standard voucher number
        # Use a stable year part: the year of the opening balance date or account creation
        ref_date = account.openingBalanceDate or (account.createdAt.date() if account.createdAt else datetime.now().date())
        year_part = ref_date.strftime('%Y')
        prefix = opening_balance_voucher_type.prefix
        voucher_number = f'{prefix}-{year_part}-{account.accountCode}'
        
        if existing_voucher:
            voucher_entry = existing_voucher
            # Delete existing details to recreate them (safest way to handle account/amount changes)
            VoucherEntryDetails.objects.filter(voucherEntry=voucher_entry).delete()
            # Update header info
            voucher_entry.entryDate = account.openingBalanceDate or (account.createdAt.date() if account.createdAt else datetime.now().date())
            voucher_entry.voucherNumber = voucher_number # Update number if code or year changed
            voucher_entry.narration = f'Opening balance for account {account.accountName}'
            voucher_entry.status = 'posted'
            voucher_entry.save()
        else:
            # Create a new journal voucher entry
            # Ensure the number is unique by checking for collision (unlikely with this format)
            if VoucherEntry.objects.filter(voucherNumber=voucher_number).exists():
                # Append a small random or ID part if collision
                import uuid
                voucher_number = f'{voucher_number}-{str(uuid.uuid4())[:4]}'

            voucher_entry = VoucherEntry.objects.create(
                voucherType=opening_balance_voucher_type,
                voucherNumber=voucher_number,
                entryDate=account.openingBalanceDate or (account.createdAt.date() if account.createdAt else datetime.now().date()),
                narration=f'Opening balance for account {account.accountName}',
                status='posted'
            )

        # Get opening balance equity account
        opening_equity_account = _get_opening_balance_equity_account()
        
        # Create voucher details (Line items)
        if opening_debit > 0:
            VoucherEntryDetails.objects.create(
                voucherEntry=voucher_entry,
                lineNumber=1,
                account=account,
                debitAmount=opening_debit,
                creditAmount=Decimal('0')
            )
            VoucherEntryDetails.objects.create(
                voucherEntry=voucher_entry,
                lineNumber=2,
                account=opening_equity_account,
                debitAmount=Decimal('0'),
                creditAmount=opening_debit
            )
        elif opening_credit > 0:
            VoucherEntryDetails.objects.create(
                voucherEntry=voucher_entry,
                lineNumber=1,
                account=account,
                debitAmount=Decimal('0'),
                creditAmount=opening_credit
            )
            VoucherEntryDetails.objects.create(
                voucherEntry=voucher_entry,
                lineNumber=2,
                account=opening_equity_account,
                debitAmount=opening_credit,
                creditAmount=Decimal('0')
            )

        # Re-calculate and save totals
        voucher_entry.calculate_totals()
        
        # Set flag to prevent recursive signal triggering if needed (though not currently used in Account.save)
        account._skip_opening_balance_signal = True


def _get_opening_balance_equity_account():
    """
    Get or create a default opening balance equity account.
    This is a placeholder account used to balance opening balance entries.
    """
    from django.core.exceptions import ValidationError
    
    # Try to get an existing opening balance equity account
    opening_equity_account, created = Account.objects.get_or_create(
        accountCode='CAP-001',  # Default opening balance equity account code
        defaults={
            'accountName': 'Opening Balance Equity',
            'description': 'Account to balance opening balance entries',
            'accountType': 'equity',
            'isActive': True,
            'isSystemAccount': True
        }
    )
    
    return opening_equity_account