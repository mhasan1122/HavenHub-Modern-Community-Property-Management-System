"""
Utility module for applying advance payments to existing service fee bills.
This module handles the automatic application of advance payments when they are recorded.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import uuid
import logging

logger = logging.getLogger(__name__)


def apply_advance_to_existing_bills(unit_id, account_holder_id, account_holder_type='owner'):
    """
    Apply available advance payments to existing unpaid/partially paid bills for a unit.
    
    This function is triggered when an advance payment is recorded (payment_type='advance_payment').
    It finds all available advances for the unit and applies them to existing bills in chronological order.
    
    Args:
        unit_id: ID of the unit
        account_holder_id: ID of the account holder (owner or resident)
        account_holder_type: Type of account holder ('owner' or 'resident')
    
    Returns:
        dict: Summary of applications made
    """
    from service_fee_management.models import (
        AdvancePayment, 
        ServiceFeePayment, 
        ServiceFeeBilling
    )
    
    try:
        with transaction.atomic():
            # Query for available advance payments for this unit and account holder
            available_advances = AdvancePayment.objects.filter(
                unit_id=unit_id,
                account_holder_type=account_holder_type,
                account_holder_id=account_holder_id,
                status__in=['available', 'partial']
            ).order_by('created_at')  # Apply oldest advances first (FIFO)
            
            total_available_advance = sum(
                adv.remaining_amount for adv in available_advances
            )
            
            if total_available_advance <= 0:
                logger.info(f"No advance credits available for unit {unit_id}")
                return {
                    'success': True,
                    'total_advance_available': 0,
                    'total_applied': 0,
                    'bills_updated': 0,
                    'message': 'No advance credits available'
                }
            
            logger.info(f"💰 [Advance Application] Unit {unit_id}: Found ৳{total_available_advance} in advance credits")
            
            # Find all unpaid or partially paid bills for this unit (ordered by due date, oldest first)
            unpaid_bills = ServiceFeePayment.objects.filter(
                unit_id=unit_id,
                account_holder_type=account_holder_type,
                account_holder_id=account_holder_id,
                payment_status__in=['pending', 'partial']
            ).order_by('due_date', 'service_period_year', 'service_period_month')
            
            if not unpaid_bills.exists():
                logger.info(f"No unpaid bills found for unit {unit_id}")
                return {
                    'success': True,
                    'total_advance_available': float(total_available_advance),
                    'total_applied': 0,
                    'bills_updated': 0,
                    'message': 'No unpaid bills to apply advance to'
                }
            
            logger.info(f"   Found {unpaid_bills.count()} unpaid/partial bills to process")
            
            total_applied = Decimal('0.00')
            bills_updated = 0
            billings_to_create = []
            
            # Apply advances to bills
            remaining_advance = total_available_advance
            
            for bill in unpaid_bills:
                if remaining_advance <= 0:
                    break
                
                # Calculate how much we can apply to this bill
                bill_remaining = bill.remaining_amount
                if bill_remaining <= 0:
                    continue
                
                # Amount to apply to this bill (don't exceed bill amount or available advance)
                amount_to_apply = min(bill_remaining, remaining_advance)
                
                logger.info(f"   📋 Bill {bill.id} ({bill.service_period_month}/{bill.service_period_year}): Remaining ৳{bill_remaining}, Applying ৳{amount_to_apply}")
                
                # Apply advance from each advance record (FIFO)
                bill_advance_applied = Decimal('0.00')
                
                for advance_record in available_advances:
                    if amount_to_apply <= 0:
                        break
                    
                    if advance_record.remaining_amount <= 0:
                        continue
                    
                    # Calculate how much we can take from this advance record
                    can_apply_from_this = min(advance_record.remaining_amount, amount_to_apply)
                    
                    # Update advance record balances
                    advance_record.applied_amount += can_apply_from_this
                    advance_record.remaining_amount -= can_apply_from_this
                    
                    # Update status based on remaining balance
                    if advance_record.remaining_amount <= 0:
                        advance_record.status = 'depleted'
                        advance_record.applied_at = timezone.now()
                    elif advance_record.applied_amount > 0:
                        advance_record.status = 'partial'
                    
                    advance_record.save()
                    
                    bill_advance_applied += can_apply_from_this
                    amount_to_apply -= can_apply_from_this
                    
                    logger.info(f"      ✅ Applied ৳{can_apply_from_this} from Advance #{advance_record.id}")
                    logger.info(f"         Advance remaining: ৳{advance_record.remaining_amount} (status: {advance_record.status})")
                
                # Update bill with applied advance
                bill.total_paid += bill_advance_applied
                bill.remaining_amount = max(Decimal('0.00'), bill.amount - bill.total_paid)
                
                # Update payment status
                if bill.remaining_amount <= 0:
                    bill.payment_status = 'completed'
                    bill.service_status = 'paid'
                elif bill.total_paid > 0:
                    bill.payment_status = 'partial'
                    bill.service_status = 'partial'
                
                bill.save()
                
                # Create billing record for this advance application
                # Check if billing record already exists for this bill with advance_payment type
                existing_advance_billing = ServiceFeeBilling.objects.filter(
                    servicefeepaymentid=bill,
                    payment_type='advance_payment'
                ).first()
                
                if existing_advance_billing:
                    # Update existing billing record
                    existing_advance_billing.total_paid += bill_advance_applied
                    existing_advance_billing.save()
                    logger.info(f"      📝 Updated existing advance billing record #{existing_advance_billing.id}")
                else:
                    # Create new billing record
                    short_uuid = str(uuid.uuid4()).replace('-', '').upper()[:8]
                    billings_to_create.append(ServiceFeeBilling(
                        servicefeepaymentid=bill,
                        billing_amount=bill.amount,
                        total_paid=bill_advance_applied,
                        payment_type='advance_payment',
                        payment_date=timezone.now(),
                        due_date=bill.due_date,
                        currency=bill.currency,
                        notes=f"Auto-applied advance payment to existing bill",
                        transaction_id=f"TXN-ADV-{short_uuid}",
                        receipt_id=f"RCP-ADV-{short_uuid}",
                        billing_id=f"BILL-ADV-{short_uuid}"
                    ))
                
                total_applied += bill_advance_applied
                remaining_advance -= bill_advance_applied
                bills_updated += 1
                
                logger.info(f"      ✅ Bill updated: Total paid ৳{bill.total_paid}, Remaining ৳{bill.remaining_amount}, Status: {bill.payment_status}")
            
            # Bulk create billing records
            if billings_to_create:
                ServiceFeeBilling.objects.bulk_create(billings_to_create)
                logger.info(f"   ✅ Created {len(billings_to_create)} advance billing records")
            
            logger.info(f"   ✅ Total advance applied: ৳{total_applied}")
            logger.info(f"   ✅ Bills updated: {bills_updated}")
            logger.info(f"   💰 Remaining advance: ৳{remaining_advance}")
            
            return {
                'success': True,
                'total_advance_available': float(total_available_advance),
                'total_applied': float(total_applied),
                'bills_updated': bills_updated,
                'remaining_advance': float(remaining_advance),
                'message': f'Applied ৳{total_applied} to {bills_updated} bill(s)'
            }
            
    except Exception as e:
        logger.error(f"Error applying advance to existing bills: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'total_advance_available': 0,
            'total_applied': 0,
            'bills_updated': 0
        }
