"""
Shared payment processing logic for service fee management.

This module contains reusable functions for processing payments and applying advances,
used by both manual payment views and automatic payment tasks.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Case, When, F
from django.db import models as django_models
import logging

logger = logging.getLogger(__name__)


def apply_advance_to_bill(payment, account_holder_type, account_holder_id):
    """
    Apply available advance credits to a bill automatically.
    
    This function uses the SAME logic as ServiceFeeMultiMonthPaymentView
    to ensure consistency between manual and automatic payment processing.
    
    Args:
        payment: ServiceFeePayment instance (the bill to pay)
        account_holder_type: 'owner' or 'resident'
        account_holder_id: ID of the account holder
        
    Returns:
        dict: {
            'success': bool,
            'applied_amount': Decimal,
            'message': str
        }
    """
    from ..models import AdvancePayment, ServiceFeeItem, ServiceFeePaymentAllocation, ServiceFeeBilling
    from user.models import Member
    from datetime import datetime
    import uuid
    
    try:
        with transaction.atomic():
            # Get available advance balance
            advance_lookup = {
                'unit_id': payment.unit_id,
                'status__in': ['available', 'partial'],
            }
            if account_holder_type:
                advance_lookup['account_holder_type'] = account_holder_type
            if account_holder_id:
                advance_lookup['account_holder_id'] = account_holder_id
            
            logger.info("[ApplyAdvance] Searching for advances with filter: {}".format(advance_lookup))
            
            available_advance_balance = AdvancePayment.objects.filter(**advance_lookup).aggregate(
                sum=Sum('remaining_amount')
            )['sum'] or Decimal('0.00')
            
            logger.info("[ApplyAdvance] Available advance balance for unit {}: {}".format(payment.unit_id, available_advance_balance))
            
            if available_advance_balance <= 0:
                logger.info("[ApplyAdvance] No advance credits available for unit {}".format(payment.unit_id))
                return {
                    'success': True,
                    'applied_amount': Decimal('0.00'),
                    'message': 'No advance credits available'
                }
            
            # Calculate how much is owed on this bill
            original_fixed_amount = payment.base_service_amount or Decimal('0.00')
            additional_charges = payment.additional_bill_charges or Decimal('0.00')
            
            logger.info("[ApplyAdvance] Bill {} amounts: Base={}, Additional={}".format(payment.id, original_fixed_amount, additional_charges))
            
            # Get total already paid
            total_paid_sum = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=payment
            ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0.00')
            
            # Get penalty (gross) from items
            penalty_items = ServiceFeeItem.objects.filter(
                service_fee_payment=payment,
                item_type='penalty'
            )
            gross_penalty = penalty_items.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            logger.info("[ApplyAdvance] Bill {}: Gross Penalty={}, Already Paid={}".format(payment.id, gross_penalty, total_paid_sum))
            
            # Get waivers
            from ..models import PenaltyWaiver
            total_waived = PenaltyWaiver.objects.filter(
                billing__servicefeepaymentid=payment
            ).aggregate(total=Sum('waived_amount'))['total'] or Decimal('0.00')
            
            net_penalty = max(Decimal('0.00'), gross_penalty - total_waived)
            
            # Total remaining to clear
            total_remaining_to_clear = (original_fixed_amount + additional_charges + net_penalty) - total_paid_sum
            
            logger.info("[ApplyAdvance] Bill {}: Total Due={}".format(payment.id, total_remaining_to_clear))
            
            if total_remaining_to_clear <= 0:
                logger.info("[ApplyAdvance] Bill {} already fully paid".format(payment.id))
                return {
                    'success': True,
                    'applied_amount': Decimal('0.00'),
                    'message': 'Bill already fully paid'
                }
            
            # Apply advance (use SAME logic as ServiceFeeMultiMonthPaymentView)
            applied_advance_amount = Decimal('0.00')
            shortfall = total_remaining_to_clear
            
            logger.info("[ApplyAdvance] Looking for advances for unit {}, holder_type={}, holder_id={}".format(payment.unit_id, account_holder_type, account_holder_id))
            
            # Find available advance records (FIFO - oldest first)
            # Strategy: 1. Try exact match (Holder Type + ID)
            #           2. If none, fall back to Unit match (Unit ID only)
            
            adv_records = AdvancePayment.objects.filter(
                unit_id=payment.unit_id,
                status__in=['available', 'partial'],
                account_holder_type=account_holder_type,
                account_holder_id=account_holder_id
            ).order_by('created_at')
            
            if not adv_records.exists():
                logger.info("[ApplyAdvance] No exact holder match for {}/{}. Falling back to Unit-wide search.".format(account_holder_type, account_holder_id))
                adv_records = AdvancePayment.objects.filter(
                    unit_id=payment.unit_id,
                    status__in=['available', 'partial']
                ).order_by('created_at')
            
            logger.info("[ApplyAdvance] Found {} advance records".format(adv_records.count()))
            
            for adv in adv_records:
                if shortfall <= 0:
                    break
                can_take = min(adv.remaining_amount, shortfall)
                adv.apply_to_payment(can_take)
                applied_advance_amount += can_take
                shortfall -= can_take
                logger.info("[ApplyAdvance] Applied {} from Advance (ID={}), Remaining shortfall={}".format(can_take, adv.id, shortfall))
            
            logger.info("[ApplyAdvance] Total applied advance: {}".format(applied_advance_amount))
            
            if applied_advance_amount <= 0:
                logger.info("[ApplyAdvance] No advance applied to bill {}".format(payment.id))
                return {
                    'success': True,
                    'applied_amount': Decimal('0.00'),
                    'message': 'No advance applied'
                }
            
            # Create billing record for this advance application
            now = datetime.now()
            short_uuid = str(uuid.uuid4()).replace('-', '').upper()[:8]
            transaction_id = f"TXN-ADV-{now.year}{now.month:02d}-{short_uuid}"
            receipt_id = f"RCP-ADV-{now.year}{now.month:02d}-{short_uuid}"
            
            billing = ServiceFeeBilling.objects.create(
                transaction_id=transaction_id,
                receipt_id=receipt_id,
                servicefeepaymentid=payment,
                billing_amount=original_fixed_amount,
                total_paid=Decimal('0.00'),  # Will be updated after allocation
                payment_type='advance_payment',
                payment_date=now,
                notes=f"Auto-applied advance payment to {datetime(payment.service_period_year, payment.service_period_month, 1).strftime('%B %Y')} bill"
            )
            
            # Hierarchical allocation (SAME as ServiceFeeMultiMonthPaymentView)
            items = ServiceFeeItem.objects.filter(service_fee_payment=payment)
            
            def get_item_priority(item):
                t = (item.item_type or '').lower()
                if 'penalty' in t or 'late' in t:
                    return 0
                if 'service' in t or 'base' in t:
                    return 1
                if 'bill' in t or 'category' in t:
                    return 2
                return 3
            
            sorted_items = sorted(items, key=get_item_priority)
            remaining_advance = applied_advance_amount
            
            for item in sorted_items:
                if remaining_advance <= 0:
                    break
                
                # Get already allocated amount to this item
                total_covered_historically = ServiceFeePaymentAllocation.objects.filter(
                    service_fee_item=item
                ).exclude(service_fee_billing=billing).aggregate(
                    sum=Sum('allocated_amount')
                )['sum'] or Decimal('0.00')
                
                item_due_now = item.amount - total_covered_historically
                
                if item_due_now > 0:
                    adv_to_allocate = min(remaining_advance, item_due_now)
                    ServiceFeePaymentAllocation.objects.create(
                        service_fee_billing=billing,
                        service_fee_item=item,
                        service_fee_payment=payment,
                        allocated_amount=adv_to_allocate,
                        allocation_type='advance',
                        description=f"Auto-applied advance from balance"
                    )
                    remaining_advance -= adv_to_allocate
            
            # Update billing total_paid
            billing.total_paid = applied_advance_amount
            billing.save()
            billing.calculate_totals()
            
            # Update payment status
            total_allocated = ServiceFeePaymentAllocation.objects.filter(
                service_fee_payment=payment,
                allocation_type__in=['debit', 'advance']
            ).aggregate(total=Sum('allocated_amount'))['total'] or Decimal('0.00')
            
            total_liability = original_fixed_amount + additional_charges + net_penalty
            
            if total_allocated >= total_liability:
                payment.service_status = 'paid'
                payment.payment_status = 'completed'
            elif total_allocated > 0:
                payment.service_status = 'partial'
                payment.payment_status = 'pending'
            else:
                # No payment made (or remains unpaid), check if it's overdue
                if payment.due_date and datetime.now().date() > payment.due_date:
                    payment.service_status = 'overdue'
                else:
                    payment.service_status = 'due'
                payment.payment_status = 'pending'
            
            payment.total_paid = total_allocated
            payment.remaining_amount = max(Decimal('0.00'), total_liability - total_allocated)
            payment.save()
            
            # Generate Voucher for Advance Application
            try:
                from .voucher_generator import create_waiver_adjustment_voucher
                # Trigger adjustment voucher creation
                # Advance applications are non-cash adjustments (Debit Advance Liability, Credit Receivable)
                v_res = create_waiver_adjustment_voucher(
                    billing_records=[billing],
                    member=None, # System generated
                    unit=payment.unit,
                    batch_receipt_id=receipt_id
                )
                if not v_res.get('success'):
                    raise ValueError(v_res.get('message'))
                logger.info(f"[ApplyAdvance] Adjustment Voucher created for transaction {transaction_id}")
            except Exception as ve:
                logger.error(f"[ApplyAdvance] Voucher creation failed: {str(ve)}")
                # We optionally raise here if strict accounting is required
                raise ve 

            return {
                'success': True,
                'applied_amount': applied_advance_amount,
                'receipt_id': receipt_id,
                'transaction_id': transaction_id,
                'message': 'Applied {} from advance credits'.format(applied_advance_amount)
            }
            
    except Exception as e:
        logger.error(f"Error applying advance to bill {payment.id}: {str(e)}", exc_info=True)
        return {
            'success': False,
            'applied_amount': Decimal('0.00'),
            'message': f'Error: {str(e)}'
        }
