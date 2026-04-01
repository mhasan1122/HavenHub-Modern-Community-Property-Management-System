"""
Utility function for creating vouchers when service fee bills are generated
Integrates with the service fee generation process
"""
import logging
import json
import calendar
from datetime import datetime
from django.db import transaction, DatabaseError
from django.db.models import Sum
from django.core.serializers.json import DjangoJSONEncoder
from accounts.models import VoucherEntry, VoucherType, VoucherEntryDetails, DefaultAccountHead, Account
from service_fee_management.models import PenaltyWaiver, ServiceFeeBilling
from audit_trail.create_audit_trail import create_audit_trail
from .owner_helper import get_primary_contract_owner

logger = logging.getLogger(__name__)


def _get_unit_primary_owner_id(unit):
    """Resolve primary owner id for a unit. Unit has no .owner; owners are via Owner.unit (owner_set)."""
    info = get_primary_contract_owner(unit)
    return info['owner_id'] if info else None



def get_or_create_payment_account(payment_method_obj, payment_method_id=None, created_by=None):
    """
    Smart function to get or create account heads for payment methods under CCE (1110).
    
    Logic:
    1. If PaymentMethod has default_account set, use it
    2. Search for existing account under CCE (1110) matching payment method name
    3. If not found, create new account under CCE (1110)
    4. Link the account to PaymentMethod.default_account
    
    Args:
        payment_method_obj: PaymentMethod instance (can be None)
        payment_method_id: Fallback payment method ID if obj is None
        created_by: Member instance for audit trail
    
    Returns:
        Account instance or None
    """
    try:
        from ..models import PaymentMethod
        
        # Get payment method object if not provided
        if not payment_method_obj and payment_method_id:
            payment_method_obj = PaymentMethod.objects.filter(id=payment_method_id).first()
        
        # If no payment method found, fallback to Cash
        if not payment_method_obj:
            logger.warning(f"Payment method not found (ID: {payment_method_id}), falling back to Cash")
            payment_method_obj = PaymentMethod.objects.filter(method_name__iexact='Cash').first()
            if not payment_method_obj:
                # Ultimate fallback - return Cash account
                return Account.objects.filter(accountCode='1111', isActive=True).first()
        
        # 1. Check if PaymentMethod already has default_account set
        if payment_method_obj.default_account:
            logger.info(f"✅ Using existing default_account for {payment_method_obj.method_name}: {payment_method_obj.default_account}")
            return payment_method_obj.default_account
        
        # 2. Get CCE parent account (1110 - Cash and Cash Equivalents)
        cce_parent = Account.objects.filter(accountCode='1110', isActive=True).first()
        if not cce_parent:
            logger.error("❌ CCE parent account (1110) not found! Cannot create payment accounts.")
            # Fallback: Try to find Cash on Hand (1111)
            return Account.objects.filter(accountCode='1111', isActive=True).first()
        
        # 3. Search for existing account under CCE matching payment method name
        payment_method_name = payment_method_obj.method_name
        
        # Special handling: "Cash" should map to "Cash on Hand"
        if payment_method_name.lower() == 'cash':
            cash_on_hand = Account.objects.filter(
                parentAccount=cce_parent,
                accountCode='1111',
                isActive=True
            ).first()
            if cash_on_hand:
                logger.info(f"✅ Mapping Cash to Cash on Hand: {cash_on_hand}")
                payment_method_obj.default_account = cash_on_hand
                payment_method_obj.save(update_fields=['default_account'])
                return cash_on_hand
        
        # Try exact match first
        existing_account = Account.objects.filter(
            parentAccount=cce_parent,
            accountName__iexact=payment_method_name,
            isActive=True
        ).first()
        
        if existing_account:
            logger.info(f"✅ Found existing account under CCE for {payment_method_name}: {existing_account}")
            # Link it to PaymentMethod for future use
            payment_method_obj.default_account = existing_account
            payment_method_obj.save(update_fields=['default_account'])
            return existing_account
        
        # 4. No exact match found - create new individual account for this payment method
        # Each payment method gets its own account (no grouping)
        logger.info(f"🆕 Creating new account under CCE for payment method: {payment_method_name}")
        
        # Generate new account code under 1110
        # Find the highest existing code under CCE
        last_sub_account = Account.objects.filter(
            parentAccount=cce_parent,
            accountCode__startswith='11'
        ).exclude(
            accountCode='1110'  # Exclude parent itself
        ).order_by('-accountCode').first()
        
        # Generate new code
        if last_sub_account and last_sub_account.accountCode.isdigit():
            try:
                new_code = str(int(last_sub_account.accountCode) + 1)
            except (ValueError, TypeError):
                new_code = '1126'  # Fallback
        else:
            new_code = '1126'  # Start from 1126 if no sub-accounts exist
        
        # Create new account
        new_account = Account.objects.create(
            accountCode=new_code,
            accountName=payment_method_name,
            accountType='asset',
            parentAccount=cce_parent,
            isActive=True,
            createdBy=created_by,
            description=f"Auto-generated payment account for {payment_method_name}"
        )
        
        logger.info(f"✅ Created new account: {new_code} - {payment_method_name}")
        
        # 6. Link the new account to PaymentMethod
        payment_method_obj.default_account = new_account
        payment_method_obj.save(update_fields=['default_account'])
        logger.info(f"✅ Linked {payment_method_name} to account {new_code}")
        
        # 7. Register in DefaultAccountHead for easy lookup
        DefaultAccountHead.objects.get_or_create(
            transactionType=f"payment_method_{payment_method_obj.id}",
            defaults={
                'customLabel': payment_method_name,
                'defaultAccount': new_account,
                'defaultEntryType': 'debit',  # Payment accounts are debited when money comes in
                'isActive': True,
                'createdBy': created_by
            }
        )
        
        return new_account
        
    except Exception as e:
        logger.error(f"❌ Error in get_or_create_payment_account: {str(e)}")
        import traceback
        traceback.print_exc()
        # Fallback to Cash on Hand (1111)
        return Account.objects.filter(accountCode='1111', isActive=True).first()


