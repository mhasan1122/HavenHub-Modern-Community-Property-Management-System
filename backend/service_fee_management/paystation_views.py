"""
PayStation Payment Gateway Views

This module contains views for PayStation payment integration.
"""

import logging
import uuid
from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import (
    ServiceFeePayment,
    ServiceFeeBilling,
    PayStationTransactionMapping,
    ServiceFee,
    PaymentMethod,
    generate_unique_sequential_id,
)
from .utils.email_utils import trigger_bulk_payment_receipt_emails
from .utils.paystation_utils import get_payment_gateway, generate_payment_urls
from towers.models import Unit, Owner, Resident
from user.models import Member

logger = logging.getLogger(__name__)


def _normalize_paystation_method(raw_method):
    """
    Normalize PayStation payment_method for display.
    Maps Paystation's payment method codes to user-friendly names.
    
    Args:
        raw_method: Raw payment method string from Paystation (e.g., 'bkash', 'nagad', 'card')
    
    Returns:
        User-friendly payment method name (e.g., 'bKash', 'Nagad', 'Card')
        Returns None if raw_method is empty
    """
    if not raw_method or not str(raw_method).strip():
        return None
    
    s = str(raw_method).strip().lower()
    
    # Mobile Financial Services
    if s in ('bkash', 'b-kash', 'bkash-pg'):
        return 'bKash'
    if s in ('nagad', 'nagad-pg'):
        return 'Nagad'
    if s in ('rocket', 'rocket-pg'):
        return 'Rocket'
    if s in ('upay', 'upay-pg'):
        return 'Upay'
    
    # Card payments
    if s in ('card', 'credit-card', 'debit-card', 'credit_card', 'debit_card'):
        return 'Card'
    if s in ('visa', 'visa-card'):
        return 'Visa'
    if s in ('mastercard', 'master-card', 'master_card'):
        return 'Mastercard'
    if s in ('amex', 'american-express', 'american_express'):
        return 'Amex'
    
    # Bank transfer
    if s in ('bank', 'bank-transfer', 'bank_transfer', 'internet-banking', 'internet_banking'):
        return 'Bank Transfer'
    
    # Others
    if s in ('paystation', 'paystation-pg'):
        return 'PayStation'
    if s in ('cash',):
        return 'Cash'
    
    # For unknown methods, return title-cased version
    return raw_method.strip().title() if raw_method else None


# Import validation function (assuming it exists in views.py)
try:
    from .views import validate_payment_eligibility
except ImportError:
    # Fallback if function doesn't exist
    def validate_payment_eligibility(unit_id, service_fee_id, month, year, is_advance_payment=False):
        return True, 0, 0, 0


