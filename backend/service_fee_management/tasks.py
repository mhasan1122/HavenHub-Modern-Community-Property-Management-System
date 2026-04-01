"""
Background tasks for service fee management.

This module contains background tasks for:
- Auto-payment: Automatically applies available advances to newly generated bills
"""
import logging
import time
from django.db import transaction, OperationalError
from .models import ServiceFeePayment
from .utils.payment_processor import apply_advance_to_bill

logger = logging.getLogger(__name__)

def auto_payment_task(payment_id):
    """
    Applies any available advances to the newly generated bill.
    
    This task is triggered after bill generation completes.
    It uses the SAME payment logic as ServiceFeeMultiMonthPaymentView
    to ensure consistency.
    
    Args:
        payment_id: ID of the ServiceFeePayment (bill) to process
    """
    max_retries = 3
    retry_delay = 0.5  # Start with 0.5 seconds
    
    for attempt in range(max_retries):
        try:
            logger.info("[AutoPay] Task started for bill {} (attempt {}/{})".format(payment_id, attempt + 1, max_retries))
            
            bill = ServiceFeePayment.objects.get(id=payment_id)
            logger.info("[AutoPay] Retrieved bill {}: Status={}, Remaining={}".format(bill.id, bill.payment_status, bill.remaining_amount))
            
            # Don't process if already paid
            if bill.payment_status == 'completed' or bill.remaining_amount <= 0:
                logger.info("[AutoPay] Bill {} already paid (status={}, remaining={}). Skipping.".format(bill.id, bill.payment_status, bill.remaining_amount))
                return
                
            account_holder_id = bill.account_holder_id or bill.owner_id
            logger.info("[AutoPay] Account holder ID: {}".format(account_holder_id))
                 
            if not account_holder_id:
                logger.warning("[AutoPay] Bill {} has no account holder. Skipping.".format(bill.id))
                return

            account_holder_type = bill.account_holder_type or 'owner'
            logger.info("[AutoPay] Account holder type: {}".format(account_holder_type))

            logger.info("[AutoPay] Checking advances for Bill {} (Unit {})".format(bill.id, bill.unit_id))
            
            # Use shared payment processor (SAME logic as manual payment)
            # Wrap in transaction to handle deadlocks
            with transaction.atomic():
                result = apply_advance_to_bill(
                    payment=bill,
                    account_holder_type=account_holder_type,
                    account_holder_id=account_holder_id
                )
            
            logger.info("[AutoPay] Result: {}".format(result))
            
            if result['success'] and result['applied_amount'] > 0:
                logger.info("[AutoPay] {}".format(result['message']))
            else:
                logger.info("[AutoPay] {}".format(result['message']))
            
            return result  # Success - return result to background worker
            
        except OperationalError as oe:
            # Handle MySQL deadlocks (errno 1213)
            if '1213' in str(oe) or 'Deadlock' in str(oe):
                if attempt < max_retries - 1:
                    logger.warning("[AutoPay] Deadlock on attempt {}, retrying in {} seconds...".format(attempt + 1, retry_delay))
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    logger.error("[AutoPay] Deadlock after {} attempts for bill {}. Giving up.".format(max_retries, payment_id))
                    logger.error("[AutoPay] Error: {}".format(str(oe)), exc_info=True)
                    return
            else:
                # Other operational error - don't retry
                logger.error("[AutoPay] Database error processing bill {}: {}".format(payment_id, str(oe)), exc_info=True)
                return
        except ServiceFeePayment.DoesNotExist:
            logger.error("[AutoPay] Bill {} not found".format(payment_id))
            return
        except Exception as e:
            logger.error("[AutoPay] Error processing bill {}: {}".format(payment_id, str(e)), exc_info=True)
            return