def get_or_create_item_account(item_name, account_type='revenue', parent_account=None, created_by=None, transaction_key=None, default_entry_type='credit'):
    """
    Helper to get or create an account for a specific item (e.g. Electricity, Water)
    and register it in DefaultAccountHead if a transaction_key is provided.
    """
    # 1. Check DefaultAccountHead first if key is provided
    if transaction_key:
        try:
            head = DefaultAccountHead.objects.filter(transactionType__iexact=transaction_key, isActive=True).first()
            if head:
                return head.defaultAccount
        except Exception:
            pass

    # 2. Check if Account exists by name (case insensitive)
    clean_name = f"{item_name}"
    account = Account.objects.filter(accountName__iexact=clean_name).first()
    
    # 3. If not found, create the Account and immediately add to DefaultAccountHead
    if not account:
        # Default parents based on account type if not provided
        if not parent_account:
            if account_type == 'revenue':
                parent_account = Account.objects.filter(accountCode='4100').first()
            elif account_type == 'asset':
                parent_account = Account.objects.filter(accountCode__in=['1100', '1000']).first()
            elif account_type == 'liability':
                parent_account = Account.objects.filter(accountCode__in=['2200', '2000']).first()
            
        # Generate a new code based on the parent
        base_code = "4150" # Default start for extra revenue
        if account_type == 'asset': base_code = "1130"
        elif account_type == 'liability': base_code = "2210"
        
        if parent_account:
            last_sub = Account.objects.filter(parentAccount=parent_account).order_by('-accountCode').first()
            if last_sub and last_sub.accountCode.isdigit():
                try:
                    base_code = str(int(last_sub.accountCode) + 1)
                except (ValueError, TypeError):
                    pass
        
        try:
            # Create the Account
            account = Account.objects.create(
                accountCode=base_code,
                accountName=clean_name,
                accountType=account_type,
                parentAccount=parent_account,
                isActive=True,
                createdBy=created_by,
                description=f"Auto-generated {account_type} account for {item_name}"
            )
            logger.info(f"Successfully created account {clean_name} ({base_code})")
        except Exception as e:
            logger.error(f"Failed to auto-create account {clean_name}: {str(e)}")
            # Fallback if creation fails (maybe code collision)
            account = Account.objects.filter(accountName__iexact=clean_name).first()

    # 4. Ensure DefaultAccountHead exists if key is provided
    if account and transaction_key:
        DefaultAccountHead.objects.get_or_create(
            transactionType=transaction_key,
            defaults={
                'customLabel': f"{item_name}",
                'defaultAccount': account,
                'defaultEntryType': default_entry_type,
                'isActive': True,
                'createdBy': created_by
            }
        )
        logger.info(f"Registered/Verified default head: {transaction_key} -> {account.accountName}")

    return account

    return account


