import logging
from decimal import Decimal
from datetime import datetime
from django.db import DatabaseError
from audit_trail.create_audit_trail import create_audit_trail

logger = logging.getLogger(__name__)

def create_generation_items(payment, unit_bill_amounts_by_category, penalty_amount=0, active_penalty_tier=None, bill_upload_details_by_category=None):
    """
    Create ServiceFeeItem records when a service fee is generated.
    These items show composition of charges at generation time.
    
    Args:
        payment: ServiceFeePayment instance (newly created)
        unit_bill_amounts_by_category: dict {bill_category_id: amount}
        penalty_amount: float (penalty if generation is late)
        active_penalty_tier: ServiceFeePaymentLatePenaltyTier instance (if penalty applied)
        bill_upload_details_by_category: dict {bill_category_id: bill_upload_detail_id} - Maps category to detail record
    
    Returns:
        list of created item records
    """
    from ..models import ServiceFeeItem
    from bill_categories.models import BillCategory
    
    created_items = []
    
    try:
        print(f"[ServiceFeeItem] Creating items for payment {payment.id}")
        
        # Step 1: Create base fee item
        if payment.base_service_amount and payment.base_service_amount > 0:
            base_fee_item, created = ServiceFeeItem.objects.get_or_create(
                service_fee_payment_id=payment.id,
                item_type='base_fee',
                defaults={
                    'item_name': 'Service Fee',
                    'amount': Decimal(str(payment.base_service_amount)),
                    'description': f'Base service fee for {datetime(payment.service_period_year, payment.service_period_month, 1).strftime("%B %Y")}'
                }
            )
            if created:
                created_items.append(base_fee_item)
                
                # Create audit trail for base fee item creation
                try:
                    base_fee_audit_data = {
                        'id': base_fee_item.id,
                        'item_type': base_fee_item.item_type,
                        'item_name': base_fee_item.item_name,
                        'amount': str(base_fee_item.amount),
                        'service_fee_payment_id': base_fee_item.service_fee_payment_id,
                        'description': base_fee_item.description
                    }
                    create_audit_trail(
                        member=None,  # System-generated
                        event_type='ITEM_CREATED',
                        table_name='service_fee_management_servicefeeitem',
                        row_id=base_fee_item.id,
                        old_data=None,
                        new_data=base_fee_audit_data,
                        description=f'Base service fee item created - Amount: ৳{base_fee_item.amount} for {datetime(payment.service_period_year, payment.service_period_month, 1).strftime("%B %Y")}'
                    )
                except Exception as e:
                    logger.warning(f"Base fee audit trail failed: {str(e)}")
                    if isinstance(e, DatabaseError):
                        raise
        
        # Step 2: Create bill category items
        if unit_bill_amounts_by_category:
            for category_id, amount in unit_bill_amounts_by_category.items():
                if amount > 0:
                    try:
                        bill_category = BillCategory.objects.get(id=category_id)
                        bill_upload_detail_id = bill_upload_details_by_category.get(category_id) if bill_upload_details_by_category else None
                        
                        category_item, created = ServiceFeeItem.objects.get_or_create(
                            service_fee_payment_id=payment.id,
                            item_type='bill_category',
                            bill_category_id=category_id,
                            defaults={
                                'item_name': bill_category.name,
                                'amount': Decimal(str(amount)),
                                'bill_upload_detail_id': bill_upload_detail_id,
                                'description': f'{bill_category.name}: {amount} TK for {datetime(payment.service_period_year, payment.service_period_month, 1).strftime("%B %Y")}'
                            }
                        )
                        if created:
                            created_items.append(category_item)
                            
                            # Create audit trail for bill category item creation
                            try:
                                category_audit_data = {
                                    'id': category_item.id,
                                    'item_type': category_item.item_type,
                                    'item_name': category_item.item_name,
                                    'amount': str(category_item.amount),
                                    'service_fee_payment_id': category_item.service_fee_payment_id,
                                    'bill_category_id': category_item.bill_category_id,
                                    'bill_upload_detail_id': category_item.bill_upload_detail_id,
                                    'description': category_item.description
                                }
                                create_audit_trail(
                                    member=None,  # System-generated
                                    event_type='ITEM_CREATED',
                                    table_name='service_fee_management_servicefeeitem',
                                    row_id=category_item.id,
                                    old_data=None,
                                    new_data=category_audit_data,
                                    description=f'Bill category item created - Category: {bill_category.name}, Amount: ৳{category_item.amount}'
                                )
                            except Exception as e:
                                logger.warning(f"Bill category audit trail failed: {str(e)}")
                                if isinstance(e, DatabaseError):
                                    raise
                    except BillCategory.DoesNotExist:
                        pass
                    except Exception as cat_error:
                        if isinstance(cat_error, DatabaseError):
                            raise

        # Step 3: Create Penalty Item
        final_penalty = penalty_amount
        if not final_penalty or final_penalty <= 0:
            # Fallback: Check if payment record already has a penalty we should account for
            final_penalty = float(payment.gross_penalty_amount or 0)

        if final_penalty > 0:
            penalty_item, created = ServiceFeeItem.objects.get_or_create(
                service_fee_payment_id=payment.id,
                item_type='penalty',
                defaults={
                    'item_name': 'Late Fee',
                    'amount': Decimal(str(final_penalty)),
                    'description': f'Late payment fee for {datetime(payment.service_period_year, payment.service_period_month, 1).strftime("%B %Y")}',
                    'penalty_tier': active_penalty_tier
                }
            )
            if created:
                 created_items.append(penalty_item)
                 
                 # Create audit trail for penalty item creation
                 try:
                     penalty_audit_data = {
                         'id': penalty_item.id,
                         'item_type': penalty_item.item_type,
                         'item_name': penalty_item.item_name,
                         'amount': str(penalty_item.amount),
                         'service_fee_payment_id': penalty_item.service_fee_payment_id,
                         'penalty_tier_id': penalty_item.penalty_tier_id,
                         'description': penalty_item.description
                     }
                     create_audit_trail(
                         member=None,  # System-generated
                         event_type='ITEM_CREATED',
                         table_name='service_fee_management_servicefeeitem',
                         row_id=penalty_item.id,
                         old_data=None,
                         new_data=penalty_audit_data,
                         description=f'Penalty item created - Amount: ৳{penalty_item.amount} for {datetime(payment.service_period_year, payment.service_period_month, 1).strftime("%B %Y")}'
                     )
                 except Exception as e:
                     logger.warning(f"Penalty item audit trail failed: {str(e)}")
                     if isinstance(e, DatabaseError):
                         raise
        
        print(f"[ServiceFeeItem] Created {len(created_items)} total items for payment {payment.id}")
    
    except Exception as e:
        logger.error(f'ERROR creating generation items for payment {payment.id}: {str(e)}')
        if isinstance(e, DatabaseError):
            raise
        return created_items
    
    return created_items