class PayStationPaymentInitView(APIView):
    """
    Initialize PayStation payment session
    """
    permission_classes = [AllowAny]  # Can be changed to IsAuthenticated if needed
    
    def post(self, request):
        """
        Initialize payment with PayStation
        
        Expected payload:
        {
            "unit_id": 123,
            "service_fee_id": 456,
            "amount": 5000.00,
            "service_period_month": 10,
            "service_period_year": 2025,
            "customer_name": "John Doe",
            "customer_email": "john@example.com",
            "customer_phone": "01712345678",
            "customer_address": "Dhaka, Bangladesh",
            "selected_payments": [...]  // Optional array of selected months
        }
        """
        try:
            # Extract payment data
            unit_id = request.data.get('unit_id')
            service_fee_id = request.data.get('service_fee_id')
            amount = request.data.get('amount')
            service_period_month = request.data.get('service_period_month')
            service_period_year = request.data.get('service_period_year')
            selected_payments = request.data.get('selected_payments', [])
            is_advance_payment = request.data.get('is_advance_payment', False)  # NEW: Flag for advance payment
            
            # Customer information
            customer_name = request.data.get('customer_name', 'Customer')
            customer_email = request.data.get('customer_email', 'customer@example.com')
            customer_phone = request.data.get('customer_phone', '01700000000')
            customer_address = request.data.get('customer_address', 'Dhaka')
            
            # Validate required fields
            # For advance payment, period is optional (will use current/next month)
            if is_advance_payment:
                if not all([unit_id, service_fee_id, amount]):
                    return Response({
                        'success': False,
                        'message': 'Missing required fields for advance payment: unit_id, service_fee_id, amount'
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                if not all([unit_id, service_fee_id, amount, service_period_month, service_period_year]):
                    return Response({
                        'success': False,
                        'message': 'Missing required fields: unit_id, service_fee_id, amount, service_period_month, service_period_year'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Convert IDs to integers
            try:
                unit_id = int(unit_id)
                service_fee_id = int(service_fee_id)
                service_period_month = int(service_period_month)
                service_period_year = int(service_period_year)
            except (ValueError, TypeError) as e:
                return Response({
                    'success': False,
                    'message': f'Invalid data types: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify unit and service fee exist
            try:
                unit = Unit.objects.get(id=unit_id)
                service_fee = ServiceFee.objects.get(id=service_fee_id)
            except (Unit.DoesNotExist, ServiceFee.DoesNotExist) as e:
                return Response({
                    'success': False,
                    'message': f'Invalid unit_id or service_fee_id: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate base invoice number
            import random
            import time
            # Use timestamp (last 8 digits) + random (4 digits) to keep it short (<15 chars) for bank compatibility
            timestamp = str(int(time.time()))[-8:] 
            numeric_suffix = "".join([str(random.randint(0, 9)) for _ in range(4)])
            base_invoice_number = f"PS-{timestamp}{numeric_suffix}"
            
            # Initialize payment_months list
            payment_months = []
            
            logger.info(f"📋 PayStation Init - Unit: {unit_id}, Amount: {amount}, Advance: {is_advance_payment}, Selected Payments: {len(selected_payments) if selected_payments else 0}")
            
            # Handle pure advance payment (no specific months selected)
            # IMPORTANT: When frontend flags is_advance_payment=True and sends NO selected_payments,
            # this should behave as a PURE ADVANCE deposit. We should NOT create or touch any
            # monthly ServiceFeePayment records here; the money will be stored as AdvancePayment
            # in the success callback only.
            if is_advance_payment and (not selected_payments or len(selected_payments) == 0):
                logger.info(f"🚀 Processing PURE Advance Payment for Unit {unit_id}, Amount: {amount} (no months attached)")
                # Leave payment_months empty – we won't create any ServiceFeePayment records
                payment_months = []
            
            # Determine which months to create payments for (regular payment flow)
            elif selected_payments and len(selected_payments) > 0:
                logger.info(f"Processing {len(selected_payments)} selected payments")
                
                # Sort by date - OLDEST FIRST
                sorted_payments = sorted(
                    selected_payments,
                    key=lambda x: (x.get('year', 9999), x.get('month', 99))
                )
                
                # Calculate total due from selected payments
                total_selected_due = 0
                
                for payment_data in sorted_payments:
                    month = payment_data.get('month')
                    year = payment_data.get('year')
                    
                    # Recalculate actual remaining amount
                    try:
                        can_pay, actual_remaining, total_paid, fee_amount = validate_payment_eligibility(
                            unit_id, service_fee_id, month, year, is_advance_payment=False
                        )
                        
                        if can_pay and actual_remaining > 0:
                            # There's unpaid amount in this month
                            due_amount = actual_remaining
                            payment_months.append({
                                'month': month,
                                'year': year,
                                'due_amount': due_amount
                            })
                            total_selected_due += due_amount
                    except Exception as e:
                        logger.warning(f"Validation error for {month}/{year}: {e}")
                        payment_months.append({
                            'month': month,
                            'year': year,
                            'due_amount': payment_data.get('amount', 0)
                        })
                
                # AUTO-DETECT ADVANCE PAYMENT: If user is paying MORE than what's due
                # This handles the case where all selected months are paid but user enters an amount
                # CRITICAL FIX: Only treat as advance if NO months were added to payment_months
                # (meaning all selected months are already fully paid)
                if total_selected_due == 0 and float(amount) > 0 and len(payment_months) == 0:
                    logger.info(f"🔄 Auto-detected advance payment: selected months have 0 due, but amount={amount}")
                    is_advance_payment = True
                    from datetime import datetime
                    current_date = datetime.now()
                    next_month = current_date.month + 1 if current_date.month < 12 else 1
                    next_year = current_date.year if current_date.month < 12 else current_date.year + 1
                    
                    payment_months = [{
                        'month': next_month,
                        'year': next_year,
                        'due_amount': float(amount),
                        'amount': float(amount),
                        'is_advance': True
                    }]
                    logger.info(f"✅ Converted to advance payment for future period: {next_month}/{next_year}")
                elif len(payment_months) > 0:
                    logger.info(f"✅ Processing {len(payment_months)} selected payment months with total due: {total_selected_due}")
                    
            else:
                # CRITICAL FIX: When no payments selected (custom amount entry),
                # automatically fetch ALL unpaid bills for this unit (oldest first)
                # This ensures payment is distributed across all due months, not just one
                logger.info(f"No selected payments - fetching all unpaid bills for unit {unit_id}")
                
                try:
                    # Fetch all unpaid bills for this unit (oldest first)
                    unpaid_bills = ServiceFeePayment.objects.filter(
                        unit_id=unit_id,
                        service_fee_id=service_fee_id,
                        remaining_amount__gt=0
                    ).exclude(
                        service_status='paid',
                        payment_status='completed'
                    ).order_by('service_period_year', 'service_period_month')
                    
                    logger.info(f"Found {unpaid_bills.count()} unpaid bill(s)")
                    
                    if unpaid_bills.exists():
                        # Add all unpaid bills to payment_months
                        for bill in unpaid_bills:
                            payment_months.append({
                                'month': bill.service_period_month,
                                'year': bill.service_period_year,
                                'due_amount': float(bill.remaining_amount)
                            })
                            logger.info(f"   Added {bill.service_period_month}/{bill.service_period_year}: ৳{bill.remaining_amount}")
                    else:
                        # No unpaid bills found - treat as advance payment
                        logger.info(f"No unpaid bills found - treating as advance payment")
                        is_advance_payment = True
                        from datetime import datetime
                        current_date = datetime.now()
                        next_month = current_date.month + 1 if current_date.month < 12 else 1
                        next_year = current_date.year if current_date.month < 12 else current_date.year + 1
                        
                        payment_months = [{
                            'month': next_month,
                            'year': next_year,
                            'due_amount': float(amount),
                            'amount': float(amount),
                            'is_advance': True
                        }]
                        logger.info(f"✅ Created advance payment placeholder: {next_month}/{next_year}")
                        
                except Exception as e:
                    logger.error(f"Error fetching unpaid bills: {e}")
                    # Fallback to single month from parameters
                    try:
                        can_pay, actual_remaining, total_paid, fee_amount = validate_payment_eligibility(
                            unit_id, service_fee_id, service_period_month, service_period_year, is_advance_payment=False
                        )
                        
                        if can_pay and actual_remaining > 0:
                            payment_months.append({
                                'month': service_period_month,
                                'year': service_period_year,
                                'due_amount': actual_remaining
                            })
                            logger.info(f"Fallback: Added {service_period_month}/{service_period_year}: ৳{actual_remaining}")
                    except Exception as e2:
                        logger.error(f"Fallback validation error: {e2}")
                        payment_months.append({
                            'month': service_period_month,
                            'year': service_period_year,
                            'due_amount': amount
                        })
            
            # For advance payment, always proceed even if no unpaid months
            if not payment_months and not is_advance_payment:
                return Response({
                    'success': False,
                    'message': 'All selected months are already fully paid. Please use advance payment option.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Distribute amount across months (OLDEST FIRST)
            remaining_amount = float(amount)
            logger.info(f"💰 Distributing ৳{amount} across {len(payment_months)} month(s)")
            for payment_month_data in payment_months:
                due_amount = float(payment_month_data.get('due_amount', 0))
                
                if remaining_amount >= due_amount:
                    payment_month_data['amount'] = due_amount
                    remaining_amount -= due_amount
                    logger.info(f"   ✅ {payment_month_data['month']}/{payment_month_data['year']}: Full payment ৳{due_amount}")
                elif remaining_amount > 0:
                    payment_month_data['amount'] = remaining_amount
                    logger.info(f"   ⚠️ {payment_month_data['month']}/{payment_month_data['year']}: Partial payment ৳{remaining_amount} (due: ৳{due_amount})")
                    remaining_amount = 0
                else:
                    payment_month_data['amount'] = 0
                    logger.info(f"   ❌ {payment_month_data['month']}/{payment_month_data['year']}: No payment (already distributed)")
            
            logger.info(f"💰 Distribution complete. Remaining: ৳{remaining_amount}")
            
            # Create payment records
            created_payments = []
            for index, payment_month_data in enumerate(payment_months):
                month = payment_month_data['month']
                year = payment_month_data['year']
                month_amount = payment_month_data['amount']
                
                if month_amount == 0:
                    continue
                
                # IMPORTANT: Find the existing generated payment record for this period
                # Don't create duplicate records - reuse the generated one
                existing_payment = ServiceFeePayment.objects.filter(
                    unit_id=unit_id,
                    service_fee_id=service_fee_id,
                    service_period_month=month,
                    service_period_year=year,
                ).exclude(
                    service_status='paid',  # Skip if already fully paid
                    payment_status='completed'
                ).first()
                
                if existing_payment:
                    # Reuse existing payment record (whether it's due, partial, or pending)
                    # IMPORTANT: Do NOT overwrite payment.amount - it should stay as the full fee
                    existing_payment.payment_status = 'pending'
                    existing_payment.save()
                    created_payments.append(existing_payment)
                    logger.info(f"Reusing existing payment {existing_payment.id} for {month}/{year} - Transaction amount: {month_amount}")
                    continue
                
                # Only create new record if no existing payment found (shouldn't happen after generation)
                logger.warning(f"No existing payment found for {month}/{year} - Creating new record")
                
                # Use service fee amount as base (bill categories are handled elsewhere)
                base_amount = Decimal(str(service_fee.fee_amount))
                additional_amount = Decimal('0')
                total_amount = base_amount
                
                payment = ServiceFeePayment.objects.create(
                    service_fee_id=service_fee.id,
                    unit_id=unit.id,
                    resident_id=unit.primary_resident_id if hasattr(unit, 'primary_resident_id') else None,
                    amount=total_amount,  # Total fee (base + additional)
                    base_service_amount=base_amount,  # Base service fee
                    additional_bill_charges=additional_amount,  # Additional charges
                    remaining_amount=total_amount,  # Initially full amount remaining
                    currency='BDT',
                    payment_status='pending',
                    service_status='due',
                    service_period_month=month,
                    service_period_year=year,
                    due_date=f"{year}-{month:02d}-{min(service_fee.due_day, 28):02d}",
                )
                created_payments.append(payment)
            
            if not created_payments and not is_advance_payment:
                return Response({
                    'success': False,
                    'message': 'No payment records could be created.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create transaction mapping
            try:
                mapping = PayStationTransactionMapping.create_mapping(
                    invoice_number=base_invoice_number,
                    payment_ids=[p.id for p in created_payments],
                    unit_id=unit_id,
                    service_fee_id=service_fee_id,
                    amount=float(amount),
                    reference=f"Unit: {unit.unit_name}, {'Advance Payment' if is_advance_payment else 'Service Fee Payment'}",
                    is_advance_payment=is_advance_payment
                )
                logger.info(f"Created transaction mapping: {base_invoice_number} (Advance: {is_advance_payment})")
            except Exception as e:
                logger.error(f"Failed to create transaction mapping: {e}")
                return Response({
                    'success': False,
                    'message': f'Failed to create transaction mapping: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Get base URL from request
            base_url = f"{request.scheme}://{request.get_host()}"
            callback_urls = generate_payment_urls(base_url, base_invoice_number)
            
            # Sanitize reference (remove special chars that might break bank gateways)
            import re
            clean_unit_name = re.sub(r'[^a-zA-Z0-9\s-]', '', unit.unit_name)
            reference = f"Service Fee - {clean_unit_name}"
            
            # Initialize payment with PayStation
            gateway = get_payment_gateway()
            payment_data = {
                'invoice_number': base_invoice_number,
                'payment_amount': "{:.2f}".format(float(amount)), # Ensure 2 decimal places
                'currency': 'BDT',
                'reference': reference,
                'cust_name': customer_name,
                'cust_phone': customer_phone,
                'cust_email': customer_email,
                'cust_address': customer_address,
                'callback_url': callback_urls['callback_url'],
                'success_url': callback_urls['success_url'],
                'fail_url': callback_urls['fail_url'],
                'cancel_url': callback_urls['cancel_url'],
                'checkout_items': f'Service Fee Payment for Unit {unit.unit_name}',
            }
            
            result = gateway.init_payment(payment_data)
            
            if result.get('success'):
                return Response({
                    'success': True,
                    'payment_url': result.get('payment_url'),
                    'invoice_number': base_invoice_number,
                    'message': 'Payment session created successfully',
                    'payment_ids': [p.id for p in created_payments]
                }, status=status.HTTP_200_OK)
            else:
                # Mark payments as failed
                for payment in created_payments:
                    payment.payment_status = 'failed'
                    payment.save()
                
                return Response({
                    'success': False,
                    'message': result.get('message', 'Payment initialization failed'),
                    'error': result.get('error')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"PayStation init error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': f'Payment initialization error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayStationPaymentSuccessView(APIView):
    """
    Handle successful payment callback from PayStation
    PayStation sends callbacks via GET with URL parameters
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Handle PayStation success callback (GET request)"""
        return self._process_callback(request)
    
    def post(self, request):
        """Handle PayStation success callback (POST request - fallback)"""
        return self._process_callback(request)
    
    def _process_callback(self, request):
        """Process PayStation success callback"""
        try:
            # PayStation sends: ?status=Successful&invoice_number=PS-XXX&trx_id=XXX&message=...
            invoice_number = request.query_params.get('invoice_number') or request.data.get('invoice_number')
            callback_status = request.query_params.get('status') or request.data.get('status')
            trx_id = request.query_params.get('trx_id') or request.data.get('trx_id')
            message = request.query_params.get('message') or request.data.get('message')
            
            if not invoice_number:
                return Response({
                    'success': False,
                    'message': 'Invoice number not provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"PayStation callback received - Status: {callback_status}, Invoice: {invoice_number}, TrxID: {trx_id}, Message: {message}")
            logger.info(f"Full Query Params: {request.query_params}")
            logger.info(f"Full Body Data: {request.data}")
            
            # Check if payment actually succeeded
            if callback_status and callback_status.lower() not in ['successful', 'success']:
                logger.warning(f"PayStation callback with non-success status: {callback_status} for invoice: {invoice_number}")
                
                # Double-check with API - maybe the callback status is misleading or "Processing"
                logger.info("Attempting to verify status via API despite failed callback status...")
                gateway = get_payment_gateway()
                validation_result = gateway.check_transaction_status(invoice_number)
                
                api_status = validation_result.get('status', '').lower()
                logger.info(f"Double-check result: {api_status}")
                
                if not validation_result.get('success') and api_status not in ['success', 'successful', 'paid']:
                    # Confirm it really failed
                    # Log the failed transaction
                    mapping = PayStationTransactionMapping.objects.filter(invoice_number=invoice_number).first()
                    if mapping:
                        logger.info(f"Transaction confirmed failed for invoice: {invoice_number}, Amount: {mapping.amount}")
                    
                    error_message = message or "Payment was not successful"
                    return Response({
                        'success': False,
                        'error': f'Payment Failed: {error_message}',
                        'message': error_message,
                        'invoice_number': invoice_number,
                        'status': callback_status or 'Failed'
                    }, status=status.HTTP_200_OK)
                else:
                    logger.info("🎉 API check says SUCCESS! Ignoring failed callback status.")
                    # Fall through to success processing logic below
            
            # Get transaction mapping first
            mapping = PayStationTransactionMapping.objects.filter(invoice_number=invoice_number).first()
            if not mapping:
                logger.error(f"Transaction mapping not found for invoice: {invoice_number}")
                return Response({
                    'success': False,
                    'message': 'Transaction mapping not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Get payment IDs from mapping (checks expiration internally)
            payment_ids = PayStationTransactionMapping.get_payment_ids(invoice_number)
            
            # For regular payments, we need valid payment IDs
            # For advance payments, payment_ids might be empty if we skipped creating dummy records
            if not payment_ids and not mapping.is_advance_payment:
                logger.error(f"No payment mapping found or expired for invoice: {invoice_number}")
                return Response({
                    'success': False,
                    'message': 'Payment mapping not found or expired'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Verify payment with PayStation
            # If we already validated above, reuse the result
            if 'validation_result' in locals():
                logger.info("Using already fetched validation result")
            else:
                gateway = get_payment_gateway()
                validation_result = gateway.check_transaction_status(invoice_number)
            
            if not validation_result.get('success'):
                # Check if it's just "Processing"
                status_raw = validation_result.get('status', '').lower()
                trx_status_raw = validation_result.get('data', {}).get('trx_status', '').lower()
                
                if status_raw == 'processing' or trx_status_raw == 'processing':
                     logger.info("⚠️ Payment is PROCESSING. Treating as success for Sandbox testing.")
                     # Fake success for sandbox "Processing" state
                     validation_result['success'] = True
                     validation_result['status'] = 'success'
                else:
                    logger.error(f"Failed to verify payment: {validation_result.get('message')}")
                    return Response({
                        'success': False,
                        'message': 'Payment verification failed'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            payment_status = validation_result.get('status', '').lower()
            
            if payment_status not in ['paid', 'success', 'successful', 'processing']:
                return Response({
                    'success': False,
                    'message': f'Payment not successful. Status: {payment_status}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            total_paid_amount = float(mapping.amount)  # Actual amount paid by user
            is_advance_payment = mapping.is_advance_payment  # Check if this is an advance payment
            
            logger.info(f"📊 Processing payment completion - Total paid: {total_paid_amount}, Payment IDs: {payment_ids}, Advance: {is_advance_payment}")
            
            # Handle pure advance payment (no bills to pay)
            if is_advance_payment:
                logger.info(f"💰 Processing ADVANCE PAYMENT for Unit {mapping.unit_id}")
                
                from .models import AdvancePayment
                # Unit, Owner already imported at module top from towers.models
                
                try:
                    with transaction.atomic():
                        # Get unit and account holder info
                        unit = Unit.objects.get(id=mapping.unit_id)
                        
                        # Determine account holder (try owner first)
                        account_holder_type = 'owner'
                        account_holder_id = None
                        created_by = None
                        
                        owner = Owner.objects.filter(unit_id=mapping.unit_id).first()
                        if owner:
                            account_holder_id = owner.id
                            created_by = owner.member if hasattr(owner, 'member') else None
                        
                        # Create AdvancePayment record
                        advance_payment = AdvancePayment.objects.create(
                            unit_id=mapping.unit_id,
                            account_holder_type=account_holder_type,
                            account_holder_id=account_holder_id,
                            amount=total_paid_amount,
                            remaining_amount=total_paid_amount,
                            status='available',
                            advance_type='advance_payment',
                            created_by=created_by,
                            notes=f"Advance payment via PayStation - Invoice: {invoice_number}"
                        )
                        
                        logger.info(f"✅ Created AdvancePayment (ID={advance_payment.id}, Amount={total_paid_amount})")
                        
                        # Create ServiceFeeBilling record for receipt
                        # Extract actual payment method from Paystation response
                        raw_payment_method = (validation_result.get('payment_method') or '').strip().lower()
                        paystation_method = _normalize_paystation_method(raw_payment_method) or 'N/A'
                        
                        logger.info(f"💳 Payment Method - Raw: '{raw_payment_method}', Normalized: '{paystation_method}'")
                        
                        # Get or create PaymentMethod record for this method
                        payment_method_obj = None
                        if paystation_method and paystation_method != 'N/A':
                            payment_method_obj, created = PaymentMethod.objects.get_or_create(
                                method_name=paystation_method,
                                defaults={'is_active': True, 'display_order': 100}
                            )
                            if created:
                                logger.info(f"✅ Created new PaymentMethod: {paystation_method}")
                        
                        billing = ServiceFeeBilling.objects.create(
                            servicefeepaymentid=None,  # Pure advance, no SFP
                            advance_payment=advance_payment,
                            payment_type='advance_payment',
                            billing_amount=0,
                            total_paid=total_paid_amount,
                            currency='BDT',
                            payment_date=timezone.now(),
                            reference_number=trx_id or validation_result.get('transaction_id'),
                            transaction_id=invoice_number,
                            receipt_id=f"ADV-{invoice_number[-8:]}",
                            created_by=created_by,
                            notes=f"Advance Payment via PayStation - {invoice_number}",
                            payment_gateway='paystation',
                            payment_method=payment_method_obj,  # Use FK instead of string
                            other_method_name=paystation_method if not payment_method_obj else None,
                        )
                        
                        logger.info(f"✅ Created ServiceFeeBilling (ID={billing.id}) for Advance Payment")
                        
                        # Create voucher for advance payment
                        try:
                            from .utils.voucher_generator import create_payment_voucher
                            unit = Unit.objects.filter(id=mapping.unit_id).first()
                            voucher_result = create_payment_voucher(
                                billing_records=[billing],
                                total_amount=float(billing.total_paid),  # Use actual cash in billing record
                                payment_method_id=payment_method_obj.id if payment_method_obj else None,
                                member=created_by,
                                unit=unit,
                                batch_receipt_id=billing.receipt_id,
                                notes=f"Advance Payment via PayStation ({paystation_method}) - {invoice_number}",
                                entry_date=billing.payment_date.date() if billing.payment_date else None
                            )
                            if voucher_result.get('success'):
                                logger.info(f"✅ Voucher created for advance payment: {voucher_result.get('voucher_id')}")
                            else:
                                logger.warning(f"⚠️ Voucher creation failed: {voucher_result.get('message')}")
                        except Exception as ve:
                            logger.error(f"❌ Error creating voucher for advance payment: {str(ve)}")
                            import traceback
                            traceback.print_exc()
                        
                        # ---> ADMIN AND COMMUNITY NOTIFICATIONS <---
                        try:
                            from notifications.utils import (
                                create_service_fee_payment_received_notification,
                                create_community_member_payment_confirmation
                            )
                            logger.info(f"[PayStation] Sending notifications for pure advance payment of {total_paid_amount}")
                            
                            # Admin notification 
                            # Note: AdvancePayment now works directly with the notification utility
                            create_service_fee_payment_received_notification(
                                payment=advance_payment,
                                payment_amount=total_paid_amount,
                                payment_method=paystation_method,
                                recorded_by=created_by,
                                transaction_id=billing.id if billing else None
                            )
                            
                            # Community member confirmation
                            create_community_member_payment_confirmation(
                                payment=advance_payment,
                                payment_amount=total_paid_amount,
                                transaction_id=billing.id if billing else None
                            )
                        except Exception as notif_err:
                            logger.error(f"[PayStation] Error creating payment notifications for advance: {str(notif_err)}")
                            import traceback
                            traceback.print_exc()

                        # Send email receipt
                        if billing and billing.receipt_id:
                            logger.info(f"[PayStation] Scheduling email receipt for pure advance: {billing.receipt_id}")
                            transaction.on_commit(lambda rid=billing.receipt_id: trigger_bulk_payment_receipt_emails([rid]))
                        return Response({
                            'success': True,
                            'message': 'Advance payment completed successfully',
                            'invoice_number': invoice_number,
                            'advance_payment_id': advance_payment.id,
                            'advance_amount': str(advance_payment.amount),
                            'remaining_amount': str(advance_payment.remaining_amount)
                        }, status=status.HTTP_200_OK)
                        
                except Exception as e:
                    logger.error(f"❌ Failed to create advance payment: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    return Response({
                        'success': False,
                        'message': f'Failed to process advance payment: {str(e)}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Process regular bill payments - SINGLE RECEIPT (same design as multi-month payment)
            with transaction.atomic():
                advance_payment_obj = None
                payments = ServiceFeePayment.objects.filter(id__in=payment_ids).order_by('service_period_year', 'service_period_month')
                
                logger.info(f"📋 Found {payments.count()} payment records to process")
                
                # Generate a single batch receipt_id upfront for consolidated receipt
                from .models import generate_unique_sequential_id
                from datetime import datetime
                now = datetime.now()
                batch_receipt_id = generate_unique_sequential_id(ServiceFeeBilling, 'receipt_id', f"RCP-{now.year}-{now.month:02d}-", 5)
                batch_transaction_id = generate_unique_sequential_id(ServiceFeeBilling, 'transaction_id', f"TXN-{now.year}-{now.month:02d}-", 8)
                
                logger.info(f"📄 Generated batch receipt_id: {batch_receipt_id}, transaction_id: {batch_transaction_id}")
                
                # Extract payment method info once (shared across all billing records)
                raw_payment_method = (validation_result.get('payment_method') or '').strip().lower()
                paystation_method = _normalize_paystation_method(raw_payment_method) or 'N/A'
                
                logger.info(f"💳 Payment Method - Raw: '{raw_payment_method}', Normalized: '{paystation_method}'")
                
                # Get or create PaymentMethod record for this method
                payment_method_obj = None
                if paystation_method and paystation_method != 'N/A':
                    payment_method_obj, created = PaymentMethod.objects.get_or_create(
                        method_name=paystation_method,
                        defaults={'is_active': True, 'display_order': 100}
                    )
                    if created:
                        logger.info(f"✅ Created new PaymentMethod: {paystation_method}")
                
                # Get payer_member info (shared across all billing records)
                payer_member = None
                first_payment = payments.first()
                if first_payment:
                    owner = Owner.objects.filter(unit_id=first_payment.unit_id).select_related('member').first()
                    if owner and getattr(owner, 'member', None):
                        payer_member = owner.member
                    if not payer_member:
                        resident = Resident.objects.filter(unit_id=first_payment.unit_id).select_related('member').first()
                        if resident and getattr(resident, 'member', None):
                            payer_member = resident.member
                
                # Collect all billing records for consolidated voucher
                all_billing_records = []
                
                remaining_to_distribute = total_paid_amount
                
                # One batch receipt for entire transaction (bills + advance), same as ServiceFeeMultiMonthPaymentView
                from datetime import datetime
                now = datetime.now()
                batch_transaction_id = generate_unique_sequential_id(ServiceFeeBilling, 'transaction_id', f"TXN-{now.year}-{now.month:02d}-", 8)
                batch_receipt_id = generate_unique_sequential_id(ServiceFeeBilling, 'receipt_id', f"RCP-{now.year}-{now.month:02d}-", 5)
                logger.info(f"🆔 PayStation batch receipt: {batch_receipt_id}")
                
                raw_payment_method = (validation_result.get('payment_method') or '').strip().lower()
                paystation_method = _normalize_paystation_method(raw_payment_method) or 'N/A'
                payment_method_obj = None
                if paystation_method and paystation_method != 'N/A':
                    payment_method_obj, _ = PaymentMethod.objects.get_or_create(
                        method_name=paystation_method,
                        defaults={'is_active': True, 'display_order': 100}
                    )
                all_billing_records = []
                
                for payment in payments:
                    logger.info(f"🔄 Processing payment ID={payment.id}, Period={payment.service_period_month}/{payment.service_period_year}")
                    
                    # Get actual due amount for this period
                    can_pay, actual_remaining, existing_total_paid, fee_amount = validate_payment_eligibility(
                        payment.unit_id,
                        payment.service_fee_id,
                        payment.service_period_month,
                        payment.service_period_year
                    )
                    
                    logger.info(f"   Fee={fee_amount}, Already paid={existing_total_paid}, Remaining={actual_remaining}")
                    
                    # Calculate how much to apply to this payment
                    amount_to_apply = min(remaining_to_distribute, actual_remaining)
                    
                    logger.info(f"   Amount to apply this transaction: {amount_to_apply}")
                    
                    if amount_to_apply <= 0:
                        logger.warning(f"   ⚠️ Skipping - no amount to apply")
                        continue
                    
                    # Calculate new remaining amount after this payment
                    new_total_paid = existing_total_paid + amount_to_apply
                    new_remaining = fee_amount - new_total_paid
                    
                    # Determine service status
                    if new_remaining <= 0:
                        new_service_status = 'paid'
                    elif new_total_paid > 0:
                        # Some payment made → always 'partial', never 'overdue'
                        # Even if past due date, a partial payment means 'partial'
                        new_service_status = 'partial'
                    else:
                        # No payment at all → check if overdue
                        if payment.due_date and timezone.now().date() > payment.due_date:
                            new_service_status = 'overdue'
                        else:
                            new_service_status = 'due'
                    
                    logger.info(f"   New status: {new_service_status}, New remaining: {new_remaining}")
                    
                    # CRITICAL: Refresh payment object from DB to ensure we have latest data
                    payment.refresh_from_db()
                    
                    # Update payment record
                    # CRITICAL: Keep payment.amount as the FULL fee, don't overwrite it
                    # payment_status should reflect service_status: 'completed' only if fully paid
                    if new_service_status == 'paid':
                        payment.payment_status = 'completed'
                        payment.completion_date = timezone.now()
                    else:
                        payment.payment_status = 'pending'  # Partial or due = still pending
                    
                    payment.service_status = new_service_status
                    payment.remaining_amount = new_remaining  # Update remaining amount
                    payment.total_paid = new_total_paid  # Keep bill in sync for reports/history
                    
                    # Log before save to verify values
                    logger.info(f"   💾 Saving payment - ID={payment.id}, service_status={new_service_status}, remaining={new_remaining}, total_paid={new_total_paid}")
                    
                    payment.save(update_fields=['payment_status', 'completion_date', 'service_status', 'remaining_amount', 'total_paid'])
                    
                    # Log after save to confirm persistence
                    payment.refresh_from_db()
                    logger.info(f"   ✅ Payment {payment.id} saved and verified - Status: {payment.service_status}, Remaining: {payment.remaining_amount}, Total Paid: {payment.total_paid}")
                    
                    # Create billing record for this payment (same receipt as rest of batch)
                    # Determine payment_result_status for this specific transaction
                    # This records whether THIS payment completed the bill or left a balance
                    # CRITICAL: Compare CUMULATIVE total_paid to fee_amount, not just this transaction
                    if new_total_paid >= fee_amount:
                        # After this payment, the bill is fully paid
                        payment_result_status = 'full'
                    elif new_total_paid < fee_amount:
                        # After this payment, there's still a balance remaining
                        payment_result_status = 'partial'
                    else:
                        payment_result_status = 'full'  # Default to full
                    
                    # Create billing record for this payment transaction
                    # CRITICAL: Use the same batch_receipt_id and batch_transaction_id for consolidated receipt
                    billing = ServiceFeeBilling.objects.create(
                        receipt_id=batch_receipt_id,
                        transaction_id=batch_transaction_id,
                        servicefeepaymentid=payment,
                        billing_amount=fee_amount,  # Full fee amount
                        total_paid=amount_to_apply,  # Actual amount paid in transaction
                        currency='BDT',
                        payment_date=timezone.now(),
                        due_date=payment.due_date,
                        payment_type='service_fee_bill_payment',
                        reference_number=trx_id or validation_result.get('transaction_id'),
                        created_by=payer_member,  # Member (owner/resident), not User; correct for mobile self-payment
                        payment_gateway='paystation',
                        payment_method=payment_method_obj,
                        other_method_name=paystation_method if not payment_method_obj else None,
                        payment_result_status=payment_result_status,
                    )
                    
                    all_billing_records.append(billing)
                    logger.info(f"✅ Billing record {billing.id} created - billing_amount={fee_amount}, total_paid={amount_to_apply}, result_status={payment_result_status}")
                    
                    remaining_to_distribute -= amount_to_apply
                
                logger.info(f"🎉 Payment processing completed - Remaining to distribute: {remaining_to_distribute}")
                
                # Handle overpayment: Convert excess amount to advance payment
                # ONLY if ALL bills are fully paid (no partial payments)
                if remaining_to_distribute > 0:
                    # CRITICAL: Check if all processed payments are fully paid
                    # AND check if there are ANY other pending payments for this unit
                    all_fully_paid = all(
                        payment.service_status == 'paid' 
                        for payment in payments
                    )
                    
                    # Additional safety check: Verify no other pending payments exist for this unit
                    first_payment = payments.first()
                    if first_payment:
                        other_pending_payments = ServiceFeePayment.objects.filter(
                            unit_id=first_payment.unit_id,
                            service_status__in=['due', 'partial', 'overdue']
                        ).exclude(
                            id__in=[p.id for p in payments]
                        ).exists()
                        
                        if other_pending_payments:
                            logger.warning(f"⚠️ Other pending payments exist for unit {first_payment.unit_id} - NOT creating advance")
                            all_fully_paid = False
                    
                    if all_fully_paid:
                        logger.info(f"💰 All bills fully paid - Excess amount {remaining_to_distribute} will become advance payment")
                        
                        from .models import AdvancePayment
                        # Owner already imported at module top from towers.models
                        
                        try:
                            # Get unit from first payment
                            first_payment = payments.first()
                            unit_id = first_payment.unit_id
                            
                            # Determine account holder (try owner first)
                            account_holder_type = 'owner'
                            account_holder_id = None
                            
                            owner = Owner.objects.filter(unit_id=unit_id).first()
                            if owner:
                                account_holder_id = owner.id
                            
                            # Create AdvancePayment record for the excess
                            advance_payment = AdvancePayment.objects.create(
                                unit_id=unit_id,
                                account_holder_type=account_holder_type,
                                account_holder_id=account_holder_id,
                                amount=remaining_to_distribute,
                                remaining_amount=remaining_to_distribute,
                                status='available',
                                advance_type='advance_payment',  # Consistent: use 'advance_payment' for both pure advance and overpayment
                                created_by=payer_member,  # Use payer_member (consistent with bill payments)
                                notes=f"Advance payment (overpayment) via PayStation - Invoice: {invoice_number}"
                            )
                            # Capture for consolidated notification
                            advance_payment_obj = advance_payment
                            
                            logger.info(f"✅ Created AdvancePayment for excess amount (ID={advance_payment.id}, Amount={remaining_to_distribute})")
                            
                            # Create ServiceFeeBilling for advance on SAME receipt (single receipt like multi-month)
                            overpayment_billing = ServiceFeeBilling.objects.create(
                                receipt_id=batch_receipt_id,
                                transaction_id=batch_transaction_id,
                                servicefeepaymentid=None,
                                advance_payment=advance_payment,
                                payment_type='advance_payment',
                                billing_amount=0,
                                total_paid=remaining_to_distribute,
                                currency='BDT',
                                payment_date=timezone.now(),
                                reference_number=trx_id or validation_result.get('transaction_id'),
                                created_by=payer_member,  # Use payer_member (consistent with bill payments)
                                payment_gateway='paystation',
                                payment_method=payment_method_obj,
                                other_method_name=paystation_method if not payment_method_obj else None,
                                notes=f"Advance payment (overpayment converted) via PayStation - Invoice: {invoice_number}"
                            )
                            all_billing_records.append(overpayment_billing)
                            logger.info(f"✅ Created billing record for advance (ID={overpayment_billing.id}) on receipt {batch_receipt_id}")
                            
                        except Exception as e:
                            logger.error(f"❌ Failed to create advance payment for excess amount: {str(e)}")
                            import traceback
                            traceback.print_exc()
                            # Don't fail the entire transaction, just log the error
                    else:
                        logger.info(f"⚠️ Partial payment exists - Excess amount {remaining_to_distribute} NOT converted to advance")
                        logger.info(f"   Bills with partial status exist. Advance only created when all bills fully paid.")
                
                # Single voucher for entire transaction (same as ServiceFeeMultiMonthPaymentView)
                if all_billing_records:
                    try:
                        from .utils.voucher_generator import create_payment_voucher, create_waiver_adjustment_voucher
                        first_payment = payments.first()
                        unit = first_payment.unit if first_payment else None
                        created_by = request.user if request.user.is_authenticated else None
                        if not created_by and first_payment and first_payment.unit_id:
                            owner = Owner.objects.filter(unit_id=first_payment.unit_id).first()
                            if owner and hasattr(owner, 'member'):
                                created_by = owner.member
                        
                        # CRITICAL FIX: Calculate actual total cash from billing records instead of using payment input
                        # This ensures debit and credit sides match in the voucher
                        actual_total_cash = sum(float(b.total_paid) for b in all_billing_records)
                        logger.info(f"   💰 Voucher Generation: total_paid_amount={total_paid_amount}, actual_total_cash={actual_total_cash}")
                        
                        voucher_result = create_payment_voucher(
                            billing_records=all_billing_records,
                            total_amount=actual_total_cash,  # Use actual cash allocated, not payment input
                            payment_method_id=payment_method_obj.id if payment_method_obj else None,
                            member=created_by,
                            unit=unit,
                            batch_receipt_id=batch_receipt_id,
                            notes=f"PayStation payment - {invoice_number}",
                            entry_date=all_billing_records[0].payment_date.date() if all_billing_records and all_billing_records[0].payment_date else None
                        )
                        if voucher_result.get('success'):
                            new_voucher_id = voucher_result.get('voucher_id')
                            if new_voucher_id:
                                ServiceFeeBilling.objects.filter(id__in=[b.id for b in all_billing_records]).update(voucher_id=new_voucher_id)
                            logger.info(f"✅ Single voucher created for receipt {batch_receipt_id}: {voucher_result.get('voucher_number')}")
                        else:
                            logger.warning(f"⚠️ Voucher creation failed: {voucher_result.get('message')}")
                        waiver_result = create_waiver_adjustment_voucher(
                            billing_records=all_billing_records,
                            member=created_by,
                            unit=unit,
                            batch_receipt_id=batch_receipt_id,
                            entry_date=all_billing_records[0].payment_date.date() if all_billing_records and all_billing_records[0].payment_date else None
                        )
                        if waiver_result.get('success') and waiver_result.get('voucher_number'):
                            logger.info(f"✅ Adjustment voucher created: {waiver_result.get('voucher_number')}")
                    except Exception as ve:
                        logger.error(f"❌ Error creating voucher: {str(ve)}")
                        import traceback
                        traceback.print_exc()
            
            # ---> ADMIN AND COMMUNITY NOTIFICATIONS <---
            try:
                from notifications.utils import (
                    create_service_fee_payment_received_notification,
                    create_community_member_payment_confirmation
                )
                
                # Consolidated notification for total payment amount (Bills + Advance)
                # Pick a representative payment object for context (Unit, etc.)
                notification_payment = payments.first() or advance_payment_obj
                
                if notification_payment:
                    logger.info(f"[PayStation] Sending consolidated notification for total paid amount: {total_paid_amount}")
                    
                    # Determine a transaction ID for uniqueness in notification storage
                    notif_transaction_id = mapping.id if mapping else None
                    if not notif_transaction_id and all_billing_records:
                        notif_transaction_id = all_billing_records[0].id

                    # Determine custom period text for notification
                    import calendar
                    custom_period_text = None
                    month_count = payments.count()
                    has_advance = advance_payment_obj is not None
                    
                    if month_count > 1:
                        if has_advance:
                            custom_period_text = f"{month_count} months and advance payment"
                        else:
                            custom_period_text = f"{month_count} months service fees"
                    elif month_count == 1:
                        if has_advance:
                            try:
                                m_idx = notification_payment.service_period_month
                                m_name = calendar.month_name[m_idx]
                                custom_period_text = f"{m_name} and advance payment"
                            except:
                                custom_period_text = "month and advance payment"
                        else:
                            # Normal single month
                            pass
                    elif has_advance:
                        custom_period_text = "advance payment"

                    # Admin notification
                    create_service_fee_payment_received_notification(
                        payment=notification_payment,
                        payment_amount=total_paid_amount,
                        payment_method=paystation_method,
                        recorded_by=None,  # Automatically recorded by IPN
                        transaction_id=notif_transaction_id,
                        custom_period=custom_period_text
                    )
                    
                    # Community member confirmation
                    create_community_member_payment_confirmation(
                        payment=notification_payment,
                        payment_amount=total_paid_amount,
                        transaction_id=notif_transaction_id,
                        custom_period=custom_period_text
                    )
            except Exception as notif_err:
                logger.error(f"[PayStation] Could not create payment notification: {str(notif_err)}")
                import traceback
                traceback.print_exc()

            # Send email receipt if enabled
            if batch_receipt_id:
                logger.info(f"[PayStation] Scheduling email receipt (regular/mixed): {batch_receipt_id}")
                transaction.on_commit(lambda rid=batch_receipt_id: trigger_bulk_payment_receipt_emails([rid]))

            return Response({
                'success': True,
                'message': 'Payment completed successfully',
                'invoice_number': invoice_number,
                'payment_ids': payment_ids,
                'receipt_id': batch_receipt_id if all_billing_records else None,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"PayStation success callback error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': f'Payment processing error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayStationPaymentFailView(APIView):
    """
    Handle failed payment callback from PayStation
    PayStation sends callbacks via GET with URL parameters
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Handle PayStation fail callback (GET request)"""
        return self._process_callback(request)
    
    def post(self, request):
        """Handle PayStation fail callback (POST request - fallback)"""
        return self._process_callback(request)
    
    def _process_callback(self, request):
        """Process PayStation fail callback"""
        try:
            # PayStation sends: ?status=Failed&invoice_number=PS-XXX&message=...
            invoice_number = request.query_params.get('invoice_number') or request.data.get('invoice_number')
            callback_status = request.query_params.get('status') or request.data.get('status')
            message = request.query_params.get('message') or request.data.get('message')
            
            if not invoice_number:
                return Response({
                    'success': False,
                    'message': 'Invoice number not provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"PayStation FAIL callback - Invoice: {invoice_number}, Status: {callback_status}, Message: {message}")
            
            # Get payment IDs
            payment_ids = PayStationTransactionMapping.get_payment_ids(invoice_number)
            
            if payment_ids:
                # Mark payments as failed (don't actually update - they should remain in their current state)
                # Just log the failure
                logger.info(f"Payment IDs {payment_ids} associated with failed transaction {invoice_number}")
            
            return Response({
                'success': True,
                'message': f'Payment failure acknowledged: {message or "Payment failed"}',
                'invoice_number': invoice_number
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"PayStation fail callback error: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error processing failure: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayStationPaymentCancelView(APIView):
    """
    Handle cancelled payment callback from PayStation
    PayStation sends callbacks via GET with URL parameters
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Handle PayStation cancel callback (GET request)"""
        return self._process_callback(request)
    
    def post(self, request):
        """Handle PayStation cancel callback (POST request - fallback)"""
        return self._process_callback(request)
    
    def _process_callback(self, request):
        """Process PayStation cancel callback"""
        try:
            # PayStation sends: ?status=Canceled&invoice_number=PS-XXX&message=...
            invoice_number = request.query_params.get('invoice_number') or request.data.get('invoice_number')
            callback_status = request.query_params.get('status') or request.data.get('status')
            message = request.query_params.get('message') or request.data.get('message')
            
            if not invoice_number:
                return Response({
                    'success': False,
                    'message': 'Invoice number not provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"PayStation CANCEL callback - Invoice: {invoice_number}, Status: {callback_status}, Message: {message}")
            
            # Get payment IDs
            payment_ids = PayStationTransactionMapping.get_payment_ids(invoice_number)
            
            if payment_ids:
                # Don't update payment status - they should remain as 'pending' or current state
                # Just log the cancellation
                logger.info(f"Payment IDs {payment_ids} associated with cancelled transaction {invoice_number}")
            
            return Response({
                'success': True,
                'message': f'Payment cancellation acknowledged: {message or "Payment cancelled by user"}',
                'invoice_number': invoice_number
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"PayStation cancel callback error: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error processing cancellation: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayStationPaymentIPNView(APIView):
    """
    Handle IPN (Instant Payment Notification) from PayStation
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """Handle PayStation IPN"""
        try:
            logger.info(f"PayStation IPN received: {request.data}")
            
            invoice_number = request.data.get('invoice_number')
            
            if not invoice_number:
                return Response({
                    'success': False,
                    'message': 'Invoice number not provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify payment status
            gateway = get_payment_gateway()
            validation_result = gateway.check_transaction_status(invoice_number)
            
            if validation_result.get('success'):
                payment_status = validation_result.get('status', '').lower()
                logger.info(f"IPN payment status for {invoice_number}: {payment_status}")
            
            return Response({
                'success': True,
                'message': 'IPN received'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"PayStation IPN error: {str(e)}")
            return Response({
                'success': False,
                'message': f'IPN processing error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayStationStatusCheckView(APIView):
    """
    Manual status check for PayStation payment
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Check payment status"""
        try:
            invoice_number = request.data.get('invoice_number')
            
            if not invoice_number:
                return Response({
                    'success': False,
                    'message': 'Invoice number required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            gateway = get_payment_gateway()
            result = gateway.check_transaction_status(invoice_number)
            
            return Response(result, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Status check error: {str(e)}")
            return Response({
                'success': False,
                'message': f'Status check error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