def create_vouchers_for_generated_bills(payments, year, month, created_by=None):
    """
    Create receipt vouchers with double entry (debit/credit) for generated service fee payments
    One voucher per unit to maintain separation
    
    Args:
        payments: List of ServiceFeePayment objects or QuerySet
        year: Service period year
        month: Service period month
        created_by: User object who created the vouchers (optional)
    
    Returns:
        dict: {
            'success': bool,
            'created_count': int,
            'failed_count': int,
            'errors': list,
            'voucher_ids': list
        }
    """
    result = {
        'success': True,
        'created_count': 0,
        'failed_count': 0,
        'errors': [],
        'voucher_ids': []
    }
    
    try:
        # Get or create service fee generation voucher type
        receipt_type, created = VoucherType.objects.get_or_create(
            name='ServiceFeeBill',
            defaults={
                'displayName': 'Service Fee Bill',
                'description': 'Voucher for automatic service fee bill generation',
                'prefix': 'SFBG',
                'isActive': True
            }
        )
        
        # Get default accounts for service fee income and accounts receivable
        # 1. Service Fee Revenue account (Credit side when bill generated)
        service_fee_revenue_account = get_or_create_item_account(
            "Monthly Service Fee Income",
            account_type='revenue',
            transaction_key='service_fee_income',
            default_entry_type='credit'
        )
        
        # 2. Accounts Receivable account (Debit side when bill generated)
        accounts_receivable = get_or_create_item_account(
            "Accounts Receivable",
            account_type='asset',
            transaction_key='service_fee_receivable',
            default_entry_type='debit'
        )
        
        # 3. Late Fee Income Account (for Penalty credit)
        late_fee_income_account = get_or_create_item_account(
            "Late Fee Income",
            account_type='revenue',
            transaction_key='late_fee_income',
            default_entry_type='credit'
        ) or service_fee_revenue_account


        # Group payments by unit to create one voucher per unit
        units_processed = {}
        vouchers_to_create = []
        details_to_create = []
        
        # CRITICAL FIX: Query for last voucher sequence ONCE before the loop
        # to prevent duplicate voucher numbers when processing multiple units in same batch
        today = datetime.now()
        date_part = today.strftime('%Y%m%d')
        
        last_voucher = VoucherEntry.objects.filter(
            voucherNumber__startswith=f'{receipt_type.prefix}-{date_part}'
        ).order_by('-voucherNumber').first()
        
        if last_voucher:
            current_seq = int(last_voucher.voucherNumber.split('-')[-1])
        else:
            current_seq = 0
        
        for payment in payments:
            # Skip if no unit
            if not payment.unit:
                result['failed_count'] += 1
                result['errors'].append(f"Payment {payment.id} has no unit")
                continue
            
            unit_id = payment.unit.id
            
            # Skip if we already created voucher for this unit in this batch
            if unit_id in units_processed:
                continue
            
            units_processed[unit_id] = True
            
            try:
                # Increment sequence for each unit in the batch
                current_seq += 1
                voucher_number = f'{receipt_type.prefix}-{date_part}-{current_seq:04d}'
                
                # Create narration for the voucher
                month_year = datetime(year, month, 1).strftime('%B %Y')
                narration = f"Service fee bill for {payment.unit.unit_name} - {month_year}"
                
                # Format referenceNumber as the bill number (instead of payment.id)
                reference_number = payment.bill_number
                
                # Calculate bill amount
                bill_amount = float(payment.amount or 0)
                
                # Get payment method from payment object if available
                payment_method_id = getattr(payment, 'payment_method_id', None) or 1  # Default to Cash
                # Resolve account using smart function (Supersedes static mapping)
                payment_account_obj = get_or_create_payment_account(None, payment_method_id, created_by)
                
                # Create voucher with totals
                voucher = VoucherEntry(
                    voucherNumber=voucher_number,
                    entryDate=today.date(),
                    narration=narration,
                    referenceNumber=reference_number,
                    voucherType=receipt_type,
                    unit=payment.unit,
                    status='draft',
                    totalDebit=bill_amount,
                    totalCredit=bill_amount,
                    createdBy=created_by,  # Set the user who created this voucher
                    account_holder_type=getattr(payment, 'account_holder_type', 'owner'),
                    account_holder_id=getattr(payment, 'account_holder_id', payment.owner_id),
                )
                
                vouchers_to_create.append(voucher)
                
            except Exception as e:
                result['failed_count'] += 1
                result['errors'].append(f"Error creating voucher for unit {payment.unit.unit_name}: {str(e)}")
                logger.error(f"Error creating voucher for payment {payment.id}: {str(e)}")
        
        # Bulk create all vouchers
        if vouchers_to_create:
            with transaction.atomic():
                # Save each voucher individually to get the IDs
                created_vouchers = []
                for voucher in vouchers_to_create:
                    print(f"💾 Saving voucher {voucher.voucherNumber} with createdBy={voucher.createdBy}")
                    voucher.save()
                    print(f"✅ Voucher {voucher.voucherNumber} saved with ID={voucher.id}, createdBy={voucher.createdBy}")
                    created_vouchers.append(voucher)
                
                result['created_count'] = len(created_vouchers)
                result['voucher_ids'] = [v.id for v in created_vouchers]
                
                # Create double entry details for each voucher
                for voucher_idx, voucher in enumerate(created_vouchers):
                    payment = list(payments)[voucher_idx] if voucher_idx < len(list(payments)) else None
                    if not payment:
                        continue
                    
                    bill_amount = float(payment.amount or 0)
                    
                    # Line 1: DEBIT Accounts Receivable (bill generated, money owed)
                    if accounts_receivable:
                        debit_line = VoucherEntryDetails(
                            voucherEntry=voucher,
                            lineNumber=1,
                            account=accounts_receivable,
                            description=f"Bill receivable - Service fee from {payment.unit.unit_name} ({datetime(year, month, 1).strftime('%B %Y')})",
                            debitAmount=bill_amount,
                            creditAmount=0,
                            unit=payment.unit,
                            account_holder_type=getattr(payment, 'account_holder_type', 'owner'),
                            account_holder_id=getattr(payment, 'account_holder_id', payment.owner_id),
                        )
                        details_to_create.append(debit_line)
                    
                    # Credit lines: Use the breakdown from ServiceFeeItem
                    # Sort items to keep base fee first, then bill categories, then penalties
                    payment_items = list(payment.items.all())
                    if not payment_items:
                        # Fallback to single revenue line if no item breakdown found
                        if service_fee_revenue_account:
                            credit_line = VoucherEntryDetails(
                                voucherEntry=voucher,
                                lineNumber=2,
                                account=service_fee_revenue_account,
                                description=f"Service fee revenue - {payment.unit.unit_name} ({month_year})",
                                debitAmount=0,
                                creditAmount=bill_amount,
                                # Unit and Account Holder removed from revenue line to fix Unit Ledger summing to zero
                                unit=None,
                                account_holder_type=None,
                                account_holder_id=None,
                            )
                            details_to_create.append(credit_line)
                    else:
                        line_num = 2
                        for item in payment_items:
                            account_to_use = service_fee_revenue_account
                            item_name = item.item_name or item.item_type
                            
                            # Map item to correct account head
                            if item.item_type == 'base_fee':
                                account_to_use = service_fee_revenue_account
                            elif item.item_type == 'penalty':
                                account_to_use = late_fee_income_account
                            elif item.item_type == 'bill_category':
                                # Dynamic check: Get or create specific account for this bill category
                                cat_name = item.bill_category.name if item.bill_category else item.item_name
                                if cat_name:
                                    # Use service_fee_revenue_account (4100) as parent for utility income
                                    revenue_parent = Account.objects.filter(accountCode='4100').first()
                                    
                                    # 1. Try to fetch from BillCategory link first
                                    account_to_use = None
                                    if item.bill_category and item.bill_category.default_account_head:
                                        account_to_use = item.bill_category.default_account_head.defaultAccount
                                    
                                    if not account_to_use:
                                        # 2. Sequential Check: DefaultAccountHead then Account then Create
                                        # Format: utility_income_[category_name_slug]
                                        cat_slug = cat_name.lower().replace(' ', '_').replace('-', '_')
                                        trans_key = f"utility_income_{cat_slug}"
                                        
                                        account_to_use = get_or_create_item_account(
                                            cat_name, 
                                            parent_account=revenue_parent or service_fee_revenue_account.parentAccount,
                                            created_by=payment.created_by,
                                            transaction_key=trans_key
                                        )
                                        
                                        # 3. Add to BillCategory then fetch for future use
                                        if account_to_use and item.bill_category and not item.bill_category.default_account_head:
                                            try:
                                                head = DefaultAccountHead.objects.filter(transactionType=trans_key).first()
                                                if head:
                                                    item.bill_category.default_account_head = head
                                                    item.bill_category.save()
                                                    logger.info(f"Linked category {cat_name} to default head {trans_key}")
                                            except Exception as e:
                                                logger.error(f"Failed to link category to head: {str(e)}")
                                    
                                    item_name = cat_name
                                
                                if not account_to_use:
                                    account_to_use = service_fee_revenue_account
                            
                            # Ensure we have an account to credit
                            if not account_to_use:
                                account_to_use = service_fee_revenue_account
                                
                            if account_to_use:
                                credit_line = VoucherEntryDetails(
                                    voucherEntry=voucher,
                                    lineNumber=line_num,
                                    account=account_to_use,
                                    description=f"{item_name} revenue - {payment.unit.unit_name} ({month_year})",
                                    debitAmount=0,
                                    creditAmount=float(item.amount or 0),
                                    # Removed unit tagging from revenue offset line
                                    unit=None,
                                    account_holder_type=None,
                                    account_holder_id=None,
                                )
                                details_to_create.append(credit_line)
                                line_num += 1
                
                # Final verification and denormalization of entryDate
                for detail in details_to_create:
                    if not detail.account:
                        raise ValueError(f"Accounting Integration Error: Entry for '{detail.description}' is missing a valid Account ID. Please verify your Chart of Accounts.")
                    # Denormalize entryDate for Trial Balance and performance
                    if detail.voucherEntry and detail.voucherEntry.entryDate:
                        detail.entryDate = detail.voucherEntry.entryDate

                # Verify each voucher individually
                for voucher_idx, v in enumerate(created_vouchers):
                    # Get the corresponding payment for this voucher
                    payment = list(payments)[voucher_idx] if voucher_idx < len(list(payments)) else None
                    
                    v_details = [d for d in details_to_create if d.voucherEntry == v]
                    total_debit = round(sum(d.debitAmount for d in v_details), 2)
                    total_credit = round(sum(d.creditAmount for d in v_details), 2)
                    
                    # Check 1: Debit must equal Credit
                    if total_debit != total_credit:
                        raise ValueError(f"Accounting Mismatch in Voucher {v.voucherNumber}: Debit ({total_debit}) != Credit ({total_credit}). Creation rolled back.")
                    
                    # Check 2: Voucher total must match invoice amount
                    if payment:
                        invoice_amount = round(float(payment.amount or 0), 2)
                        if total_debit != invoice_amount:
                            raise ValueError(
                                f"Amount Mismatch in Voucher {v.voucherNumber}: "
                                f"Voucher Total ({total_debit}) != Invoice Amount ({invoice_amount}). "
                                f"Unit: {payment.unit.unit_name}. Creation rolled back."
                            )

                # Bulk create all detail lines
                if details_to_create:
                    VoucherEntryDetails.objects.bulk_create(
                        details_to_create,
                        batch_size=500
                    )
                    logger.info(f"Created {len(details_to_create)} voucher detail lines")
                
                # Create audit trail for voucher creation
                try:
                    for voucher in created_vouchers:
                        # Find corresponding payment to get payment method
                        payment_for_audit = None
                        for p in payments:
                            if p.id == int(voucher.referenceNumber):
                                payment_for_audit = p
                                break
                        
                        payment_method_id = getattr(payment_for_audit, 'payment_method_id', None) or 1
                        # Use smart resolution for audit trail accuracy
                        payment_account_obj = get_or_create_payment_account(None, payment_method_id, created_by)
                        
                        audit_data = {
                            'voucherNumber': voucher.voucherNumber,
                            'referenceNumber': voucher.referenceNumber,
                            'entryDate': str(voucher.entryDate),
                            'totalDebit': str(voucher.totalDebit),
                            'totalCredit': str(voucher.totalCredit),
                            'status': voucher.status,
                            'narration': voucher.narration,
                            'year': year,
                            'month': month,
                            'payment_account_code': payment_account_obj.accountCode if payment_account_obj else 'Unknown',
                            'payment_account_name': payment_account_obj.accountName if payment_account_obj else 'Unknown'
                        }
                        create_audit_trail(
                            member=None,  # System-generated
                            event_type='VOUCHER_CREATED',
                            table_name='accounts_voucherentry',
                            row_id=voucher.id,
                            new_data=json.dumps(audit_data, cls=DjangoJSONEncoder),
                            description=f'Auto-generated voucher for service fee bills ({month}/{year}) with payment account {payment_account_obj.accountCode if payment_account_obj else "N/A"}'
                        )
                        logger.info(f"Audit trail created for voucher {voucher.voucherNumber} with account {payment_account_obj.accountCode if payment_account_obj else 'N/A'}")
                except Exception as e:
                    logger.warning(f"Could not create audit trail for vouchers: {str(e)}")
                    if isinstance(e, DatabaseError):
                        raise
        
        return result
        
    except Exception as e:
        logger.error(f"Error creating vouchers for generated bills: {str(e)}")
        # Propagate exception to trigger rollback if inside a transaction
        raise


def create_payment_voucher(billing_records, total_amount, payment_method_id, member, unit, batch_receipt_id, notes, entry_date=None):
    """
    Create a Receipt Voucher when a payment is actually received.
    Debits Cash/Bank and Credits Accounts Receivable.
    Handles penalties and waivers if they are part of the payment session.
    """
    try:
        if not billing_records:
            return {'success': False, 'message': 'No billing records provided'}

        # 1. Determine the Debit Account (Cash/Bank/MFS) using smart function
        # This will automatically find or create accounts under CCE (1110)
        try:
            from ..models import PaymentMethod
            pm_obj = PaymentMethod.objects.filter(id=payment_method_id).first()
            debit_account = get_or_create_payment_account(
                payment_method_obj=pm_obj,
                payment_method_id=payment_method_id,
                created_by=member
            )
        except Exception as e:
            logger.error(f"Error getting payment account: {str(e)}")
            import traceback
            traceback.print_exc()
            # Fallback to Cash on Hand
            try:
                debit_account = Account.objects.filter(accountCode='1111', isActive=True).first()
            except Exception:
                debit_account = None

        if not debit_account:
            return {'success': False, 'message': f'Accounting Failure: No valid account head found for payment method.'}

        # 2. Accounts Receivable Account (Credit side)
        accounts_receivable = get_or_create_item_account(
            "Accounts Receivable",
            account_type='asset',
            transaction_key='service_fee_receivable',
            default_entry_type='debit'
        )

        # 3. Late Fee Income Account (for Waiver debit)
        late_fee_income_account = get_or_create_item_account(
            "Late Fee Income",
            account_type='revenue',
            transaction_key='late_fee_income',
            default_entry_type='credit'
        )

        # Generate Voucher ID
        # Check if this is purely an advance payment voucher
        is_pure_advance = False
        if billing_records:
            is_pure_advance = all(b.advance_payment and not b.servicefeepaymentid for b in billing_records)

        if is_pure_advance:
            v_type, _ = VoucherType.objects.get_or_create(
                name='AdvancePayment', 
                defaults={
                    'displayName': 'Advance Payment',
                    'description': 'Voucher for advance payment collection',
                    'prefix': 'SFAP',
                    'isActive': True
                }
            )
        else:
            v_type, _ = VoucherType.objects.get_or_create(
                name='ServiceFeePayment', 
                defaults={
                    'displayName': 'Service Fee Payment',
                    'description': 'Voucher for service fee payment collection',
                    'prefix': 'SFBR',
                    'isActive': True
                }
            )

        # ── IDEMPOTENCY GUARD (Unit + Receipt scoped) ────────────────────────
        # VoucherEntry already has a `unit` FK column, so we can safely filter
        # by (referenceNumber, voucherType, unit) to make each voucher unique
        # per unit per receipt — no need to encode the unit ID in the reference.
        target_narration = f"Payment received from {unit.unit_name}. {notes}"
        existing_voucher = VoucherEntry.objects.filter(
            referenceNumber=batch_receipt_id,
            voucherType=v_type,
            unit=unit,
            narration=target_narration
        ).first()
        if existing_voucher:
            logger.info(
                f"Payment voucher already exists for receipt {batch_receipt_id} / "
                f"unit {unit.unit_name}: {existing_voucher.voucherNumber} — skipping duplicate"
            )
            return {'success': True, 'voucher_id': existing_voucher.id, 'voucher_number': existing_voucher.voucherNumber}
        # ──────────────────────────────────────────────────────────────────────

        # Determine prefix for naming
        v_prefix = v_type.prefix or 'SFBR'

        # Use MAX sequence (not COUNT) to avoid collisions under concurrent requests
        voucher_date = entry_date if entry_date else datetime.now().date()
        today_str = voucher_date.strftime('%Y%m%d')
        last_v = VoucherEntry.objects.filter(
            voucherNumber__startswith=f'{v_prefix}-{today_str}-'
        ).order_by('-voucherNumber').first()
        seq = (int(last_v.voucherNumber.split('-')[-1]) + 1) if last_v else 1
        voucher_number = f"{v_prefix}-{today_str}-{seq:04d}"
        
        with transaction.atomic():
            voucher = VoucherEntry.objects.create(
                voucherNumber=voucher_number,
                entryDate=voucher_date,
                referenceNumber=batch_receipt_id,
                narration=f"Payment received from {unit.unit_name}. {notes}",
                voucherType=v_type,
                unit=unit,
                status='draft',
                totalDebit=float(total_amount),
                totalCredit=float(total_amount),
                createdBy=member,
                # Try to get account holder from the first billing record's associated bill
                account_holder_type=billing_records[0].servicefeepaymentid.account_holder_type if billing_records and billing_records[0].servicefeepaymentid else 'owner',
                account_holder_id=billing_records[0].servicefeepaymentid.account_holder_id if billing_records and billing_records[0].servicefeepaymentid else _get_unit_primary_owner_id(unit)
            )

            details_to_create = []
            
            # 1. DEBIT Side: Money coming in (Cash/Bank ONLY)
            if float(total_amount) > 0:
                # Get payment method name for description
                payment_method_name = "Payment"
                try:
                    from ..models import PaymentMethod
                    pm = PaymentMethod.objects.filter(id=payment_method_id).first()
                    if pm:
                        payment_method_name = pm.method_name
                except Exception:
                    pass
                
                details_to_create.append(VoucherEntryDetails(
                    voucherEntry=voucher,
                    lineNumber=1,
                    account=debit_account,
                    description=f"Payment received via {payment_method_name} - {unit.unit_name}",
                    debitAmount=float(total_amount),
                    creditAmount=0,
                    # Removed unit tagging from Cash/Bank line (Offset side)
                    unit=None,
                    account_holder_type=None,
                    account_holder_id=None
                ))

            # 2. CREDIT Side: Where the cash value is applied
            line_num = 2
            
            # Accounts for Credit
            advance_liability_credit_account = get_or_create_item_account(
                "Advance Service Fee",
                account_type='liability',
                transaction_key='advance_payment',
                default_entry_type='credit'
            )

            # Important: In this voucher, we only track the application of the CASH (total_amount)
            # 1. Credit Receivable for the CASH portion applied to bills
            # 2. Credit Advance Liability for the CASH portion saved as advance
            
            for billing in billing_records:
                # 2a. Calculate the CASH portion of this billing record
                # Note: billing.total_paid includes both Cash (debit) and Advance usage (advance)
                # We want only the CASH part for the Receipt Voucher.
                from service_fee_management.models import ServiceFeePaymentAllocation
                
                # Fetch allocations to calculate breakdown
                all_allocs = list(billing.allocations.all())
                advance_usage = sum(float(a.allocated_amount) for a in all_allocs if a.allocation_type == 'advance')
                
                # The cash portion is the total recorded paid amount minus what was covered by advance
                cash_allocated = float(billing.total_paid) - advance_usage
                
                # Case 1: Cash applied to a monthly bill (Receivable reduction)
                if cash_allocated > 0 and billing.servicefeepaymentid and accounts_receivable:
                    month_name = calendar.month_name[billing.servicefeepaymentid.service_period_month]
                    period_str = f" ({month_name} {billing.servicefeepaymentid.service_period_year})"
                    details_to_create.append(VoucherEntryDetails(
                        voucherEntry=voucher,
                        lineNumber=line_num,
                        account=accounts_receivable,
                        description=f"Cash payment applied - {unit.unit_name}{period_str}",
                        debitAmount=0,
                        creditAmount=cash_allocated,
                        unit=unit,
                        account_holder_type=billing.servicefeepaymentid.account_holder_type if billing.servicefeepaymentid else 'owner',
                        account_holder_id=billing.servicefeepaymentid.account_holder_id if billing.servicefeepaymentid else _get_unit_primary_owner_id(unit)
                    ))
                    line_num += 1
                
                # Case 2: Cash saved as a NEW Advance Credit (Advance Liability increase)
                elif cash_allocated > 0 and (getattr(billing, 'payment_type', '') == 'advance_payment' or billing.advance_payment_id):
                    if advance_liability_credit_account:
                        details_to_create.append(VoucherEntryDetails(
                            voucherEntry=voucher,
                            lineNumber=line_num,
                            account=advance_liability_credit_account,
                            description=f"Excess cash saved as advance - {unit.unit_name} ({voucher.entryDate.strftime('%B %Y')})",
                            debitAmount=0,
                            creditAmount=cash_allocated,
                            unit=unit,
                            account_holder_type=voucher.account_holder_type,
                            account_holder_id=voucher.account_holder_id
                        ))
                        line_num += 1

            # 3. Final Verification and Balancing
            if not details_to_create:
                return {'success': True, 'message': 'No cash entries to record'}

            for detail in details_to_create:
                if not detail.account:
                    raise ValueError(f"Accounting Integration Error: Entry for '{detail.description}' is missing a valid Account ID.")
                # Denormalize entryDate
                detail.entryDate = voucher.entryDate

            # Calculate actual totals
            details_debit = round(sum(d.debitAmount for d in details_to_create), 2)
            details_credit = round(sum(d.creditAmount for d in details_to_create), 2)
            
            # Update voucher header
            voucher.totalDebit = details_debit
            voucher.totalCredit = details_credit
            
            if details_debit != details_credit:
                logger.error(f"Voucher Balance Mismatch: Debit {details_debit} vs Credit {details_credit}")
                raise ValueError(f"Accounting Integration Error: Cash Voucher Mismatch! Debit: {details_debit}, Credit: {details_credit}.")

            VoucherEntryDetails.objects.bulk_create(details_to_create)
            voucher.save()

            # Create audit trail
            try:
                audit_data = {
                    'voucherNumber': voucher.voucherNumber,
                    'referenceNumber': voucher.referenceNumber,
                    'totalCash': str(total_amount)
                }
                create_audit_trail(
                    member=member,
                    event_type='PAYMENT_VOUCHER_CREATED',
                    table_name='accounts_voucherentry',
                    row_id=voucher.id,
                    new_data=json.dumps(audit_data, cls=DjangoJSONEncoder),
                    description=f'Cash receipt voucher created for {unit.unit_name}, Total: ৳{total_amount}'
                )
            except Exception:
                pass

        return {'success': True, 'voucher_id': voucher.id, 'voucher_number': voucher.voucherNumber}
    except Exception as e:
        logger.error(f"Error creating payment voucher: {str(e)}")
        return {'success': False, 'message': str(e)}


def create_waiver_adjustment_voucher(billing_records, member, unit, batch_receipt_id, month_name=None, entry_date=None):
    """
    Create an Adjustment Voucher for non-cash movements:
    1. Penalty Waivers (Debit Late Fee Income, Credit Receivable)
    2. Advance Applications (Debit Advance Liability, Credit Receivable)
    """
    try:
        if not billing_records:
            return {'success': True}

        # Accounts
        accounts_receivable = get_or_create_item_account(
            "Accounts Receivable",
            account_type='asset',
            transaction_key='service_fee_receivable',
            default_entry_type='debit'
        )

        late_fee_income_account = get_or_create_item_account(
            "Late Fee Income",
            account_type='revenue',
            transaction_key='late_fee_income',
            default_entry_type='credit'
        )

        advance_liability_account = get_or_create_item_account(
            "Advance Service Fee",
            account_type='liability',
            transaction_key='advance_payment',
            default_entry_type='credit'
        )

        v_type, _ = VoucherType.objects.get_or_create(
            name='ServiceFeeAdjustment', 
            defaults={
                'displayName': 'Service Fee Adjustment',
                'description': 'Non-cash adjustments (waivers and advance usage)',
                'prefix': 'SFAJ',
                'isActive': True
            }
        )

        details_to_create = []
        line_num = 1
        total_adjustment = 0

        for billing in billing_records:
            from service_fee_management.models import ServiceFeePaymentAllocation
            
            # 1. Handle Waivers (Debit Late Fee, Credit Receivable)
            waivers = PenaltyWaiver.objects.filter(billing=billing)
            for waiver in waivers:
                if waiver.waived_amount > 0:
                    waived_val = float(waiver.waived_amount)
                    total_adjustment += waived_val
                    
                    month_name = calendar.month_name[billing.servicefeepaymentid.service_period_month]
                    period_desc = f"{unit.unit_name} ({month_name} {billing.servicefeepaymentid.service_period_year})"
                    
                    # More descriptive reason
                    reason_str = waiver.reason or "Administrative"
                    if waiver.notes:
                        reason_str += f" ({waiver.notes})"
                    
                    # Debit Late Fee Income (Reversal)
                    details_to_create.append(VoucherEntryDetails(
                        voucherEntry=None,
                        lineNumber=line_num,
                        account=late_fee_income_account,
                        description=f"Late Fee revenue reversal ({reason_str}) - {period_desc}",
                        debitAmount=waived_val,
                        creditAmount=0,
                        # Removed unit tagging from income reversal line
                        unit=None,
                        account_holder_type=None,
                        account_holder_id=None
                    ))
                    line_num += 1
                    
                    # Credit Receivable
                    details_to_create.append(VoucherEntryDetails(
                        voucherEntry=None,
                        lineNumber=line_num,
                        account=accounts_receivable,
                        description=f"Receivable reduction via waiver ({reason_str}) - {period_desc}",
                        debitAmount=0,
                        creditAmount=waived_val,
                        unit=unit,
                        account_holder_type=billing.servicefeepaymentid.account_holder_type if billing.servicefeepaymentid else 'owner',
                        account_holder_id=billing.servicefeepaymentid.account_holder_id if billing.servicefeepaymentid else _get_unit_primary_owner_id(unit)
                    ))
                    line_num += 1

            # 2. Handle Existing Advance Usage (Debit Advance Liability, Credit Receivable)
            all_allocs = list(billing.allocations.all())
            advance_used = sum(float(a.allocated_amount) for a in all_allocs if a.allocation_type == 'advance')
            
            if advance_used > 0:
                val = float(advance_used)
                total_adjustment += val
                
                period_str = ""
                if billing.servicefeepaymentid:
                    m_name = calendar.month_name[billing.servicefeepaymentid.service_period_month]
                    period_str = f" ({m_name} {billing.servicefeepaymentid.service_period_year})"
                
                # Debit Advance Liability
                details_to_create.append(VoucherEntryDetails(
                    voucherEntry=None,
                    lineNumber=line_num,
                    account=advance_liability_account,
                    description=f"Advance applied to bill - {unit.unit_name}{period_str}",
                    debitAmount=val,
                    creditAmount=0,
                    unit=unit,
                    account_holder_type=billing.servicefeepaymentid.account_holder_type if billing.servicefeepaymentid else 'owner',
                    account_holder_id=billing.servicefeepaymentid.account_holder_id if billing.servicefeepaymentid else _get_unit_primary_owner_id(unit)
                ))
                line_num += 1
                
                # Credit Receivable
                details_to_create.append(VoucherEntryDetails(
                    voucherEntry=None,
                    lineNumber=line_num,
                    account=accounts_receivable,
                    description=f"Receivable cleared via advance - {unit.unit_name}{period_str}",
                    debitAmount=0,
                    creditAmount=val,
                    unit=unit,
                    account_holder_type=billing.servicefeepaymentid.account_holder_type if billing.servicefeepaymentid else 'owner',
                    account_holder_id=billing.servicefeepaymentid.account_holder_id if billing.servicefeepaymentid else _get_unit_primary_owner_id(unit)
                ))
                line_num += 1

        if not details_to_create:
            return {'success': True, 'message': 'No adjustments needed'}

        with transaction.atomic():
            # ── IDEMPOTENCY GUARD (Unit + Receipt scoped) ────────────────────
            # VoucherEntry already has a `unit` FK column, so we filter by
            # (referenceNumber, voucherType, unit) — no need to modify the
            # reference number format.
            # Construct Narration with Month Name to ensure uniqueness per month
            narration_text = f"Non-cash adjustments for {unit.unit_name}"
            if month_name:
                narration_text += f" - {month_name}"

            existing_adj = VoucherEntry.objects.filter(
                referenceNumber=batch_receipt_id,
                voucherType=v_type,
                unit=unit,
                narration=narration_text
            ).first()
            if existing_adj:
                logger.info(
                    f"Adjustment voucher already exists for receipt {batch_receipt_id} / "
                    f"unit {unit.unit_name}: {existing_adj.voucherNumber} — skipping duplicate"
                )
                return {'success': True, 'voucher_id': existing_adj.id, 'voucher_number': existing_adj.voucherNumber}
            # ──────────────────────────────────────────────────────────────────

            # Use MAX sequence (not COUNT) to avoid collisions
            voucher_date = entry_date if entry_date else datetime.now().date()
            today_str = voucher_date.strftime('%Y%m%d')
            last_v = VoucherEntry.objects.filter(
                voucherNumber__startswith=f'{v_type.prefix}-{today_str}-'
            ).order_by('-voucherNumber').first()
            seq = (int(last_v.voucherNumber.split('-')[-1]) + 1) if last_v else 1
            voucher_number = f"{v_type.prefix}-{today_str}-{seq:04d}"
            
            voucher = VoucherEntry.objects.create(
                voucherNumber=voucher_number,
                entryDate=voucher_date,
                referenceNumber=batch_receipt_id,
                narration=narration_text,
                voucherType=v_type,
                unit=unit,
                status='draft',
                totalDebit=total_adjustment,
                totalCredit=total_adjustment,
                createdBy=member,
                account_holder_type=billing_records[0].servicefeepaymentid.account_holder_type if billing_records and billing_records[0].servicefeepaymentid else 'owner',
                account_holder_id=billing_records[0].servicefeepaymentid.account_holder_id if billing_records and billing_records[0].servicefeepaymentid else _get_unit_primary_owner_id(unit)
            )
            
            for detail in details_to_create:
                detail.voucherEntry = voucher
                # Denormalize entryDate
                detail.entryDate = voucher.entryDate
            
            VoucherEntryDetails.objects.bulk_create(details_to_create)
            
        return {'success': True, 'voucher_id': voucher.id, 'voucher_number': voucher.voucherNumber}
    except Exception as e:
        logger.error(f"Error creating adjustment voucher: {str(e)}")
        return {'success': False, 'message': str(e)}
