import logging
import json
import threading
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from .models import ServiceFeeBilling, ServiceFeeGenerate, PaymentMethod, ServiceFeeGenerationSchedule, BillUpload, BillUploadDetail, PenaltyWaiver, AdvancePayment
from service_fee.models import ServiceFee  # Import from original service_fee module
from audit_trail.create_audit_trail import create_audit_trail
from .serializers import (
    ServiceFeeBillingSerializer,
    ServiceFeePaymentSerializer,  # Keep serializer name unchanged for API compatibility
    ServiceFeePaymentListSerializer,
    ServiceFeeGenerationScheduleSerializer
)
from towers.models import Tower, Unit
from user.models import Member
from towers.models import Resident
from django.db.models import Prefetch, Q, OuterRef, Subquery, Exists, F, Value, CharField, Case, When, Sum
from django.db import models
from datetime import datetime, timedelta
from django.db.models.functions import Concat, Cast
from django.db.models import DateField
from decimal import Decimal
from django.utils import timezone
import time
import calendar

# Use raw SQL with LEFT JOINs + DIRECT COLUMN ALIASES + PAYMENT_DATE FILTERING - NO PYTHON LOOPS AT ALL
from django.db import connection, transaction

# Import email utilities
from .utils.email_utils import send_payment_receipt_email, get_resident_email, trigger_bulk_payment_receipt_emails
from .utils.service_fee_generator import generate_service_fees
from datetime import datetime
import csv
import io
from bill_categories.models import BillCategory

# SEMANTIC NAMING: ServiceFeeGenerate represents GENERATED BILLS (not payment transactions)
# Actual payment transactions are stored in ServiceFeeBilling
# Using ServiceFeeGenerate for clarity, but ServiceFeePayment alias available for compatibility
ServiceFeePayment = ServiceFeeGenerate  # Backward compatibility alias

try:
    from weasyprint import HTML as WeasyHTML
    HAS_WEASYPRINT = True
except Exception:
    WeasyHTML = None
    HAS_WEASYPRINT = False

logger = logging.getLogger(__name__)

class TowerListOptimizedView(APIView):
    """
    Tower list for Service Fee Management.
    Returns only towers (no units).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sql = """
                SELECT id, tower_name AS name
                FROM towers_tower
                ORDER BY tower_name ASC
            """
            with connection.cursor() as cursor:
                cursor.execute(sql)
                columns = [col[0] for col in cursor.description]
                data = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Apply natural sorting
            # Apply natural sorting
            import re
            def natural_sort_key(s):
                if not s: return (2, [])
                s = str(s).strip()
                if not s: return (2, [])
                
                # Check if there is ANY digit in the string
                # If it has a digit, it's considered a "numeric tower" (Priority 0)
                # If not, it's alphabetical (Priority 1)
                has_digit = any(c.isdigit() for c in s)
                prefix = 0 if has_digit else 1
                
                parts = []
                for text in re.split(r'(\d+)', s):
                    if text.isdigit():
                        parts.append((0, int(text)))
                    elif text:
                        parts.append((1, text.lower()))
                return (prefix, parts)
            
            data.sort(key=lambda x: natural_sort_key(x['name']))
            
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class ServiceFeeOptionsView(APIView):
    """
    Lightweight, tower-filtered service fee options for frontend selects.
    Returns minimal fields and keeps existing endpoints untouched.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            is_active = request.query_params.get('is_active', 'true').lower() == 'true'
            tower_ids = request.query_params.get('tower_ids', '')
            ordering = request.query_params.get('ordering', None)

            # Build WHERE clause
            where_conditions = ["sf.is_active = %s"]
            params = [is_active]

            # Add tower filter if provided
            if tower_ids:
                id_list = [int(t.strip()) for t in tower_ids.split(',') if t.strip().isdigit()]
                if id_list:
                    placeholders = ','.join(['%s'] * len(id_list))
                    where_conditions.append(f"t.id IN ({placeholders})")
                    params.extend(id_list)

            where_clause = " AND ".join(where_conditions)

            # Build ORDER BY clause
            if ordering:
                order_clause = f"ORDER BY {ordering}"
            else:
                order_clause = "ORDER BY MIN(t.tower_name) ASC, sf.fee_amount ASC, sf.id ASC"

            sql = f"""
                SELECT 
                    sf.id,
                 concat(sf.fee_amount, ' ', sf.frequency) as fee_amount,
                    sf.currency,
                    GROUP_CONCAT(t.tower_name ORDER BY t.tower_name SEPARATOR ',') AS tower_names
                FROM service_fee_servicefee sf
                LEFT JOIN service_fee_servicefee_towers sft ON sft.servicefee_id = sf.id
                LEFT JOIN towers_tower t ON t.id = sft.tower_id
                WHERE {where_clause}
                GROUP BY sf.id, sf.fee_amount, sf.currency
                {order_clause}
            """

            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                
                data = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    # Convert tower_names string to array
                    tower_names_str = row_dict.get('tower_names', '')
                    tower_names = [name.strip() for name in tower_names_str.split(',')] if tower_names_str else []
                    data.append({
                        'id': row_dict['id'],
                        'fee_amount': str(row_dict['fee_amount']),
                        'currency': row_dict['currency'],
                        'tower_names': tower_names
                    })

            return Response({'success': True, 'data': data, 'count': len(data)}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_VIEW_SERVICE_FEE_SETTINGS,
    PERMISSION_ADD_SERVICE_FEE_SETTINGS,
    PERMISSION_EDIT_SERVICE_FEE_SETTINGS,
    PERMISSION_VIEW_SERVICE_FEE_OVERVIEW,
    PERMISSION_VIEW_UNIT_PAYMENT_HISTORY,
    PERMISSION_MANAGE_SCHEDULE_CONFIGURATION,
    PERMISSION_MANAGE_REMINDERS,
    PERMISSION_RECORD_PAYMENT,
    PERMISSION_GENERATE_SERVICE_FEES,
    PERMISSION_DELETE_GENERATED_SERVICE_FEES,
    PERMISSION_DELETE_RECORDED_PAYMENT,
    PERMISSION_VIEW_REMINDERS,
    PERMISSION_ADD_REMINDER,
    PERMISSION_EDIT_REMINDER,
    PERMISSION_DELETE_REMINDER,
    PERMISSION_BILL_UPLOADS,
    PERMISSION_VIEW_BILLING_MANAGEMENT,
    PERMISSION_VIEW_PAYMENT_METHODS,
    PERMISSION_VIEW_SERVICE_FEE_PAYMENTS,
    PERMISSION_ADD_PAYMENT_METHODS,
    PERMISSION_EDIT_PAYMENT_METHODS,
)


def validate_payment_eligibility(unit_id, service_fee_id, month, year, is_advance_payment=False):
    """
    Validate if a payment can be made for a specific month
    Returns: (can_pay, remaining_amount, total_paid, fee_amount)
    
    Args:
        unit_id: The unit ID
        service_fee_id: The service fee ID
        month: Service period month (1-12)
        year: Service period year (YYYY)
        is_advance_payment: If True, allow payment even if current period is fully paid
    
    CRITICAL: Check servicefeepayment table AFTER generation for accurate amount
    which includes penalties and waivers
    """
    try:
        print(f"\n🔍 validate_payment_eligibility called:")
        print(f"   unit_id={unit_id}, service_fee_id={service_fee_id}, month={month}, year={year}, is_advance={is_advance_payment}")
        
        # FIRST: Check if ServiceFeePayment exists (created after generation)
        # This has the CORRECT amount including penalties and waivers
        service_fee_payment = ServiceFeePayment.objects.filter(
            unit_id=unit_id,
            service_fee_id=service_fee_id,
            service_period_month=month,
            service_period_year=year
        ).first()
        
        if service_fee_payment:
            # USE servicefeepayment.amount which includes all charges
            fee_amount = float(service_fee_payment.amount)
            stored_remaining = float(service_fee_payment.remaining_amount or 0)
            
            print(f"   ✅ ServiceFeePayment found (after generation):")
            print(f"      amount={fee_amount} (includes penalties & waivers)")
            print(f"      stored remaining_amount={stored_remaining}")
            print(f"      service_status={service_fee_payment.service_status}")
            
            # Get total paid from billing records
            total_paid = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=service_fee_payment
            ).aggregate(total=Sum('total_paid'))['total'] or 0
            total_paid = float(total_paid) if total_paid else 0
            
            # Calculate actual remaining amount
            # If stored remaining is 0 but status is 'due' or 'overdue', calculate from amount
            if stored_remaining == 0 and service_fee_payment.service_status in ('due', 'overdue'):
                remaining_amount = fee_amount - total_paid
                print(f"      ⚠️ Recalculated remaining: {remaining_amount} (stored was 0 but status is {service_fee_payment.service_status})")
            else:
                remaining_amount = stored_remaining
            
            # Can pay if:
            # 1. Status is 'due' or 'overdue' (unpaid or partially paid), OR
            # 2. There's a positive remaining amount, OR
            # 3. It's an advance payment (allow payment even if current period is fully paid)
            can_pay = (
                service_fee_payment.service_status in ('due', 'overdue', 'partial') or
                remaining_amount > 0 or
                is_advance_payment
            )
            
            print(f"      total_paid={total_paid}")
            print(f"      actual_remaining={remaining_amount}")
            print(f"   🎯 Result: can_pay={can_pay}, remaining={remaining_amount}")
            
            return can_pay, remaining_amount, total_paid, fee_amount
        
        # FALLBACK: If no ServiceFeePayment exists yet, use service fee only
        print(f"   ⚠️ No ServiceFeePayment found - using service_fee as fallback")
        try:
            service_fee = ServiceFee.objects.get(id=service_fee_id)
            fee_amount = float(service_fee.fee_amount)
            print(f"   📋 Service fee found: fee_amount={fee_amount}")
        except ServiceFee.DoesNotExist:
            print(f"   ❌ ServiceFee not found: service_fee_id={service_fee_id}")
            return False, 0, 0, 0
        
        # Calculate total paid by summing all billing records for this period
        all_payments = ServiceFeePayment.objects.filter(
            unit_id=unit_id,
            service_fee_id=service_fee_id,
            service_period_month=month,
            service_period_year=year
        )
        
        total_paid = 0
        for payment in all_payments:
            billing_total = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=payment
            ).aggregate(total=Sum('total_paid'))['total'] or 0
            total_paid += float(billing_total) if billing_total else 0
        
        remaining_amount = fee_amount - total_paid
        
        print(f"   📊 Payment calculation (fallback):")
        print(f"      fee_amount={fee_amount}")
        print(f"      total_paid={total_paid}")
        print(f"      remaining_amount={remaining_amount}")
        
        # Can pay if:
        # 1. There's remaining amount, OR
        # 2. It's an advance payment (allow payment even if current period is fully paid)
        can_pay = remaining_amount > 0 or is_advance_payment
        
        print(f"   🎯 Result: can_pay={can_pay}, remaining={remaining_amount}")
        
        return can_pay, remaining_amount, total_paid, fee_amount
        
    except Exception as e:
        print(f"   ❌ Exception in validate_payment_eligibility: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, 0, 0, 0


def complete_pending_payment(payment_id):
    """
    Manually complete a pending payment and update service status
    """
    try:
        from django.utils import timezone
        from django.db.models import Sum
        
        # Get the payment
        payment = ServiceFeePayment.objects.get(id=payment_id)
        
        if payment.payment_status == 'completed':
            return True
            
        p_month = payment.service_period_month if payment.service_period_month else 0
        p_year = payment.service_period_year if payment.service_period_year else 0
        
        # Get transaction_id from billing record
        latest_billing = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment).order_by('-created_at').first()
        transaction_id = latest_billing.transaction_id if latest_billing else 'N/A'
        
        # Update payment status
        payment.payment_status = 'completed'
        payment.completion_date = timezone.now()
        # Note: ServiceFeePayment doesn't have a notes field
        
        # Get or create SSLCommerz payment method
        sslcommerz_method, created = PaymentMethod.objects.get_or_create(
            method_name='SSLCommerz',
            defaults={
                'display_order': 5,
                'description': 'SSLCommerz payment gateway',
                'is_active': True
            }
        )
        payment.payment_method_rel = sslcommerz_method
        
        # Calculate service status based on total payments for this month
        service_fee = ServiceFee.objects.get(id=payment.service_fee_id)
        total_fee_amount = float(service_fee.fee_amount)
        
        # Get period from payment
        period_month = payment.service_period_month
        period_year = payment.service_period_year
        
        # Get all OTHER completed payments for this period (excluding current payment)
        other_payments_total = ServiceFeePayment.objects.filter(
            unit_id=payment.unit_id,
            service_fee_id=payment.service_fee_id,
            service_period_month=period_month,
            service_period_year=period_year,
            payment_status='completed'
        ).exclude(
            id=payment.id  # Exclude current payment to avoid double counting
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # Add current payment amount to get TOTAL PAID for this month
        total_paid_for_month = other_payments_total + float(payment.amount)
        
        # Calculate service status
        if total_paid_for_month >= total_fee_amount:
            payment.service_status = 'paid'
        else:
            payment.service_status = 'partial'
        
        payment.save()
        
        return True
        
    except ServiceFeePayment.DoesNotExist:
        return False
    except Exception as e:
        return False
def send_payment_email_if_enabled(payment_obj, payment_data, send_email, operation_type="payment"):
    """
    Send payment receipt email if enabled and resident has email
    
    Args:
        payment_obj: The payment object with related fields
        payment_data: Serialized payment data
        send_email: Boolean flag from frontend
        operation_type: String describing the operation (e.g., "new payment", "payment update")
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    try:
        if send_email:
            # Refresh payment object to ensure we have latest data
            try:
                payment_obj.refresh_from_db()
            except Exception:
                pass
            
            # Get latest billing record for payment method, reference_number, notes, transaction_id
            latest_billing = None
            try:
                if hasattr(payment_obj, 'service_fee'):
                    latest_billing = ServiceFeeBilling.objects.filter(
                        servicefeepaymentid=payment_obj
                    ).order_by('-created_at').first()
                else:
                    latest_billing = ServiceFeeBilling.objects.filter(
                        advance_payment=payment_obj
                    ).order_by('-created_at').first()
            except Exception as e:
                print(f"Error getting billing record: {str(e)}")
            
            # Get resident email
            resident_email = get_resident_email(payment_data)
            if not resident_email:
                # Try to get email from unit if not in payment_data
                try:
                    if payment_obj.unit:
                        resident_email = payment_obj.unit.primary_email or payment_obj.unit.secondary_email
                except Exception:
                    pass
            
            if resident_email:
                # Prepare email data with additional fields
                email_data = payment_data.copy()
                
                # Get resident name from Unit table (primary_name or secondary_name)
                primary_name = payment_obj.unit.primary_name if payment_obj.unit else None
                secondary_name = payment_obj.unit.secondary_name if payment_obj.unit else None
                resident_full_name = primary_name or secondary_name or 'N/A'
                
                # Get payment method from billing record
                payment_method_display = 'N/A'
                if latest_billing and latest_billing.payment_method:
                    payment_method_display = latest_billing.payment_method.method_name
                elif payment_data.get('payment_method_display'):
                    payment_method_display = payment_data.get('payment_method_display')
                
                # Get reference number and notes from billing record
                reference_number = ''
                notes = ''
                receipt_id = ''
                transaction_id = payment_data.get('transaction_id', 'N/A')
                if latest_billing:
                    reference_number = latest_billing.reference_number or ''
                    notes = latest_billing.notes or ''
                    receipt_id = latest_billing.receipt_id or ''
                    transaction_id = latest_billing.transaction_id or transaction_id
                
                # Calculate the amount owed BEFORE this payment (for email display)
                # We need: service_fee_amount - (total paid BEFORE this payment)
                amount_owed_before_payment = None
                service_fee_amount = None
                total_paid_before = 0
                original_amount_for_email = None
                try:
                    from django.db.models import Sum
                    from decimal import Decimal
                    
                    # Get service fee amount
                    if hasattr(payment_obj, 'service_fee') and payment_obj.service_fee:
                        fee_amount = float(payment_obj.service_fee.fee_amount)
                        service_fee_amount = fee_amount
                        
                        # Get total paid BEFORE this payment using Billing records (history)
                        # This handles the case where ServiceFeePayment is an aggregate (one per month)
                        # and ensures we get the sum of all previous transactions
                        
                        # Get current transaction ID
                        current_txn_id = payment_data.get('transaction_id')
                        
                        # Filter billings for this payment object (which represents the service period)
                        previous_billings = ServiceFeeBilling.objects.filter(
                            servicefeepaymentid=payment_obj
                        )
                        
                        if current_txn_id and current_txn_id != 'N/A':
                            previous_billings = previous_billings.exclude(transaction_id=current_txn_id)
                        else:
                            # If no valid txn id, exclude the latest one created
                            if latest_billing:
                                previous_billings = previous_billings.exclude(id=latest_billing.id)
                        
                        # Debug: Log previous billings found
                        print(f"   Previous billings found: {previous_billings.count()}")
                        
                        total_paid_before_result = previous_billings.aggregate(total=Sum('total_paid'))['total'] or Decimal('0')
                        total_paid_before = float(total_paid_before_result)
                        
                        # Amount owed before this payment = fee_amount - total_paid_before
                        # This represents what was owed BEFORE making this payment
                        amount_owed_before_payment = fee_amount - total_paid_before
                        
                        # For email display: Original Amount should always be the FULL service fee amount
                        # This is the total amount billed, regardless of payments made
                        # IMPORTANT: For multi-month payments, use total_amount from payment_data
                        # For single payments, use amount from payment_data or payment_obj
                        current_payment_amount = 0
                        
                        # Check if this is a multi-month payment (has payment_details list or total_amount field)
                        payment_details = payment_data.get('payment_details') if payment_data else None
                        has_payment_details = payment_details and isinstance(payment_details, list) and len(payment_details) > 0
                        has_total_amount = payment_data and payment_data.get('total_amount') is not None
                        is_multi_month = has_payment_details or has_total_amount
                        
                        # For multi-month payments, use total_amount (the actual amount paid across all months)
                        if is_multi_month and payment_data.get('total_amount'):
                            try:
                                current_payment_amount = float(str(payment_data.get('total_amount')))
                                print(f"   📌 Multi-month payment detected, using total_amount: {current_payment_amount}")
                            except (ValueError, TypeError):
                                pass
                        
                        # For single payments or if total_amount not available, use amount from payment_data
                        if current_payment_amount == 0 and payment_data and payment_data.get('amount'):
                            try:
                                current_payment_amount = float(str(payment_data.get('amount')))
                            except (ValueError, TypeError):
                                pass
                        
                        # Final fallback to payment_obj.amount
                        if current_payment_amount == 0 and hasattr(payment_obj, 'amount') and payment_obj.amount:
                            try:
                                current_payment_amount = float(payment_obj.amount)
                            except (ValueError, TypeError):
                                current_payment_amount = 0
                        
                        # Debug: Check what we're reading
                        print(f"📊 Email calculation debug:")
                        print(f"   payment_obj.id: {payment_obj.id}")
                        print(f"   payment_obj.amount (raw): {payment_obj.amount}")
                        print(f"   payment_data.get('amount'): {payment_data.get('amount') if payment_data else 'N/A'}")
                        print(f"   payment_data.get('total_amount'): {payment_data.get('total_amount') if payment_data else 'N/A'}")
                        print(f"   is_multi_month: {is_multi_month}")
                        print(f"   Fee amount: {fee_amount}")
                        print(f"   Total paid before this payment: {total_paid_before}")
                        print(f"   Amount owed before this payment: {amount_owed_before_payment}")
                        print(f"   Current payment amount (used): {current_payment_amount}")
                        
                        # Original Amount should always be the FULL service fee amount, not reduced by payments
                        original_amount_for_email = fee_amount
                        print(f"   Original Amount for email: {original_amount_for_email}")
                    else:
                        # AdvancePayment processing
                        fee_amount = 0.0
                        service_fee_amount = 0.0
                        total_paid_before = 0.0
                        amount_owed_before_payment = 0.0
                        amt = float(payment_data.get('total_amount', payment_data.get('amount', getattr(payment_obj, 'amount', 0))))
                        current_payment_amount = amt
                        original_amount_for_email = amt
                        print(f"   Advance Payment detected. Amount: {original_amount_for_email}")

                except Exception as e:
                    print(f"❌ Error calculating amount_owed_before_payment: {e}")
                    import traceback
                    print(traceback.format_exc())
                    # Fallback: use remaining + current amount
                    try:
                        remaining_after = float(payment_obj.remaining_amount) if hasattr(payment_obj, 'remaining_amount') else 0
                        # Use payment_data amount first, fallback to payment_obj.amount
                        amount_paid = 0
                        if payment_data and payment_data.get('amount'):
                            try:
                                amount_paid = float(str(payment_data.get('amount')))
                            except (ValueError, TypeError):
                                pass
                        if amount_paid == 0 and hasattr(payment_obj, 'amount') and payment_obj.amount:
                            try:
                                amount_paid = float(payment_obj.amount)
                            except (ValueError, TypeError):
                                amount_paid = 0
                        
                        amount_owed_before_payment = remaining_after + amount_paid
                        # Calculate original_amount_for_email from fallback
                        original_amount_for_email = amount_owed_before_payment - amount_paid
                        # Try to get service_fee_amount from payment_obj
                        if hasattr(payment_obj, 'service_fee') and payment_obj.service_fee:
                            service_fee_amount = float(payment_obj.service_fee.fee_amount)
                    except Exception:
                        pass
                
                # Decide receipt status: only 'Paid' or 'Partial'
                # Prefer the payment's historical result; fallback to computed from service_status
                result_display = None
                try:
                    # Try to get payment_result_display from payment object
                    if hasattr(payment_obj, 'payment_result_display'):
                        result_display = payment_obj.payment_result_display
                    elif payment_data.get('payment_result_display'):
                        result_display = payment_data.get('payment_result_display')
                except Exception:
                    pass

                if not result_display:
                    # Compute fallback: if payment is completed, check service_status
                    result_display = payment_obj.service_status or payment_data.get('service_status', 'N/A')
                    # try:
                    #     if payment_obj.payment_status == 'completed':
                    #         service_status = payment_obj.service_status or payment_data.get('service_status', 'partial')
                    #         if service_status and str(service_status).lower() == 'paid':
                    #             result_display = 'Paid'
                    #         else:
                    #             result_display = 'Partial'
                    #     else:
                    #         result_display = 'Partial'
                    # except Exception:
                    #     result_display = 'Partial'

                # Use the calculated original_amount_for_email (amount_owed_before - current_payment)
                email_data.update({
                    'original_amount_before_payment': str(original_amount_for_email) if original_amount_for_email is not None else (str(amount_owed_before_payment) if amount_owed_before_payment is not None else None),
                    'service_fee_amount': str(service_fee_amount) if service_fee_amount is not None else None,
                    'total_paid_before': str(total_paid_before) if total_paid_before is not None else '0',
                    'resident_email': resident_email,
                    'tower_name': payment_obj.unit.floor.tower.tower_name if payment_obj.unit and payment_obj.unit.floor and payment_obj.unit.floor.tower else 'N/A',
                    'unit_display': payment_obj.unit.unit_name if payment_obj.unit else 'N/A',
                    'resident_name': resident_full_name,  # Keep this for backward compatibility
                    'primary_name': primary_name or 'N/A',      # Unit's primary contact name
                    'secondary_name': secondary_name or 'N/A',  # Unit's secondary contact name
                    'created_by_name': payment_obj.created_by.full_name if payment_obj.created_by else 'N/A',
                    'payment_method_display': payment_method_display,
                    'method_display': payment_method_display,  # Alias for compatibility
                    'reference_number': reference_number,
                    'notes': notes,
                    'transaction_id': transaction_id,  # Ensure transaction_id is set
                    # Force the receipt status to Paid/Partial only
                    'service_status': (result_display or 'Partial'),
                    'payment_result_display': result_display,  # Add this for email template
                    'previous_due': str(amount_owed_before_payment) if amount_owed_before_payment is not None else None,
                    'receipt_id': receipt_id,
                    'advance_amount': str(AdvancePayment.objects.filter(source_billing=latest_billing).aggregate(total=Sum('amount'))['total'] or 0) if latest_billing else '0'
                })
                
                print(f"\n📧 Sending payment receipt email:")
                print(f"   To: {resident_email}")
                print(f"   Transaction ID: {transaction_id}")
                print(f"   Amount: {payment_data.get('amount', 'N/A')}")
                print(f"   Status: {result_display}")
                print(f"   Operation: {operation_type}")
                print(f"   original_amount_before_payment: {email_data.get('original_amount_before_payment')}")
                print(f"   service_fee_amount: {email_data.get('service_fee_amount')}")
                print(f"   total_paid_before: {email_data.get('total_paid_before')}")
                
                # Use unified bulk trigger for better data parity and SQL-based fetching
                # This ensures the email matches the frontend receipt exactly
                if receipt_id:
                    print(f"   🚀 Triggering unified email receipt for: {receipt_id}")
                    trigger_bulk_payment_receipt_emails([receipt_id])
                    return True
                else:
                    # Fallback to legacy method if no receipt_id found (rare)
                    email_sent = send_payment_receipt_email(email_data, resident_email)
                    if email_sent:
                        print(f"   ✅ Email sent successfully")
                        return True
                    else:
                        print(f"   ❌ Email sending failed")
                        return False
            else:
                print(f"   ⚠️ No resident email found - skipping email")
                return False
        else:
            print(f"   ⚠️ Email sending disabled (send_email=False)")
            return False
    except Exception as e:
        # Don't fail the payment operation if email fails
        import traceback
        print(f"   ❌ Error in send_payment_email_if_enabled: {str(e)}")
        print(traceback.format_exc())
        return False

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payment_choices(request):
    """
    Get all choice fields for payments (no authentication required)
    """
    try:
        from .models import PaymentMethod
        from .serializers import PaymentMethodSerializer
        
        payment_status_choices = ServiceFeePayment.PAYMENT_STATUS_CHOICES
        service_status_choices = ServiceFeePayment.SERVICE_STATUS_CHOICES
        currency_choices = ServiceFee.CURRENCY_CHOICES
        
        # Get active payment methods from database
        payment_methods = PaymentMethod.objects.filter(is_active=True).order_by('display_order', 'method_name')
        payment_methods_data = PaymentMethodSerializer(payment_methods, many=True).data
        
        return Response({
            'success': True,
            'data': {
                'payment_status_choices': payment_status_choices,
                'payment_methods': payment_methods_data,  # Changed from payment_method_choices
                'service_status_choices': service_status_choices,
                'currency_choices': currency_choices
            }
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error retrieving choices: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_filter_options(request):
    """
    Get all dynamic filter options for the frontend dropdowns
    - Towers (from database)
    - Status options (from model choices)
    - Payment methods (from database)
    - Service fees (active service fees, optionally filtered by tower)
    
    Query params:
    - tower_ids: Comma-separated tower IDs to filter service fees
    """
    try:
        from .models import PaymentMethod
        
        # Get all towers from database
        import re
        def natural_sort_key(s):
            # Sort keys: (0, val) for int, (1, val) for str
            # This ensures numbers come before strings (1 before A)
            # and numeric parts are compared numerically (2 before 10)
            parts = [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', str(s).strip()) if t]
            return [(0, p) if isinstance(p, int) else (1, p) for p in parts]

        towers = list(Tower.objects.all().values('id', 'tower_name'))
        towers.sort(key=lambda x: natural_sort_key(x['tower_name']))
        
        tower_options = [{'value': tower['id'], 'label': tower['tower_name']} for tower in towers]
        
        # Get status choices from ServiceFeePayment model
        status_choices = ServiceFeePayment.SERVICE_STATUS_CHOICES
        status_options = [{'value': choice[0], 'label': choice[1]} for choice in status_choices]
        
        # Get active payment methods from database
        payment_methods = PaymentMethod.objects.filter(is_active=True).order_by('display_order', 'method_name')
        payment_method_options = []
        for method in payment_methods:
            option = {
                'value': method.id,
                'label': method.method_name,
                'type': method.method_type,
                'account_name': method.account_name,
                'account_number': method.account_number
            }
            payment_method_options.append(option)
        
        # Get active service fees from database
        # Filter by tower if tower_ids parameter is provided
        # tower_ids_param = request.GET.get('tower_ids', '')
        
        # # If tower_ids_param is provided, filter service fees using JOIN
        # if tower_ids_param:
        #     # Parse comma-separated tower IDs
        #     tower_ids = [int(tid.strip()) for tid in tower_ids_param.split(',') if tid.strip().isdigit()]
            
        #     if tower_ids:
        #         # Use raw SQL with JOIN to get service fees for selected towers
        #         with connection.cursor() as cursor:
        #             placeholders = ','.join(['%s'] * len(tower_ids))
        #             query = f"""
        #                 SELECT DISTINCT sf.id, sf.fee_amount, sf.currency, sf.frequency
        #                 FROM service_fee_servicefee sf
        #                 INNER JOIN service_fee_servicefee_towers sft ON sf.id = sft.servicefee_id
        #                 WHERE sf.is_active = 1
        #                 AND sft.tower_id IN ({placeholders})
        #                 ORDER BY sf.fee_amount
        #             """
        #             cursor.execute(query, tower_ids)
                    
        #             service_fee_options = [
        #                 {
        #                     'value': row[0],
        #                     'label': f"{row[1]} {row[2]} - {row[3]}",
        #                     'amount': str(row[1])
        #                 } for row in cursor.fetchall()
        #             ]
        #     else:
        #         # If no valid tower IDs, return empty service fees
        #         service_fee_options = []
        # else:
        #     # If no tower filter, return all service fees
        #     service_fees = ServiceFee.objects.filter(is_active=True).order_by('fee_amount')
        #     service_fee_options = [
        #         {
        #             'value': fee.id, 
        #             'label': f"{fee.fee_amount} {fee.currency} - {fee.frequency}",
        #             'amount': str(fee.fee_amount)
        #         } for fee in service_fees
        #     ]
        
        # Always return all filter options (towers, status, methods) + filtered service fees
        return Response({
            'success': True,
            'data': {
                'towers': tower_options,
                'status_options': status_options,
                'payment_methods': payment_method_options,
                # 'service_fees': service_fee_options
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error retrieving filter options: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def service_fee_unit_counts(request):
    """
    Return aggregated counts of units per service_fee and tower.
    Optional query params:
      - tower_ids: comma-separated tower ids to filter
      - service_fee_ids: comma-separated service_fee ids to filter
      - status (optional): Filter service fees - 'active' (default) or 'all'
        * 'active': Only show active service fees
        * 'all': Show all service fees (active and inactive)
    """
    try:
        tower_ids_param = request.GET.get('tower_ids', '').strip()
        service_fee_ids_param = request.GET.get('service_fee_ids', '').strip()
        status_filter = request.GET.get('status', 'active').strip().lower()
        
        # Get month and year parameters for filtering by service period
        month = request.GET.get('month', '').strip()
        year = request.GET.get('year', '').strip()
        
        month_int = None
        year_int = None
        
        where_clauses = []
        params = []
        payment_filter_clauses = []
        payment_params = []

        # Default: only show active service fees
        if status_filter == 'active':
            where_clauses.append("sf.is_active=1")
        # 'all' shows both active and inactive

        if tower_ids_param:
            tower_ids = [int(x) for x in tower_ids_param.split(',') if x.strip().isdigit()]
            if tower_ids:
                placeholders = ','.join(['%s'] * len(tower_ids))
                # Use subquery to filter service fees by tower assignment at the top level
                where_clauses.append(f"sf.id IN (SELECT servicefee_id FROM service_fee_servicefee_towers WHERE tower_id IN ({placeholders}))")
                params.extend(tower_ids)

        if service_fee_ids_param:
            sf_ids = [int(x) for x in service_fee_ids_param.split(',') if x.strip().isdigit()]
            if sf_ids:
                placeholders = ','.join(['%s'] * len(sf_ids))
                where_clauses.append(f"sf.id IN ({placeholders})")
                params.extend(sf_ids)

        # Build payment filter for month/year if provided
        if month and year:
            try:
                month_int = int(month)
                year_int = int(year)
                # if 1 <= month_int <= 12 and 2020 <= year_int <= 2100:
                payment_filter_clauses.append("sfp.service_period_month = %s")
                payment_filter_clauses.append("sfp.service_period_year = %s")
                payment_params.extend([month_int, year_int])
            except ValueError:
                pass
        
        where_sql = ''
        if where_clauses:
            where_sql = ' WHERE ' + ' AND '.join(where_clauses)
        
        # Build payment filter SQL
        payment_filter_sql = ''
        if payment_filter_clauses:
            payment_filter_sql = ' AND ' + ' AND '.join(payment_filter_clauses)
        
        # Build category join SQL and params as requested by user
        category_join_sql = ''
        category_params = []
        if month_int and year_int:
             category_join_sql = """
                LEFT JOIN (
                    SELECT 
                        bud.unit_id, 
                        bud.service_fee_id,
                        JSON_ARRAYAGG(JSON_OBJECT(
                            'id', bc.id, 
                            'name', bc.name, 
                            'amount', bud.amount
                        )) as cats
                    FROM bill_upload_details bud
                    JOIN bill_uploads bu ON bu.id = bud.bill_upload_id
                    JOIN bill_category bc ON bc.id = bu.bill_category_id
                    WHERE bud.upload_month = %s AND bud.upload_year = %s
                    GROUP BY bud.unit_id, bud.service_fee_id
                ) unit_cats ON unit_cats.unit_id = u.id AND unit_cats.service_fee_id = sfu.servicefee_id
             """
             category_params = [month_int, year_int]

        # Optimized query: Show ALL active service fees with their available units
        # Filter units to exclude those already generated for the specified month/year
        sql = f"""
            SELECT 
                   sf.id as service_fee_id,
                   sf.fee_amount,
                   sf.is_active,
                   COALESCE(u_agg.total_unit_count, 0) as total_unit_count,
                   t_agg.towers,
                   u_agg.units
            FROM service_fee_servicefee sf
            LEFT JOIN (
                SELECT 
                    servicefee_id,
                    JSON_ARRAYAGG(JSON_OBJECT('id', id, 'name', tower_name)) AS towers
                FROM (
                    SELECT DISTINCT sft.servicefee_id, t.id, t.tower_name
                    FROM service_fee_servicefee_towers sft
                    LEFT JOIN towers_tower t ON t.id = sft.tower_id
                    WHERE t.id IS NOT NULL
                ) t_distinct
                GROUP BY servicefee_id
            ) t_agg ON sf.id = t_agg.servicefee_id
            LEFT JOIN (
                SELECT 
                    sfu.servicefee_id,
                    COUNT(DISTINCT u.id) AS total_unit_count,
                    JSON_ARRAYAGG(JSON_OBJECT(
                        'id', u.id, 
                        'name', u.unit_name,
                        'bill_categories', COALESCE(unit_cats.cats, JSON_ARRAY())
                    )) AS units
                FROM service_fee_servicefee_units sfu
                LEFT JOIN towers_unit u ON u.id = sfu.unit_id
                LEFT JOIN service_fee_management_servicefeegenerate sfp ON sfu.servicefee_id = sfp.service_fee_id AND u.id = sfp.unit_id {payment_filter_sql}
                {category_join_sql}
                WHERE u.id IS NOT NULL
                AND u.unit_status<>'no_owner'
                AND sfu.is_active=1
                AND sfp.id IS NULL
                GROUP BY sfu.servicefee_id
            ) u_agg ON sf.id = u_agg.servicefee_id
            {where_sql}
            ORDER BY sf.id
        """
        # Combine all parameters in physical order: payment_params, category_params, then where_sql params
        all_params = payment_params + category_params + params

        with connection.cursor() as cursor:
            cursor.execute(sql, all_params)
            cols = [c[0] for c in cursor.description]
            rows = cursor.fetchall()



        # Parse JSON arrays directly
        import json
        import re
        def natural_sort_key_sf(s):
            return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', str(s))]

        results = []
        for row in rows:
            row_dict = dict(zip(cols, row))
            
            # Parse JSON arrays
            try:
                towers = json.loads(row_dict['towers']) if row_dict['towers'] else []
                if isinstance(towers, list) and len(towers) > 0 and isinstance(towers[0], dict) and 'name' in towers[0]:
                    towers.sort(key=lambda x: natural_sort_key_sf(x['name']))
            except (json.JSONDecodeError, TypeError):
                towers = []
            
            try:
                units = json.loads(row_dict['units']) if row_dict['units'] else []
            except (json.JSONDecodeError, TypeError):
                units = []
            
            result = {
                'service_fee_id': row_dict['service_fee_id'],
                'fee_amount': row_dict['fee_amount'],
                'is_active': row_dict['is_active'],
                'total_unit_count': row_dict['total_unit_count'],
                'towers': towers,
                'units': units
            }
            results.append(result)
        
        return Response({
            'success': True,
            'data': results,
            'filters_applied': {
                'status': status_filter
            }
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def service_fee_payment_by_period(request):
    """
    Return service fee payment data grouped by service_fee_id and filtered by month/year.
    This shows the payment status and totals for each service fee in a specific period.
    
    Query params:
      - month: Month number (1-12) - required
      - year: Year (YYYY) - required
      - service_fee_id: Optional - filter by specific service fee
      - tower_ids: Optional - comma-separated tower ids to filter
    """
    try:
        month = int(request.GET.get('month', 0))
        year = int(request.GET.get('year', 0))
        service_fee_id_param = request.GET.get('service_fee_id', '').strip()
        tower_ids_param = request.GET.get('tower_ids', '').strip()

        # Validate month and year
        if month < 1 or month > 12 or year < 2020 or year > 2100:
            return Response({
                'success': False,
                'message': 'Invalid month (1-12) or year'
            }, status=status.HTTP_400_BAD_REQUEST)

        where_clauses = [f"sfp.service_period_month = {month}", f"sfp.service_period_year = {year}"]
        params = []

        # Filter by specific service fee if provided
        if service_fee_id_param and service_fee_id_param.isdigit():
            where_clauses.append("sf.id = %s")
            params.append(int(service_fee_id_param))

        # Filter by tower if provided
        if tower_ids_param:
            tower_ids = [int(x) for x in tower_ids_param.split(',') if x.strip().isdigit()]
            if tower_ids:
                placeholders = ','.join(['%s'] * len(tower_ids))
                where_clauses.append(f"t.id IN ({placeholders})")
                params.extend(tower_ids)

        where_sql = ' WHERE ' + ' AND '.join(where_clauses)

        sql = f"""
            SELECT 
                   sf.id as service_fee_id,
                   sf.fee_amount,
                   sf.is_active,
                   COUNT(DISTINCT sfp.id) as total_bills,
                   SUM(CASE WHEN sfp.service_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                   SUM(CASE WHEN sfp.service_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                   SUM(CASE WHEN sfp.service_status = 'due' THEN 1 ELSE 0 END) as due_count,
                   COALESCE(SUM(sfp.amount), 0) as total_amount,
                   COALESCE(SUM(CASE WHEN sfp.payment_status = 'completed' THEN sfp.amount ELSE 0 END), 0) as total_paid,
                   COALESCE(SUM(sfp.remaining_amount), 0) as total_remaining,
                   JSON_ARRAYAGG(DISTINCT JSON_OBJECT('id', t.id, 'name', t.tower_name)) as towers,
                   JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.unit_name, 'status', sfp.service_status, 'amount', sfp.amount, 'bill_number', sfp.bill_number)) as unit_details
            FROM service_fee_management_servicefeegenerate sfp
            INNER JOIN service_fee_servicefee sf ON sf.id = sfp.service_fee_id
            LEFT JOIN towers_unit u ON u.id = sfp.unit_id
            LEFT JOIN towers_floor f ON u.floor_id = f.id
            LEFT JOIN towers_tower t ON t.id = f.tower_id
            {where_sql}
            GROUP BY sf.id, sf.fee_amount, sf.is_active
            ORDER BY sf.id
        """

        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            cols = [c[0] for c in cursor.description]
            rows = cursor.fetchall()

        results = []
        for row in rows:
            row_dict = dict(zip(cols, row))
            
            # Parse JSON arrays
            try:
                towers = json.loads(row_dict['towers']) if row_dict['towers'] else []
            except (json.JSONDecodeError, TypeError):
                towers = []
            
            try:
                unit_details = json.loads(row_dict['unit_details']) if row_dict['unit_details'] else []
            except (json.JSONDecodeError, TypeError):
                unit_details = []
            
            result = {
                'service_fee_id': row_dict['service_fee_id'],
                'fee_amount': float(row_dict['fee_amount']),
                'is_active': row_dict['is_active'],
                'total_bills': row_dict['total_bills'],
                'paid_count': row_dict['paid_count'] or 0,
                'partial_count': row_dict['partial_count'] or 0,
                'due_count': row_dict['due_count'] or 0,
                'total_amount': float(row_dict['total_amount']),
                'total_paid': float(row_dict['total_paid']),
                'total_remaining': float(row_dict['total_remaining']),
                'towers': towers,
                'unit_details': unit_details
            }
            results.append(result)
        
        return Response({
            'success': True,
            'data': results,
            'period': {
                'month': month,
                'year': year
            }
        }, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({'success': False, 'message': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class ServiceFeePaymentListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_OVERVIEW]
    parser_classes = [JSONParser]

    def get(self, request):
        try:
            logger.info(f"📋 [PAYMENT HISTORY API] Request params: {dict(request.query_params)}")
            logger.info(f"📋 [PAYMENT HISTORY API] User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")
            
            # Note: ServiceFeePayment doesn't have 'billing' or 'payment_method_rel' fields
            # - 'billing' is accessed via reverse relationship 'billing_records'
            # - 'payment_method' is on ServiceFeeBilling, not ServiceFeePayment
            queryset = ServiceFeePayment.objects.select_related(
                'resident', 'unit', 'unit__floor__tower', 'service_fee', 'created_by'
            ).prefetch_related('billing_records', 'billing_records__payment_method')

            # Helper function to parse comma-separated values or lists
            def parse_filter_values(value):
                if not value:
                    return []
                # If it's already a list (from getlist()), return it
                if isinstance(value, list):
                    return [str(v).strip() for v in value if str(v).strip()]
                # If it's a string, split by comma
                if isinstance(value, str):
                    return [v.strip() for v in value.split(',') if v.strip()]
                return [str(value)]  # Single value, convert to list

            # Filter by payment status (multiple values)
            status_filter = request.query_params.getlist('status')
            if status_filter:
                status_values = parse_filter_values(status_filter)
                if status_values:
                    queryset = queryset.filter(payment_status__in=status_values)

            # Filter by payment method (multiple values)
            # Note: payment_method is on ServiceFeeBilling, not ServiceFeePayment
            method_filter = request.query_params.getlist('method')
            if method_filter:
                method_values = parse_filter_values(method_filter)
                if method_values:
                    queryset = queryset.filter(billing_records__payment_method_id__in=method_values).distinct()

            # Filter by resident
            resident_id = request.query_params.get('resident_id', None)
            if resident_id:
                queryset = queryset.filter(resident_id=resident_id)

            # Filter by unit
            unit_id = request.query_params.get('unit', None)
            if unit_id:
                queryset = queryset.filter(unit_id=unit_id)

            # Filter by unit list (multiple values)
            unit_ids_param = request.query_params.getlist('unit_id_list')
            if unit_ids_param:
                unit_values = parse_filter_values(unit_ids_param)
                if unit_values:
                    queryset = queryset.filter(unit_id__in=unit_values)

            # Filter by tower (multiple values)
            tower_id = request.query_params.getlist('tower_id')
            if tower_id:
                tower_values = parse_filter_values(tower_id)
                if tower_values:
                    queryset = queryset.filter(unit__floor__tower_id__in=tower_values)

            # Filter by payment date range (when the payment was actually made)
            # Use billing_records__payment_date instead of service_period
            # Accept start_date/end_date (mobile) as aliases for payment_date_start/payment_date_end
            payment_date_start = (
                request.query_params.get('payment_date_start') or
                request.query_params.get('start_date')
            )
            payment_date_end = (
                request.query_params.get('payment_date_end') or
                request.query_params.get('end_date')
            )

            if payment_date_start and payment_date_end:
                try:
                    start_date_obj = datetime.strptime(payment_date_start, '%Y-%m-%d').date()
                    end_date_obj = datetime.strptime(payment_date_end, '%Y-%m-%d').date()
                    
                    queryset = queryset.filter(
                        billing_records__payment_date__gte=start_date_obj,
                        billing_records__payment_date__lte=end_date_obj
                    ).distinct()
                    
                except ValueError as e:
                    pass  # Invalid date format, ignore filter
            elif payment_date_start:
                try:
                    start_date_obj = datetime.strptime(payment_date_start, '%Y-%m-%d').date()
                    
                    queryset = queryset.filter(
                        billing_records__payment_date__gte=start_date_obj
                    ).distinct()
                except ValueError as e:
                    pass  # Invalid date format, ignore filter
            
            if payment_date_end and not payment_date_start:
                try:
                    end_date_obj = datetime.strptime(payment_date_end, '%Y-%m-%d').date()
                    
                    queryset = queryset.filter(
                        billing_records__payment_date__lte=end_date_obj
                    ).distinct()
                except ValueError as e:
                    pass  # Invalid date format, ignore filter

            # Search functionality
            search = request.query_params.get('search', None)
            if search:
                queryset = queryset.filter(
                    Q(bill_number__icontains=search) |
                    Q(billing_records__transaction_id__icontains=search) |
                    Q(billing_records__receipt_id__icontains=search) |
                    Q(resident__full_name__icontains=search) |
                    Q(owner_name__icontains=search) |
                    Q(unit__unit_name__icontains=search) |
                    Q(billing_records__reference_number__icontains=search)
                ).distinct()

            # Amount filtering
            min_amount = request.query_params.get('min_amount')
            max_amount = request.query_params.get('max_amount')
            if min_amount:
                queryset = queryset.filter(billing_records__total_paid__gte=min_amount).distinct()
            if max_amount:
                queryset = queryset.filter(billing_records__total_paid__lte=max_amount).distinct()

            # Advance filter
            advance_filter = request.query_params.get('advance_filter')
            if advance_filter == 'with_advance':
                queryset = queryset.filter(billing_records__payment_type='advance_payment').distinct()
            elif advance_filter == 'without_advance':
                queryset = queryset.exclude(billing_records__payment_type='advance_payment').distinct()

            # Ordering
            ordering = request.query_params.get('ordering', '-created_at')
            queryset = queryset.order_by(ordering)

            # Pagination
            page_size = int(request.query_params.get('page_size', 20))
            page = int(request.query_params.get('page', 1))
            offset = (page - 1) * page_size
            total_count = queryset.count()
            payments = queryset[offset:offset + page_size]

            # Expand each payment's billing records into separate items
            # This allows showing multiple transactions for the same service period
            expanded_payments = []
            for payment in payments:
                # Get billing records ordered by date (ascending) for cumulative calculation
                billing_records_asc = payment.billing_records.all().order_by('payment_date', 'id')
                
                if billing_records_asc.exists():
                    # Get service fee amount for this payment period
                    service_fee_amount = float(payment.service_fee.fee_amount) if payment.service_fee else 0
                    
                    # First pass: Calculate cumulative payments for each billing record
                    # Store cumulative status in a dictionary keyed by billing ID
                    cumulative_status_map = {}
                    cumulative_paid = 0
                    
                    for billing in billing_records_asc:
                        transaction_amount = float(billing.total_paid) if billing.total_paid else 0
                        cumulative_paid += transaction_amount
                        
                        # Calculate cumulative payment status
                        # If cumulative paid >= service fee amount, status is "Paid", otherwise "Partial"
                        if cumulative_paid >= service_fee_amount:
                            cumulative_status_map[billing.id] = {
                                'status': 'Paid',
                                'cumulative_paid': cumulative_paid,
                                'is_fully_paid': True
                            }
                        else:
                            cumulative_status_map[billing.id] = {
                                'status': 'Partial',
                                'cumulative_paid': cumulative_paid,
                                'is_fully_paid': False
                            }
                    
                    # Second pass: Create payment entries ordered by date descending (newest first) for display
                    billing_records_desc = payment.billing_records.all().order_by('-payment_date', '-id')
                    
                    for billing in billing_records_desc:
                        # Serialize the base payment data
                        payment_data = ServiceFeePaymentListSerializer(payment).data
                        
                        # Override with billing-specific data
                        payment_data['billing_record_id'] = billing.id
                        payment_data['receipt_id'] = billing.receipt_id
                        payment_data['transaction_id'] = billing.transaction_id
                        payment_data['billing_id'] = billing.billing_id
                        payment_data['reference_number'] = billing.reference_number
                        payment_data['notes'] = billing.notes
                        payment_data['payment_date'] = billing.payment_date.isoformat() if billing.payment_date else None
                        # Use payment_method FK first; fallback to other_method_name (e.g. PayStation bKash/Nagad, Cash)
                        method_name = None
                        if billing.payment_method:
                            method_name = billing.payment_method.method_name
                        elif billing.other_method_name:
                            method_name = billing.other_method_name
                        # Fallback: FK set but relation not loaded (e.g. after order_by on prefetch)
                        if not method_name and getattr(billing, 'payment_method_id', None):
                            method_name = PaymentMethod.objects.filter(id=billing.payment_method_id).values_list('method_name', flat=True).first()
                        payment_data['payment_method_display'] = method_name
                        payment_data['method_display'] = method_name
                        
                        # Set the actual amount paid in this specific transaction
                        transaction_amount = float(billing.total_paid) if billing.total_paid else 0
                        payment_data['amount'] = str(transaction_amount)
                        # Bill amount (original_amount) = base + utility (additional). Never use paid amount.
                        base_val = float(payment.base_service_amount or 0) if getattr(payment, 'base_service_amount', None) is not None else 0
                        additional_val = float(payment.additional_bill_charges or 0) if getattr(payment, 'additional_bill_charges', None) is not None else 0
                        base_plus_additional = base_val + additional_val
                        if base_plus_additional > 0:
                            payment_data['original_amount'] = str(base_plus_additional)
                        else:
                            # Generator stores payment.amount = total including penalty; subtract penalty to get bill (base+utility) only
                            amt = float(payment.amount) if payment.amount else service_fee_amount
                            gross = float(getattr(payment, 'gross_penalty_amount', 0) or 0)
                            bill_only = max(0, amt - gross) if gross else amt
                            payment_data['original_amount'] = str(bill_only) if bill_only else str(service_fee_amount)
                        payment_data['gross_penalty_amount'] = str(payment.gross_penalty_amount) if getattr(payment, 'gross_penalty_amount', None) is not None else str(getattr(payment, 'penalty_amount', 0) or 0)
                        payment_data['penalty_amount'] = str(payment.penalty_amount) if getattr(payment, 'penalty_amount', None) is not None else payment_data.get('penalty_amount', '0')
                        payment_data['waived_amount'] = str(payment.waived_amount) if getattr(payment, 'waived_amount', None) is not None else payment_data.get('waived_amount', '0')
                        
                        # Get cumulative status for this billing record (for overall bill status)
                        cumulative_info = cumulative_status_map.get(billing.id, {
                            'status': 'Partial',
                            'cumulative_paid': transaction_amount,
                            'is_fully_paid': False
                        })
                        
                        # CRITICAL: Use individual transaction's payment_result_status for display
                        # This shows whether THIS specific payment was full or partial, NOT the cumulative status
                        if billing.payment_result_status:
                            # Use the stored payment result status (from PayStation/manual payment)
                            if billing.payment_result_status == 'full':
                                transaction_status = 'Paid'
                            elif billing.payment_result_status == 'partial':
                                transaction_status = 'Partial'
                            elif billing.payment_result_status == 'overpayment':
                                transaction_status = 'Overpayment'
                            else:
                                transaction_status = 'Partial'
                        else:
                            # Fallback: Calculate based on transaction amount vs billing amount
                            if transaction_amount >= service_fee_amount:
                                transaction_status = 'Paid'
                            else:
                                transaction_status = 'Partial'
                        
                        # Set status fields - use individual transaction status, NOT cumulative
                        payment_data['service_status_display'] = cumulative_info['status']  # Overall bill status (cumulative)
                        payment_data['payment_result_display'] = transaction_status  # THIS transaction's status (individual)
                        payment_data['is_fully_paid'] = cumulative_info['is_fully_paid']  # Overall bill fully paid
                        payment_data['is_partial_payment'] = transaction_status == 'Partial'  # THIS transaction was partial
                        
                        # Calculate remaining amount after cumulative payments up to this transaction
                        remaining_amount = service_fee_amount - cumulative_info['cumulative_paid']
                        payment_data['remaining_amount'] = str(max(0, remaining_amount))  # Don't show negative
                        
                        expanded_payments.append(payment_data)
                else:
                    # No billing records (unpaid), include as-is
                    expanded_payments.append(ServiceFeePaymentListSerializer(payment).data)

            # Include pure advance payments (no bill) and excess amount credits when filtering by unit
            unit_id_for_advance = request.query_params.get('unit', None)
            if unit_id_for_advance:
                logger.info(f"🔍 [ADVANCE PAYMENT QUERY] unit_id={unit_id_for_advance}")
                
                # Query for advance payments (including both pure advance and overpayment converted to advance)
                # All advance payments should be linked to an AdvancePayment record which has the unit_id
                advance_billings_qs = ServiceFeeBilling.objects.filter(
                    payment_type='advance_payment',  # Consistent: use 'advance_payment' for all advance payments
                    advance_payment__isnull=False,  # Must be linked to an AdvancePayment record
                    advance_payment__unit_id=unit_id_for_advance,  # Filter by unit
                    servicefeepaymentid__isnull=True,  # Not linked to a service fee payment
                ).select_related('advance_payment', 'payment_method').order_by('-payment_date', '-id')
                
                logger.info(f"🔍 [ADVANCE PAYMENT QUERY] Found {advance_billings_qs.count()} advance payment records")
                for billing in advance_billings_qs:
                    logger.info(f"   - Billing ID={billing.id}, Amount={billing.total_paid}, Advance ID={billing.advance_payment_id}, Unit ID={billing.advance_payment.unit_id if billing.advance_payment else 'N/A'}")
                
                # Apply same date filter as bill payments
                if payment_date_start:
                    try:
                        start_date_obj = datetime.strptime(payment_date_start, '%Y-%m-%d').date()
                        advance_billings_qs = advance_billings_qs.filter(
                            payment_date__date__gte=start_date_obj
                        )
                    except ValueError:
                        pass
                if payment_date_end:
                    try:
                        end_date_obj = datetime.strptime(payment_date_end, '%Y-%m-%d').date()
                        advance_billings_qs = advance_billings_qs.filter(
                            payment_date__date__lte=end_date_obj
                        )
                    except ValueError:
                        pass
                for billing in advance_billings_qs:
                    payment_date_iso = billing.payment_date.isoformat() if billing.payment_date else None
                    method_name = None
                    if billing.payment_method:
                        method_name = billing.payment_method.method_name
                    elif billing.other_method_name:
                        method_name = billing.other_method_name
                    if not method_name and getattr(billing, 'payment_method_id', None):
                        method_name = PaymentMethod.objects.filter(id=billing.payment_method_id).values_list('method_name', flat=True).first()
                    if not method_name:
                        method_name = 'PayStation'  # default for advance from gateway
                    amount_val = float(billing.total_paid) if billing.total_paid else 0
                    expanded_payments.append({
                        'id': billing.id,
                        'billing_record_id': billing.id,
                        'receipt_id': billing.receipt_id,
                        'transaction_id': billing.transaction_id,
                        'billing_id': billing.billing_id,
                        'reference_number': billing.reference_number,
                        'notes': billing.notes,
                        'payment_date': payment_date_iso,
                        'payment_method_display': method_name,
                        'method_display': method_name,
                        'amount': str(amount_val),
                        'advance_amount': str(amount_val),
                        'original_amount': '0',
                        'remaining_amount': '0',
                        'service_status_display': 'Paid',
                        'payment_result_display': 'Paid',
                        'is_fully_paid': True,
                        'is_partial_payment': False,
                        'service_period_display': 'Advance Payment',
                        'payment_type': 'advance_payment',
                        'unit_id': billing.advance_payment.unit_id if billing.advance_payment else int(unit_id_for_advance),
                        'unit': int(unit_id_for_advance),
                        'payment_status': 'completed',
                        'due_date': None,
                        'service_fee_amount': '0',
                    })

            # Skip consolidation and return individual records
            # The mobile app groups by transaction_id on the client side, so returning
            # individual records allows it to show the full breakdown (bills + advance).
            final_payments = expanded_payments
            
            # Convert any numeric amounts to strings for consistency
            for p in final_payments:
                if 'amount' in p: p['amount'] = str(p['amount'])
                if 'original_amount' in p: p['original_amount'] = str(p['original_amount'])
                if 'service_fee_amount' in p: p['service_fee_amount'] = str(p['service_fee_amount'])
                if 'advance_amount' in p: p['advance_amount'] = str(p['advance_amount'])
                if 'bill_amount' in p: p['bill_amount'] = str(p['bill_amount'])
            
            # Sort combined list by payment_date descending (newest first)
            def _payment_sort_key(p):
                pd = p.get('payment_date') or ''
                return (pd or '0000-00-00')[:19]
            final_payments.sort(key=_payment_sort_key, reverse=True)

            logger.info(f"📋 [PAYMENT HISTORY API] Total payments returned: {len(final_payments)} (consolidated from {len(expanded_payments)} records)")
            if unit_id_for_advance:
                advance_count = len([p for p in final_payments if Decimal(str(p.get('advance_amount', '0'))) > 0])
                logger.info(f"📋 [PAYMENT HISTORY API] Payments with advance included: {advance_count}")

            return Response({
                'success': True,
                'data': {
                    'payments': final_payments,
                    'pagination': {
                        'total_count': len(final_payments),
                        'page': page,
                        'page_size': page_size,
                        'total_pages': (len(final_payments) + page_size - 1) // page_size
                    }
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving payments: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        Create a new service fee payment
        """
        # Record-payment permission required for creating payments
        self.required_permission_id = [PERMISSION_RECORD_PAYMENT]
        from django.db import transaction
        try:
            with transaction.atomic():
                serializer = ServiceFeePaymentSerializer(data=request.data, context={'request': request})
                
                if serializer.is_valid():
                    payment = serializer.save()
                    
                    # Refresh payment to ensure all related data is loaded
                    try:
                        payment.refresh_from_db()
                    except Exception:
                        pass
                    
                    # Get payment data for email (after refresh to ensure latest data)
                    payment_serializer_data = ServiceFeePaymentSerializer(payment).data
                    
                    # Check if email should be sent (from frontend request)
                    send_email = request.data.get('sendEmail', True)  # Default to True if not specified
                    
                    # Create audit trail for payment creation
                    try:
                        member = None
                        # Use created_by_id from the payment data instead of request.user
                        if hasattr(payment, 'created_by_id') and payment.created_by_id:
                            try:
                                member = Member.objects.get(id=payment.created_by_id)
                            except Member.DoesNotExist:
                                member = None
                        
                        create_audit_trail(
                            member=member,
                            event_type='PAYMENT_CREATED',
                            table_name='service_fee_management_servicefeegenerate',
                            row_id=payment.id,
                            new_data=ServiceFeePaymentSerializer(payment).data,
                            description=f'Payment created for resident {payment.resident.full_name}, amount: {payment.amount}'
                        )
                    except Exception as e:
                        pass

                    # Schedule async email sending after successful transaction commit
                    def trigger_async_email(p_obj, p_data, s_email):
                        try:
                            threading.Thread(
                                target=send_payment_email_if_enabled,
                                kwargs={
                                    'payment_obj': p_obj,
                                    'payment_data': p_data,
                                    'send_email': s_email,
                                    'operation_type': "new payment"
                                },
                                daemon=True
                            ).start()
                        except Exception as e:
                            print(f"Error triggering async email: {str(e)}")

                    if send_email:
                        # Find receipt_id from billing records created in this transaction
                        # We use on_commit to ensure data is available in the background thread's SQL query
                        try:
                            latest_billing = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment).order_by('-created_at').first()
                            if latest_billing and latest_billing.receipt_id:
                                receipt_id = latest_billing.receipt_id
                                print(f"   🚀 Email receipt scheduled for commit: {receipt_id}")
                                transaction.on_commit(lambda rid=receipt_id: trigger_bulk_payment_receipt_emails([rid]))
                            else:
                                # Fallback to legacy async trigger if no billing record found
                                transaction.on_commit(lambda: trigger_async_email(payment, payment_serializer_data, send_email))
                        except Exception as e:
                            print(f"Error scheduling email: {str(e)}")
                            # Fallback
                            transaction.on_commit(lambda: trigger_async_email(payment, payment_serializer_data, send_email))
                    
                    # ---------------- Voucher Generation ----------------
                    try:
                        from .utils.voucher_generator import create_payment_voucher, create_waiver_adjustment_voucher
                        
                        # Search for the recently created billing record for this payment
                        billing = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment).order_by('-created_at').first()
                        
                        if billing:
                            # Ensure billing totals are up-to-date
                            billing.update_payment_totals()
                            
                            # Extract payment details for the voucher
                            p_method = request.data.get('payment_method')
                            notes = request.data.get('notes', '')
                            payment_date_input = request.data.get('payment_date')
                            v_entry_date = None
                            if payment_date_input:
                                try:
                                    v_entry_date = datetime.strptime(payment_date_input[:10], '%Y-%m-%d').date()
                                except Exception:
                                    v_entry_date = None
                            
                            # 1. Create Receipt Voucher (CASH ONLY)

                            # Use billing.total_paid instead of payment.amount to ensure debit/credit match
                            voucher_result = create_payment_voucher(
                                billing_records=[billing],
                                total_amount=float(billing.total_paid),  # Use actual cash in billing record
                                payment_method_id=p_method,
                                member=member,
                                unit=payment.unit,
                                batch_receipt_id=billing.receipt_id,
                                notes=notes,
                                entry_date=v_entry_date
                            )
                            
                            if voucher_result.get('success'):
                                print(f"   ✅ Payment voucher created: {voucher_result.get('voucher_number')}")
                                
                                # Update billing record with the voucher link
                                new_voucher_id = voucher_result.get('voucher_id')
                                if new_voucher_id:
                                    billing.voucher_id = new_voucher_id
                                    billing.save()
                                    
                                # 2. Create Adjustment Voucher for Non-Cash (Waivers/Advance)
                                waiver_result = create_waiver_adjustment_voucher(
                                    billing_records=[billing],
                                    member=member,
                                    unit=payment.unit,
                                    batch_receipt_id=billing.receipt_id,
                                    entry_date=v_entry_date
                                )
                                
                                if not waiver_result.get('success'):
                                    raise ValidationError(f"Accounting Integration Failed (Adjustment): {waiver_result.get('message')}")
                                    
                                if waiver_result.get('voucher_number'):
                                    print(f"   ✅ Adjustment voucher created: {waiver_result.get('voucher_number')}")
                            else:
                                # CRITICAL: Raise exception to trigger rollback
                                raise ValidationError(f"Accounting Integration Failed: {voucher_result.get('message')}")
                    except Exception as ve:
                        # Propagate accounting errors to trigger transaction rollback
                        if isinstance(ve, ValidationError):
                            raise
                        print(f"   ❌ Voucher error: {str(ve)}")
                        raise ValidationError(f"Accounting Integration Error: {str(ve)}")
                    # ----------------------------------------------------
                    
                    # Create payment received notification for admins with record payment permission
                    try:
                        from notifications.utils import (
                            create_service_fee_payment_received_notification,
                            create_community_member_payment_confirmation
                        )
                        
                        # Get payment method name
                        payment_method_obj = None
                        p_method = request.data.get('payment_method')
                        if p_method:
                            try:
                                payment_method_obj = PaymentMethod.objects.get(id=p_method)
                            except PaymentMethod.DoesNotExist:
                                pass
                        
                        payment_method_name = payment_method_obj.method_name if payment_method_obj else None
                        
                        # Get the actual amount paid
                        payment_amount = billing.total_paid if billing else payment.amount
                        
                        # Create admin notification
                        print(f"[ServiceFeePayment] Creating payment notification for payment ID {payment.id}...")
                        create_service_fee_payment_received_notification(
                            payment=payment,
                            payment_amount=payment_amount,
                            payment_method=payment_method_name,
                            recorded_by=member,
                            transaction_id=billing.id if billing else None
                        )
                        print(f"[ServiceFeePayment] ✅ Payment received notification created for payment ID {payment.id}")
                        
                        create_community_member_payment_confirmation(
                            payment=payment,
                            payment_amount=payment_amount,
                            transaction_id=billing.id if billing else None
                        )
                        print(f"[ServiceFeePayment] ✅ Community member payment confirmation created for payment ID {payment.id}")
                    except Exception as notif_error:
                        # Log but don't fail - notifications are optional
                        print(f"[ServiceFeePayment] Could not create payment notification: {notif_error}")
                        import traceback
                        print(traceback.format_exc())
                    
                    return Response({
                        'success': True,
                        'message': 'Payment recorded successfully',
                        'data': ServiceFeePaymentSerializer(payment).data
                    }, status=status.HTTP_201_CREATED)
                
                else:
                    return Response({
                        'success': False,
                        'message': 'Invalid payment data',
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
        except ValidationError as e:
            return Response({'success': False, 'message': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            error_message = str(e)
            if 'AnonymousUser' in error_message:
                error_message = 'Authentication required to create payments. Please log in and try again.'
            elif 'Member' in error_message and 'DoesNotExist' in error_message:
                error_message = 'User account not found. Please contact administrator.'
            elif 'Field' in error_message and 'expected a number' in error_message:
                error_message = 'Invalid user data. Please refresh the page and try again.'
            
            return Response({
                'success': False,
                'message': f'Error creating payment: {error_message}',
                'error_details': str(e) if error_message != str(e) else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# PaymentHistoryView definition moved to the end of the file for comprehensive Raw SQL implementation


class ServiceFeePaymentDetailView(APIView):
    """
    API view for retrieving, updating, and deleting individual payments
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def get(self, request, payment_id):
        """
        Get payment details
        """
        # View permission for reading payment detail
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            payment = get_object_or_404(
                ServiceFeePayment.objects.select_related(
                    'resident', 'unit', 'unit__floor__tower', 'service_fee', 'created_by'
                ),
                id=payment_id
            )
            
            serializer = ServiceFeePaymentSerializer(payment)
            
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving payment: {str(e)}'
            }, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, payment_id):
        """
        Update payment details
        """
        # Edit permission for updating a payment
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            payment = get_object_or_404(ServiceFeePayment, id=payment_id)
            
            serializer = ServiceFeePaymentSerializer(
                payment, 
                data=request.data, 
                context={'request': request},
                partial=True
            )
            
            if serializer.is_valid():
                # Store old data for audit trail
                old_data = ServiceFeePaymentSerializer(payment).data
                updated_payment = serializer.save()
                
                # Refresh payment to ensure all related data is loaded
                try:
                    updated_payment.refresh_from_db()
                except Exception:
                    pass
                
                # Get updated payment data for email (after refresh to ensure latest data)
                updated_payment_data = ServiceFeePaymentSerializer(updated_payment).data
                
                # Check if email should be sent (from frontend request)
                send_email = request.data.get('sendEmail', True)  # Default to True if not specified
                
                # Schedule async email sending after successful transaction commit
                def trigger_async_email(p_obj, p_data, s_email):
                    try:
                        threading.Thread(
                            target=send_payment_email_if_enabled,
                            kwargs={
                                'payment_obj': p_obj,
                                    'payment_data': p_data,
                                    'send_email': s_email,
                                    'operation_type': "payment update"
                                },
                                daemon=True
                            ).start()
                    except Exception as e:
                        print(f"Error triggering async email: {str(e)}")

                transaction.on_commit(lambda: trigger_async_email(updated_payment, updated_payment_data, send_email))
                
                # Create audit trail for payment update
                try:
                    member = None
                    # Use created_by_id from the payment data instead of request.user
                    if hasattr(updated_payment, 'created_by_id') and updated_payment.created_by_id:
                        try:
                            member = Member.objects.get(id=updated_payment.created_by_id)
                        except Member.DoesNotExist:
                            member = None
                    
                    # Get resident name safely
                    resident_name = 'Unknown'
                    try:
                        if updated_payment.resident:
                            resident_name = updated_payment.resident.full_name or 'Unknown'
                    except:
                        pass
                    
                    create_audit_trail(
                        member=member,
                        event_type='PAYMENT_UPDATED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=updated_payment.id,
                        old_data=old_data,
                        new_data=ServiceFeePaymentSerializer(updated_payment).data,
                        description=f'Payment updated for resident {resident_name}, amount: {updated_payment.amount}'
                    )
                except Exception as e:
                    # Continue without audit trail - don't fail the update
                    pass
                
                return Response({
                    'success': True,
                    'message': 'Payment updated successfully',
                    'data': ServiceFeePaymentSerializer(updated_payment).data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'success': False,
                'message': 'Invalid payment data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error updating payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, payment_id):
        """
        Delete a payment permanently
        """
        # Permission for deleting recorded payment
        self.required_permission_id = [PERMISSION_DELETE_RECORDED_PAYMENT]
        try:
            payment = get_object_or_404(ServiceFeePayment, id=payment_id)
            
            # Store payment data for audit trail before deletion
            payment_data = ServiceFeePaymentSerializer(payment).data
            resident_name = payment.resident.full_name if payment.resident else 'Unknown Resident'
            amount = payment.amount
            
            # Permanently delete the payment record
            payment.delete()
            
            # Create audit trail for payment deletion
            try:
                member = None
                # Use created_by_id from the payment data instead of request.user
                if hasattr(payment, 'created_by_id') and payment.created_by_id:
                    try:
                        member = Member.objects.get(id=payment.created_by_id)
                    except Member.DoesNotExist:
                        member = None
                
                create_audit_trail(
                    member=member,
                    event_type='PAYMENT_DELETED',
                    table_name='service_fee_management_servicefeegenerate',
                    row_id=payment_id,
                    old_data=payment_data,
                    description=f'Payment deleted permanently for resident {resident_name}, amount: {amount}'
                )
            except Exception as e:
                pass
            
            return Response({
                'success': True,
                'message': 'Payment deleted permanently'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error deleting payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeMultiMonthPaymentView(APIView):
    """
    API view for creating payments for multiple months at once
    Allows users to select multiple unpaid months and pay all at once
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def post(self, request):
        # Record-payment permission required for multi-month payments
        self.required_permission_id = [PERMISSION_RECORD_PAYMENT]
        """
        Create payments for multiple months in a single atomic transaction
        If any operation fails, the entire transaction rolls back to prevent partial saves
            
        NEW LOGIC:
        - If user selects ONLY ONE month and pays MORE than due:
          * Clear the selected month first
          * Auto-apply excess to next unpaid month (chronologically)
          * Return message: "October cleared. \u20b91000 auto-applied to November."
            
        - If user selects MULTIPLE months:
          * No automatic transfer between selected months
          * Each month handles its own payment independently
          * Excess returned: "October cleared. \u20b91000 excess returned."
            
        Expected request body:
        {
            "unit_id": 123,
            "service_fee_id": 456,
            "resident_id": 789,
            "payment_method": "Cash",
            "reference_number": "TXN123456",
            "notes": "Payment for multiple months",
            "created_by": 1,
            "sendEmail": true,
            "selected_periods": [
                {
                    "service_period_month": 9,
                    "service_period_year": 2025,
                    "amount": "10000.00"
                }
            ]
        }
        """
        import time
        from datetime import datetime
        start_time = time.time()
        print(f"\n[MultiMonthPayment] STARTING PROCESS at {datetime.now()}")

        from django.db import transaction
        from django.db.models import Sum
        from decimal import Decimal
        from .models import ServiceFeeItem, ServiceFeePaymentAllocation, AdvancePayment, PenaltyWaiver, ServiceFeeBilling
        
        try:
            with transaction.atomic():
                # Extract common fields
                unit_id = request.data.get('unit_id')
                service_fee_id = request.data.get('service_fee_id')
                resident_id = request.data.get('resident_id')
                payment_method = request.data.get('payment_method')
                print(f"🔍 DEBUG: payment_method from request = {payment_method} (type: {type(payment_method)})")
                reference_number = request.data.get('reference_number', '')
                notes = request.data.get('notes', '')
                created_by_id = request.data.get('created_by')
                send_email = request.data.get('sendEmail', True)
                selected_periods = request.data.get('selected_periods', [])
                total_amount_input = request.data.get('total_amount')  # User's single input amount
                payment_date_input = request.data.get('payment_date')
                    
                # Detailed Tracking Fields
                received_by_id = request.data.get('received_by_id')
                received_by_name = request.data.get('received_by_name')
                from_account_number = request.data.get('from_account_number')
                to_account_number = request.data.get('to_account_number')
                to_account_name = request.data.get('to_account_name')
                other_method_name = request.data.get('other_method_name')
                voucher_id = request.data.get('voucher_id')  # Linked bill voucher
                payment_account_code = request.data.get('payment_account_code')  # Payment method account code
                payment_account_name = request.data.get('payment_account_name')  # Payment method account name
                account_holder_type = request.data.get('account_holder_type')
                account_holder_id = request.data.get('account_holder_id')
                payment_gateway = request.data.get('payment_gateway')  # Check if this is a gateway payment
                    
                # Get related objects and determine identity
                payment_method_obj = None
                
                # Get related objects and determine identity
                payment_method_obj = None
                
                # Use provided payment method if available
                if payment_method:
                    try:
                        payment_method_obj = PaymentMethod.objects.get(id=payment_method)
                        print(f"✅ Using payment_method: {payment_method_obj.method_name} (ID: {payment_method_obj.id})")
                    except PaymentMethod.DoesNotExist:
                        print(f"❌ PaymentMethod with ID {payment_method} not found")
                        pass

                # Fallback: Default to Cash if not provided or found
                if not payment_method_obj:
                    print(f"⚠️  No valid payment_method found, fallback to Cash")
                    try:
                        payment_method_obj = PaymentMethod.objects.get(method_name='Cash')
                    except PaymentMethod.DoesNotExist:
                        print(f"❌ Could not find Cash payment method")
                        pass

                # Fetch Received By Member if ID provided
                received_by = None
                if received_by_id and str(received_by_id).isdigit():
                    try:
                        received_by = Member.objects.get(id=received_by_id)
                    except Member.DoesNotExist:
                        pass
                    
                # Parse payment_date
                payment_datetime = datetime.now()
                if payment_date_input:
                    try:
                        from django.utils.dateparse import parse_date
                        parsed_date = parse_date(payment_date_input)
                        if parsed_date:
                            # Convert date to datetime at midnight for billing
                            payment_datetime = datetime.combine(parsed_date, datetime.min.time())
                    except Exception:
                        pass
                    
                payment_date = payment_datetime.date()
                    
                # Validate required fields (resident_id is optional)
                if not all([unit_id, service_fee_id, payment_method, created_by_id]):
                    return Response({
                        'success': False,
                        'message': 'Missing required fields (unit_id, service_fee_id, payment_method, created_by)'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
                # Allow empty periods IF there is a manual amount (Pure Advance Payment)
                if (not isinstance(selected_periods, list) or len(selected_periods) == 0) and (not total_amount_input or float(total_amount_input) <= 0):
                    return Response({
                        'success': False,
                        'message': 'selected_periods must be a non-empty array OR total_amount must be greater than 0'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
                # Get related objects and determine identity
                # Identity can come from: 
                # 1. account_holder_type/id (explicit)
                # 2. resident_id (legacy/frontend)
                # 3. unit owner (fallback)
                try:
                    unit = Unit.objects.get(id=unit_id)
                    service_fee = ServiceFee.objects.get(id=service_fee_id)
                    created_by = Member.objects.get(id=created_by_id) if created_by_id else None
                    
                    resident_member = None
                    
                    # 1. Use explicit account holder info from request if available
                    from towers.models import Resident, Owner
                    
                    # Define identity_id early to avoid NameError
                    identity_id = resident_id or account_holder_id
                    
                    if account_holder_type and account_holder_id:
                        print(f"   ℹ️ Using provided account holder: {account_holder_type} #{account_holder_id}")
                        if account_holder_type == 'owner':
                             owner_obj = Owner.objects.filter(id=account_holder_id).select_related('member').first()
                             if owner_obj: resident_member = owner_obj.member
                             
                    # 2. Fallback to resident_id/identity_id if account holder NOT provided
                    elif identity_id:
                        # Priority Change: Try Owner ONLY
                        owner_obj = Owner.objects.select_related('member').filter(id=identity_id).first()
                        if owner_obj:
                            resident_member = owner_obj.member
                            account_holder_type = account_holder_type or 'owner'
                            account_holder_id = account_holder_id or owner_obj.id
                                
                    # 3. Final Fallback to Unit Owner if still no identity
                    if not resident_member:
                        owner = Owner.objects.select_related('member').filter(unit_id=unit_id).first()
                        if owner:
                            resident_member = owner.member
                            account_holder_type = account_holder_type or 'owner'
                            account_holder_id = account_holder_id or owner.id
                            
                except (Unit.DoesNotExist, ServiceFee.DoesNotExist, Resident.DoesNotExist, Member.DoesNotExist) as e:
                    return Response({
                        'success': False,
                        'message': f'Invalid reference: {str(e)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Initialize tracking variables
                created_payments = []
                total_amount = Decimal('0.00')
                excess_amount = Decimal(str(total_amount_input)) if total_amount_input else Decimal('0.00')
                standalone_billing_created = False  # Track if we created a standalone billing record
                advance_payment_created = None  # Track the created advance payment
                
                # Handling Pure Advance Payment (No periods selected)
                if not selected_periods and excess_amount > 0:
                    print("\n🚀 Processing Pure Advance Payment (No periods selected)")
                    
                    # Generate Transaction IDs
                    from .models import generate_unique_sequential_id, ServiceFeeBilling
                    now = datetime.now()
                    batch_transaction_id = generate_unique_sequential_id(ServiceFeeBilling, 'transaction_id', f"TXN-{now.year}-{now.month:02d}-", 8)
                    batch_receipt_id = generate_unique_sequential_id(ServiceFeeBilling, 'receipt_id', f"RCP-{now.year}-{now.month:02d}-", 5)
                    
                    # Ensure payment method is strictly set (should be handled by top logic)
                    if not payment_method_obj:
                        if payment_method:
                            try:
                                payment_method_obj = PaymentMethod.objects.get(id=payment_method)
                            except PaymentMethod.DoesNotExist:
                                pass
                        
                        if not payment_method_obj:
                            try:
                                payment_method_obj = PaymentMethod.objects.get(method_name='Cash')
                            except PaymentMethod.DoesNotExist:
                                pass
                                
                    print(f"🔹 Pure Advance: Using payment method {payment_method_obj.method_name if payment_method_obj else 'None'}")

                    # Create NEW Advance Payment Record (each transaction is separate)
                    advance_payment = AdvancePayment.objects.create(
                        unit_id=unit_id,
                        account_holder_type=account_holder_type,
                        account_holder_id=account_holder_id,
                        amount=excess_amount,
                        remaining_amount=excess_amount,
                        status='available',
                        advance_type='advance_payment',
                        payment_method=payment_method_obj,
                        created_by=created_by
                    )
                    advance_payment_created = advance_payment  # Track for response
                    
                    print(f"   ✅ Created NEW AdvancePayment (ID={advance_payment.id}, Amount={excess_amount}, PaymentMethod={payment_method_obj.method_name if payment_method_obj else 'NULL'})")

                    # NOW, to generate a Receipt/Payment Detail:
                    from .models import ServiceFeeBilling
                    
                    detail = ServiceFeeBilling.objects.create(
                        servicefeepaymentid=None, # Pure advance, no SFP
                        advance_payment=advance_payment, # Link to advance record (FIXED: was advance_payment_created)
                        payment_method=payment_method_obj,
                        payment_type='advance_payment',
                        billing_amount=Decimal('0.00'), 
                        total_paid=excess_amount, 
                        payment_date=payment_datetime,
                        transaction_id=batch_transaction_id,
                        receipt_id=batch_receipt_id,
                        received_by=received_by,
                        received_by_name=received_by_name,
                        from_account_number=from_account_number,
                        to_account_number=to_account_number,
                        to_account_name=to_account_name,
                        other_method_name=other_method_name,
                        payment_account_code=payment_account_code, 
                        payment_account_name=payment_account_name, 
                        created_by=created_by,
                        notes=f"Advance Payment - {notes}"
                    )
                    print(f"   ✅ Created ServiceFeeBilling (ID={detail.id}) for Advance Payment")

                    # Generate Voucher for Advance Payment
                    from .utils.voucher_generator import create_payment_voucher
                    voucher_result = create_payment_voucher(
                        billing_records=[detail],
                        total_amount=float(detail.total_paid),  # Use actual cash in billing record
                        payment_method_id=payment_method,
                        member=created_by,
                        unit=unit,
                        batch_receipt_id=batch_receipt_id,
                        notes=f"Advance Payment: {notes}",
                        entry_date=payment_datetime.date()
                    )
                    
                    if not voucher_result.get('success'):
                        raise ValidationError(f"Accounting Integration Failed (Advance): {voucher_result.get('message')}")

                    # Clear excess_amount so it doesn't get processed again by legacy logic if any
                    excess_amount = Decimal('0.00') 
                    
                    # Create advance payment notification for admins with record payment permission
                    try:
                        from notifications.utils import (
                            create_service_fee_payment_received_notification,
                            create_community_member_payment_confirmation
                        )
                        
                        # Get owner for community member notification
                        advance_owner_obj = None
                        if account_holder_type == 'owner' and account_holder_id:
                            advance_owner_obj = Owner.objects.select_related('member').filter(id=account_holder_id).first()
                        if not advance_owner_obj:
                            advance_owner_obj = Owner.objects.select_related('member').filter(unit_id=unit_id).first()
                        
                        # Create a mock payment object with advance payment details for notification
                        class AdvancePaymentMock:
                            def __init__(self, advance, unit, billing, owner_obj):
                                self.id = advance.id
                                self.unit = unit
                                self.amount = advance.amount
                                self.currency = 'BDT'
                                self.service_period_month = None  # Advance has no period
                                self.service_period_year = None
                                self.bill_number = None  # Advance has no bill number
                                self.owner = owner_obj  # Owner for community member notification
                        
                        mock_payment = AdvancePaymentMock(advance_payment, unit, detail, advance_owner_obj)
                        
                        # Get payment method name
                        payment_method_name = payment_method_obj.method_name if payment_method_obj else 'Not specified'
                        
                        # Create admin notification
                        print(f"[ServiceFeePayment] Creating advance payment notification...")
                        create_service_fee_payment_received_notification(
                            payment=mock_payment,
                            payment_amount=advance_payment.amount,
                            payment_method=payment_method_name,
                            recorded_by=created_by,
                            transaction_id=detail.id if detail else None
                        )
                        print(f"[ServiceFeePayment] ✅ Advance payment notification created")
                        
                        # Create community member payment confirmation for advance payment
                        print(f"[ServiceFeePayment] Creating community member advance payment confirmation...")
                        create_community_member_payment_confirmation(
                            payment=mock_payment,
                            payment_amount=advance_payment.amount,
                            transaction_id=detail.id if detail else None
                        )
                        print(f"[ServiceFeePayment] ✅ Community member advance payment confirmation created")
                    except Exception as notif_error:
                        # Log but don't fail - notifications are optional
                        print(f"[ServiceFeePayment] Could not create advance payment notification: {notif_error}")
                        import traceback
                        print(traceback.format_exc())
                    
                    # Send email receipt if enabled
                    if send_email:
                        print(f"   🚀 Advance-only Email receipt scheduled for commit: {batch_receipt_id}")
                        transaction.on_commit(lambda rid=batch_receipt_id: trigger_bulk_payment_receipt_emails([rid]))
                        print(f"   🚀 Email sending offloaded to background thread")

                    return Response({
                        'success': True,
                        'message': 'Advance payment recorded successfully',
                        'data': {
                            'batch_transaction_id': batch_transaction_id,
                            'batch_receipt_id': batch_receipt_id,
                            'advance_balance': str(advance_payment.remaining_amount)
                        }
                    }, status=status.HTTP_201_CREATED)


                print(f"   Total amount to distribute: {total_amount_input} TK")
                
                # Prepare for batch voucher generation
                from .models import generate_unique_sequential_id, ServiceFeeBilling
                from .utils.voucher_generator import create_payment_voucher, create_waiver_adjustment_voucher
                
                now = datetime.now()
                batch_transaction_id = generate_unique_sequential_id(ServiceFeeBilling, 'transaction_id', f"TXN-{now.year}-{now.month:02d}-", 8)
                batch_receipt_id = generate_unique_sequential_id(ServiceFeeBilling, 'receipt_id', f"RCP-{now.year}-{now.month:02d}-", 5)
                
                print(f"   🆔 Generated Batch IDs: Transaction={batch_transaction_id}, Receipt={batch_receipt_id}")
                
                all_billing_records = []
                total_cash_received = Decimal('0.00')

                # Process each selected period
                for period in selected_periods:
                    service_period_month = period.get('service_period_month')
                    service_period_year = period.get('service_period_year')
                    
                    if not service_period_month or not service_period_year:
                        print(f"   ⚠️  Invalid period data, skipping")
                        continue
                        
                    # Initialize variables to avoid UnboundLocalError in complex branches
                    payment = None
                    payment_amount = Decimal('0.00')
                    
                    # Try to find existing payment for this period
                    # Filter by unit, fee, month, year (Identity is secondary to finding the core bill)
                    lookup_params = {
                        'unit_id': unit_id,
                        'service_fee_id': service_fee_id,
                        'service_period_month': service_period_month,
                        'service_period_year': service_period_year,
                    }
                    if account_holder_type:
                        lookup_params['account_holder_type'] = account_holder_type
                    if account_holder_id:
                        lookup_params['account_holder_id'] = account_holder_id
                    
                    print(f"\n   Processing {service_period_month:02d}/{service_period_year}:")
                    print(f"   Lookup params: {lookup_params}")
                    
                    # First try with account holder filters
                    unpaid_payment = ServiceFeePayment.objects.filter(**lookup_params).first()
                    
                    # If not found and account holder was specified, try without account holder filter
                    if not unpaid_payment and (account_holder_type or account_holder_id):
                        print(f"   ⚠️  No payment found with account holder filter. Trying without account holder...")
                        basic_lookup = {
                            'unit_id': unit_id,
                            'service_fee_id': service_fee_id,
                            'service_period_month': service_period_month,
                            'service_period_year': service_period_year,
                        }
                        unpaid_payment = ServiceFeePayment.objects.filter(**basic_lookup).first()
                        if unpaid_payment:
                            print(f"   ✅ Found payment without account holder filter!")
                            print(f"   Found payment's account holder: type={unpaid_payment.account_holder_type}, id={unpaid_payment.account_holder_id}")
                    
                    print(f"   Existing payment: {'Found (ID=' + str(unpaid_payment.id) + ')' if unpaid_payment else 'Not found'}")
                    
                    # Get available advance balance for this unit/identity
                    advance_lookup = {
                        'unit_id': unit_id,
                        'status__in': ['available', 'partial'],
                    }
                    if account_holder_type:
                        advance_lookup['account_holder_type'] = account_holder_type
                    if account_holder_id:
                        advance_lookup['account_holder_id'] = account_holder_id
                        
                    available_advance_balance = AdvancePayment.objects.filter(**advance_lookup).aggregate(sum=Sum('remaining_amount'))['sum'] or Decimal('0.00')

                    # Skip month if no cash left AND no advance left
                    if (excess_amount <= 0 and available_advance_balance <= 0) or not unpaid_payment:
                        if not unpaid_payment:
                            print(f"   ⚠️  Payment record not found for {service_period_month:02d}/{service_period_year}, skipping (requires generation first)")
                        else:
                            print(f"   ⚠️  No cash or advance left for {service_period_month:02d}/{service_period_year}, skipping")
                        continue
                    
                    # Store original cash for this month's billing record
                    cash_available_before = excess_amount
                    existing_payment = unpaid_payment  # May be None if no payment exists
                    
                    # Calculate due date
                    # Handle cases where due_day exceeds days in the month (e.g. Feb 30)
                    _, last_day = calendar.monthrange(service_period_year, service_period_month)
                    due_day = min(service_fee.due_day, last_day)
                    due_date = datetime(service_period_year, service_period_month, due_day).date()
                    
                    # Initial status placeholder — will be overwritten after payment is processed.
                    # NEVER set 'overdue' here: we haven't applied the payment yet.
                    # The final status (paid / partial / overdue) is determined below
                    # after new_total_paid is known (around the service_status block).
                    service_status = 'pending'
                    
                    if existing_payment:
                        # Update existing payment record
                        
                        # VALIDATION: Check current ServiceFeePayment.amount before processing
                        print(f"\n🔍 Validating ServiceFeePayment ID={existing_payment.id} before payment processing")
                        print(f"   Current amount in DB: {existing_payment.amount}")
                        print(f"   Current remaining_amount: {existing_payment.remaining_amount}")
                        print(f"   Payment status: {existing_payment.payment_status}")
                        print(f"   Service status: {existing_payment.service_status}")
                        
                        # Get the ORIGINAL FIXED amount and calculate new totals
                        try:
                            # Get the FIRST billing record to retrieve the original fixed amount
                            # first_billing = ServiceFeeBilling.objects.filter(
                            #     servicefeepaymentid=existing_payment
                            # ).order_by('created_at').first()
                            
                            # if first_billing:
                            #     # IMPORTANT: Use the ORIGINAL FIXED amount from the first billing record
                            #     original_fixed_amount = first_billing.billing_amount
                            # else:
                                # Fallback: use generated base_service_amount from the payment record if no billing exists
                            original_fixed_amount = existing_payment.base_service_amount
                            
                            # Calculate total paid from ALL billing records
                            total_paid_sum = ServiceFeeBilling.objects.filter(
                                servicefeepaymentid=existing_payment
                            ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0.00')
                            
                            
                            # Note: new_total_paid and payment_amount will be calculated below after accounting for both cash and advance
                            
                            # Calculate remaining amount using ORIGINAL fixed amount
                            # Calculate TRUE remaining for this month including additional charges and net penalty
                            # This ensures we don't carry over excess to next month until this month is fully cleared (including penalty)
                            additional_charges = existing_payment.additional_bill_charges or Decimal('0.00')
                            
                            print(f"\n🔍 Payment Processing for ServiceFeePayment ID={existing_payment.id}:")
                            print(f"   base_service_amount: {original_fixed_amount}")
                            print(f"   additional_bill_charges: {additional_charges}")
                            print(f"   existing amount: {existing_payment.amount}")
                            print(f"   total_paid_sum: {total_paid_sum}")
                            
                            # Get penalty and waiver from request (these should be accounted for in the clearing-check)
                            current_penalty = Decimal(str(period.get('penalty_amount', '0')))
                            current_waiver = Decimal(str(period.get('waived_amount', '0')))
                            
                            # Also account for NEW waivers about to be applied in this request
                            new_waiver_data_req = period.get('new_waiver_data', [])
                            additional_new_waiver_total = sum(Decimal(str(w.get('waivedAmount', 0))) for w in new_waiver_data_req)
                            
                            # Net penalty for clearing logic (Gross Penalty - (Current Waivers + New Waivers))
                            # This determines how much CASH is actually needed to clear the penalty
                            net_penalty_for_clearing = max(Decimal('0.00'), current_penalty - max(current_waiver, additional_new_waiver_total))

                            # Remaining amount needed to FULLY clear this month (Principal + Net Penalty)
                            # We subtract total_paid_sum (historical cash) to find the remaining CASH due.
                            total_remaining_to_clear_this_month = (original_fixed_amount + additional_charges - total_paid_sum) + net_penalty_for_clearing
                            
                            # Skip if already fully paid and this wasn't explicitly selected
                            if total_remaining_to_clear_this_month <= 0 and period.get('is_auto_added'):
                                print(f"   ⏩ Month already fully paid (Remaining cash due: {total_remaining_to_clear_this_month}), skipping auto-added month")
                                continue
                            
                            # Handle Advance Payment Application
                            applied_advance_this_month = Decimal('0.00')
                            
                            # If cash (excess_amount) doesn't cover the full due, check advance
                            if cash_available_before < total_remaining_to_clear_this_month:
                                shortfall = total_remaining_to_clear_this_month - cash_available_before
                                
                                # Find available advance records
                                adv_records = AdvancePayment.objects.filter(
                                    unit_id=unit_id,
                                    status__in=['available', 'partial'],
                                    account_holder_type=account_holder_type,
                                    account_holder_id=account_holder_id
                                ).order_by('created_at')
                                
                                for adv in adv_records:
                                    if shortfall <= 0: break
                                    can_take = min(adv.remaining_amount, shortfall)
                                    adv.apply_to_payment(can_take)
                                    applied_advance_this_month += can_take
                                    shortfall -= can_take
                                    print(f"   💸 Applied {can_take} from Advance (ID={adv.id})")

                            # Total payment for this month = cash used + advance applied
                            # payment_amount will hold the total to be allocated
                            actual_cash_for_this_month = min(cash_available_before, total_remaining_to_clear_this_month)
                            payment_amount = actual_cash_for_this_month + applied_advance_this_month
                            
                            # Update global excess_amount (subtract what we took as cash)
                            excess_amount = cash_available_before - actual_cash_for_this_month
                            
                            # CRITICAL CHECK: Skip creating billing record if no payment to allocate
                            # This prevents creating empty billing records when bills are already paid
                            if payment_amount <= 0:
                                print(f"   ⏩ No payment to allocate (already paid), skipping billing record creation")
                                continue
                            
                            # Total paid for status check
                            new_total_paid = total_paid_sum + payment_amount
                            remaining_amount = max(Decimal('0.00'), total_remaining_to_clear_this_month - (actual_cash_for_this_month + applied_advance_this_month))
                            
                            actual_payment_for_billing = payment_amount  # Store for billing
                            
                            # Handle Penalty and Waiver
                            penalty_amount_req = Decimal(str(round(Decimal(str(period.get('penalty_amount', '0'))))))
                            waived_amount_req = Decimal(str(round(Decimal(str(period.get('waived_amount', '0'))))))
                            
                            # new_waiver_data_req already moved up to accurately calculate total_remaining
                            deleted_waiver_ids_req = period.get('deleted_waiver_ids', [])

                            # Generate unique billing_id to avoid constraint violations
                            unique_billing_id = generate_unique_sequential_id(ServiceFeeBilling, 'billing_id', f"BILL-{now.year}-{now.month:02d}-", 6)
                            
                            # Determine payment_result_status for this specific transaction
                            # CRITICAL: Compare CUMULATIVE total (new_total_paid) to bill amount, not just this payment
                            # This tells us if THIS payment completed the bill or left a balance
                            if new_total_paid >= original_fixed_amount:
                                # After this payment, the bill is fully paid (or overpaid)
                                payment_result_status = 'full'
                            else:
                                # After this payment, there's still a balance remaining
                                payment_result_status = 'partial'
                            
                            billing = ServiceFeeBilling.objects.create(
                                billing_id=unique_billing_id,  # CRITICAL: Must be unique
                                transaction_id=batch_transaction_id,
                                receipt_id=batch_receipt_id,
                                servicefeepaymentid=existing_payment,
                                billing_amount=original_fixed_amount,
                                total_paid=Decimal('0.00'),
                                payment_method=payment_method_obj,
                                payment_date=payment_datetime,
                                reference_number=reference_number,
                                notes=f"{notes} - Payment for {datetime(service_period_year, service_period_month, 1).strftime('%B %Y')}",
                                created_by=created_by,
                                received_by=received_by,
                                received_by_name=received_by_name,
                                from_account_number=from_account_number,
                                to_account_number=to_account_number,
                                to_account_name=to_account_name,
                                other_method_name=other_method_name,
                                voucher_id=voucher_id,
                                payment_account_code=payment_account_code,
                                payment_account_name=payment_account_name,
                                payment_result_status=payment_result_status  # NEW: Set payment result status
                            )
                            
                            # Create audit trail for billing creation
                            try:
                                billing_audit_data = {
                                    'id': billing.id,
                                    'billing_id': billing.billing_id,
                                    'transaction_id': billing.transaction_id,
                                    'receipt_id': billing.receipt_id,
                                    'service_fee_payment_id': billing.servicefeepaymentid.id if billing.servicefeepaymentid else None,
                                    'billing_amount': str(billing.billing_amount),
                                    'total_paid': str(billing.total_paid),
                                    'payment_method': billing.payment_method.id if billing.payment_method else None,
                                    'payment_date': str(billing.payment_date),
                                    'reference_number': billing.reference_number,
                                    'voucher_id': billing.voucher_id,
                                    'received_by_name': billing.received_by_name,
                                    'from_account_number': billing.from_account_number,
                                    'to_account_number': billing.to_account_number,
                                    'to_account_name': billing.to_account_name,
                                    'payment_account_code': billing.payment_account_code,
                                    'payment_account_name': billing.payment_account_name,
                                    'created_by': billing.created_by.id if billing.created_by else None,
                                    'notes': billing.notes,
                                    'created_at': str(billing.created_at)
                                }
                                
                                create_audit_trail(
                                    member=created_by,
                                    event_type='BILLING_CREATED',
                                    table_name='service_fee_management_servicefeebilling',
                                    row_id=billing.id,
                                    old_data=None,
                                    new_data=billing_audit_data,
                                    description=f'Service fee billing created - Receipt: {billing.receipt_id}, Amount: ৳{billing.billing_amount}, Month: {datetime(service_period_year, service_period_month, 1).strftime("%B %Y")}'
                                )
                            except Exception as e:
                                print(f"   ⚠️  Billing creation audit failed: {str(e)}")

                            # 1. Process deletions of waivers (Do this first to free up due amount if necessary)
                            if deleted_waiver_ids_req:
                                # Create audit trail for deleted waivers
                                deleted_waivers = PenaltyWaiver.objects.filter(id__in=deleted_waiver_ids_req)
                                for waiver in deleted_waivers:
                                    try:
                                        old_waiver_data = {
                                            'id': waiver.id,
                                            'waiver_type': waiver.waiver_type,
                                            'percentage': str(waiver.percentage) if waiver.percentage else None,
                                            'waived_amount': str(waiver.waived_amount),
                                            'reason': waiver.reason,
                                            'notes': waiver.notes,
                                            'applied_by': waiver.applied_by.id if waiver.applied_by else None,
                                            'applied_at': str(waiver.applied_at)
                                        }
                                        
                                        create_audit_trail(
                                            member=created_by,
                                            event_type='WAIVER_DELETED',
                                            table_name='service_fee_management_penaltywaiver',
                                            row_id=waiver.id,
                                            old_data=old_waiver_data,
                                            new_data=None,
                                            description=f'Penalty waiver deleted - Amount: ৳{waiver.waived_amount}, Reason: {waiver.reason}'
                                        )
                                    except Exception as e:
                                        print(f"   ⚠️  Waiver deletion audit failed: {str(e)}")
                                
                                PenaltyWaiver.objects.filter(id__in=deleted_waiver_ids_req).delete()

                            # 2. Handle Penalty Items (penalties are ALWAYS gross penalty amount)
                            # NOTE: Base service fee items and bill category items are already created during generation phase
                            # We only create/update penalty items during payment when penalties exist
                            penalty_item = None
                            if penalty_amount_req > 0:
                                penalty_item, _ = ServiceFeeItem.objects.get_or_create(
                                    service_fee_payment=existing_payment,
                                    item_type='penalty',
                                    defaults={
                                        'item_name': 'Late Fee',
                                        'amount': penalty_amount_req,  # Always use GROSS penalty amount
                                        'description': 'Late fee applied during payment'
                                    }
                                )
                                # Update penalty amount if current request has higher penalty (gross amount)
                                if penalty_item.amount < penalty_amount_req:
                                    penalty_item.amount = penalty_amount_req  # Update to current GROSS penalty
                                    penalty_item.save()

                            # 3. Create Waivers and Allocate them to Penalty Item
                            for w in new_waiver_data_req:
                                w_type = w.get('waiverType', 'full')
                                if w_type == 'partial':
                                    p_type = w.get('partialType', 'percentage')
                                    w_type = f'partial_{p_type}'
                                
                                waiver = PenaltyWaiver.objects.create(
                                    billing=billing,
                                    waiver_type=w_type,
                                    percentage=w.get('waiverPercentage') or w.get('percentage'),
                                    penalty_amount=penalty_amount_req,
                                    waived_amount=Decimal(str(w.get('waivedAmount', 0))),
                                    penalty_after_waiver=Decimal(str(w.get('remainingPenalty', penalty_amount_req - waived_amount_req))),
                                    reason=w.get('reason', ''),
                                    notes=w.get('notes', ''),
                                    applied_by=created_by
                                )
                                
                                # Create audit trail for new waiver
                                try:
                                    new_waiver_data = {
                                        'id': waiver.id,
                                        'waiver_type': waiver.waiver_type,
                                        'percentage': str(waiver.percentage) if waiver.percentage else None,
                                        'waived_amount': str(waiver.waived_amount),
                                        'penalty_after_waiver': str(waiver.penalty_after_waiver),
                                        'reason': waiver.reason,
                                        'notes': waiver.notes,
                                        'applied_by': waiver.applied_by.id if waiver.applied_by else None,
                                        'billing_id': waiver.billing.id if waiver.billing else None,
                                        'applied_at': str(waiver.applied_at)
                                    }
                                    
                                    create_audit_trail(
                                        member=created_by,
                                        event_type='WAIVER_CREATED',
                                        table_name='service_fee_management_penaltywaiver',
                                        row_id=waiver.id,
                                        old_data=None,
                                        new_data=new_waiver_data,
                                        description=f'Penalty waiver created - Type: {waiver.waiver_type}, Amount: ৳{waiver.waived_amount}, Reason: {waiver.reason}'
                                    )
                                except Exception as e:
                                    print(f"   ⚠️  Waiver creation audit failed: {str(e)}")
                                
                                if penalty_item:
                                    ServiceFeePaymentAllocation.objects.create(
                                        service_fee_billing=billing,
                                        service_fee_item=penalty_item,
                                        service_fee_payment=existing_payment,
                                        allocated_amount=waiver.waived_amount,
                                        allocation_type='credit',  # Credit = waiver reduces liability without cash
                                        penalty_waiver=waiver,
                                        description=f"Waiver applied: {waiver.reason}"
                                    )

                            # 4. HIERARCHICAL ALLOCATION for Cash Payment
                            items = ServiceFeeItem.objects.filter(service_fee_payment=existing_payment)
                            
                            def get_item_priority(item):
                                t = (item.item_type or '').lower()
                                if 'penalty' in t or 'late' in t: return 0
                                if 'service' in t or 'base' in t: return 1
                                if 'bill' in t or 'category' in t: return 2  # Bill items priority 2
                                return 3  # Everything else
                            
                            sorted_items = sorted(items, key=get_item_priority)
                            
                            remaining_cash = actual_cash_for_this_month
                            remaining_advance = applied_advance_this_month

                            base_fee_allocation = Decimal('0.00')  # Track total allocation (cash + advance) to base service fee
                            bill_item_allocation = Decimal('0.00')  # Track total allocation to bill items
                            penalty_allocation = Decimal('0.00')  # Track total allocation to penalties
                            
                            for item in sorted_items:
                                if remaining_cash <= 0 and remaining_advance <= 0:
                                    break
                                
                                total_covered_historically = ServiceFeePaymentAllocation.objects.filter(
                                    service_fee_item=item
                                ).exclude(service_fee_billing=billing).aggregate(sum=Sum('allocated_amount'))['sum'] or Decimal('0.00')
                                
                                current_session_allocations = ServiceFeePaymentAllocation.objects.filter(
                                    service_fee_billing=billing,
                                    service_fee_item=item
                                ).aggregate(sum=Sum('allocated_amount'))['sum'] or Decimal('0.00')
                                
                                item_due_now = item.amount - (total_covered_historically + current_session_allocations)
                                
                                if item_due_now > 0:
                                    # 1. Apply Advance first (if available)
                                    if remaining_advance > 0:
                                        adv_to_allocate = min(remaining_advance, item_due_now)
                                        ServiceFeePaymentAllocation.objects.create(
                                            service_fee_billing=billing,
                                            service_fee_item=item,
                                            service_fee_payment=existing_payment,
                                            allocated_amount=adv_to_allocate,
                                            allocation_type='advance',
                                            description=f"Advance applied from balance"
                                        )
                                        remaining_advance -= adv_to_allocate
                                        item_due_now -= adv_to_allocate
                                        
                                        # Track for totals
                                        item_type = (item.item_type or '').lower()
                                        if 'penalty' in item_type or 'late' in item_type: penalty_allocation += adv_to_allocate
                                        elif 'service' in item_type or 'base' in item_type: base_fee_allocation += adv_to_allocate
                                        elif 'bill' in item_type or 'category' in item_type: bill_item_allocation += adv_to_allocate

                                    # 2. Apply Cash (if still due)
                                    if item_due_now > 0 and remaining_cash > 0:
                                        cash_to_allocate = min(remaining_cash, item_due_now)
                                        ServiceFeePaymentAllocation.objects.create(
                                            service_fee_billing=billing,
                                            service_fee_item=item,
                                            service_fee_payment=existing_payment,
                                            allocated_amount=cash_to_allocate,
                                            allocation_type='debit',
                                            description=f"Cash payment from receipt {billing.receipt_id}"
                                        )
                                        remaining_cash -= cash_to_allocate
                                        
                                        # Track for totals
                                        item_type = (item.item_type or '').lower()
                                        if 'penalty' in item_type or 'late' in item_type: penalty_allocation += cash_to_allocate
                                        elif 'service' in item_type or 'base' in item_type: base_fee_allocation += cash_to_allocate
                                        elif 'bill' in item_type or 'category' in item_type: bill_item_allocation += cash_to_allocate
                            
                            # Update billing.total_paid with ALL cash allocations (penalties + base + bills)
                            # This represents total CASH payment in this billing transaction
                            # Waivers are already excluded because they're credit type, not debit
                            
                            # Verify penalty_allocation is net (after waivers)
                            # Single query with conditional aggregation for debit and credit
                            penalty_totals = ServiceFeePaymentAllocation.objects.filter(
                                service_fee_billing=billing,
                                service_fee_item__item_type__icontains='penalty'
                            ).aggregate(
                                total_paid_penalty=Sum(Case(
                                    When(allocation_type__in=['debit', 'advance'], then=F('allocated_amount')),
                                    default=Decimal('0.00'),
                                    output_field=models.DecimalField()
                                )),
                                credit_total=Sum(Case(
                                    When(allocation_type='credit', then=F('allocated_amount')),
                                    default=Decimal('0.00'),
                                    output_field=models.DecimalField()
                                ))
                            )
                            
                            penalty_debit_total = penalty_totals['total_paid_penalty'] or Decimal('0.00')
                            penalty_credit_total = penalty_totals['credit_total'] or Decimal('0.00')
                            
                            # Net penalty cash payment = both cash and advance allocations (excluding credit)
                            net_penalty_payment = penalty_debit_total
                            
                            print(f"   Penalty verification: debit={penalty_debit_total}, credit(waiver)={penalty_credit_total}, net={net_penalty_payment}")
                            print(f"   Penalty allocation tracked: {penalty_allocation}")
                            
                            billing.total_paid = penalty_allocation + base_fee_allocation + bill_item_allocation
                            billing.save()
                            
                            # CRITICAL FIX: Update global excess_amount BASED ON ACTUAL CONSUMPTION
                            # This handles the case where total_remaining_to_clear was 270 but allocations only needed 250 (e.g. due to waivers)
                            # We subtract ONLY what was taken from cash (not advance)
                            cash_consumed_this_session = actual_cash_for_this_month - remaining_cash
                            excess_amount = cash_available_before - cash_consumed_this_session
                            
                            print(f"   💳 Cash consumption: took {actual_cash_for_this_month} initially, used {cash_consumed_this_session}, stranded {remaining_cash} returned to excess")
                            print(f"   Updated global excess_amount for next month: {excess_amount}")
                            
                            # Final step: update billing totals
                            billing.calculate_totals()
                            
                            # RECALCULATE TOTAL ALLOCATED AMOUNT (including penalties paid in this session)
                            print(f"\n💰 Recalculating total allocated amount for ServiceFeePayment ID={existing_payment.id}")
                            
                             # Get ALL allocations across ALL billing records for this payment
                            total_allocated_to_all_items = ServiceFeePaymentAllocation.objects.filter(
                                service_fee_payment=existing_payment,
                                allocation_type__in=['debit', 'advance']  # Both cash and advance count
                            ).aggregate(total=Sum('allocated_amount'))['total'] or Decimal('0.00')
                            
                            print(f"   Total cash allocated to all items (base fee + penalties + others): {total_allocated_to_all_items}")
                            print(f"   Previous amount in ServiceFeePayment: {existing_payment.amount}")
                            
                            # Calculate TOTAL CASH PAID (base fee + bill items + penalties)
                            # ServiceFeePayment.amount should track ALL cash payments including penalties
                            # This ensures frontend calculations work correctly: total_liability - amount = remaining
                            print(f"   Total cash paid (including penalties): {total_allocated_to_all_items}")
                        
                            
                        except Exception as e:
                            raise
                        
                        # Get gross penalty from penalty items BEFORE calculating total_liability
                        penalty_items = ServiceFeeItem.objects.filter(
                            service_fee_payment=existing_payment,
                            item_type='penalty'
                        )
                        gross_penalty_from_items = penalty_items.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
                        
                        print(f"\n💰 Liability Calculation for ServiceFeePayment ID={existing_payment.id}:")
                        print(f"   base_service_amount: {original_fixed_amount}")
                        print(f"   additional_bill_charges: {additional_charges}")
                        print(f"   gross_penalty_from_items: {gross_penalty_from_items}")
                        print(f"   penalty_items count: {penalty_items.count()}")
                        print(f"   existing_payment.gross_penalty_amount (stored): {existing_payment.gross_penalty_amount}")
                        
                        # CRITICAL FIX: Use stored penalty if items don't exist yet
                        # This handles the case where PayStation payment came first (no items created yet)
                        # and web payment comes second (needs correct total to compare against)
                        if gross_penalty_from_items == 0 and existing_payment.gross_penalty_amount > 0:
                            print(f"   ⚠️ Using stored gross_penalty_amount instead of items")
                            gross_penalty_from_items = existing_payment.gross_penalty_amount
                        
                        # Calculate total waived amount from all waivers
                        total_waived_so_far = PenaltyWaiver.objects.filter(
                            billing__servicefeepaymentid=existing_payment
                        ).aggregate(total=Sum('waived_amount'))['total'] or Decimal('0.00')
                        
                        # Net penalty for liability calculation (gross - waivers)
                        net_penalty_for_liability = max(Decimal('0.00'), gross_penalty_from_items - total_waived_so_far)
                        
                        # Determine service_status based on TOTAL ALLOCATED (including penalties) vs total liability
                        # Use net penalty (after waivers) for total liability
                        total_liability = original_fixed_amount + additional_charges + net_penalty_for_liability
                        
                        # CRITICAL FIX: Use total_paid from ServiceFeeBilling instead of allocations
                        # This ensures PayStation payments (which don't create allocations) are counted
                        # Get total paid from ServiceFeeBilling (includes all payment types)
                        total_paid_all_billings = ServiceFeeBilling.objects.filter(
                            servicefeepaymentid=existing_payment
                        ).aggregate(total=Sum('total_paid'))['total'] or Decimal('0.00')
                        
                        print(f"\n📊 Status Calculation:")
                        print(f"   total_liability: {total_liability}")
                        print(f"   total_allocated_to_all_items: {total_allocated_to_all_items}")
                        print(f"   total_paid_all_billings: {total_paid_all_billings}")
                        
                        # Use total_paid_all_billings for status check (includes PayStation + web payments)
                        # CRITICAL: Check due date to maintain 'overdue' status for late payments
                        if total_paid_all_billings >= total_liability:
                            service_status = 'paid'
                            payment_status = 'completed'  # Only completed when fully paid
                        elif total_paid_all_billings > 0:
                            # Some payment made → always 'partial', never 'overdue'
                            # Even if past due date, a partial payment means 'partial'
                            service_status = 'partial'
                            payment_status = 'pending'  # Still pending for partial payments
                        else:
                            # No payment at all → check if overdue
                            if existing_payment.due_date and datetime.now().date() > existing_payment.due_date:
                                service_status = 'overdue'
                            else:
                                service_status = 'due'
                            payment_status = 'pending'
                        
                        print(f"   Calculated status: {service_status} / {payment_status}")
                        
                        # Calculate total liability components
                        # 1. Gross Liability (Base + Additional + Gross Penalty)
                        gross_liability = original_fixed_amount + additional_charges + gross_penalty_from_items
                        
                        # 2. Net Liability (Gross - Waivers)
                        net_liability = original_fixed_amount + additional_charges + net_penalty_for_liability
                        
                        # Set ServiceFeePayment.amount as GROSS liability to match user expectation of "Main Amount"
                        # This includes penalties, allowing waivers to be shown as separate reductions
                        if existing_payment.amount != gross_liability:
                            print(f"   📝 Updating amount to GROSS: {existing_payment.amount} -> {gross_liability}")
                            existing_payment.amount = gross_liability
                        else:
                            print(f"   ✅ Amount unchanged (Gross): {gross_liability}")
                        
                        existing_payment.payment_status = payment_status
                        existing_payment.completion_date = payment_date if payment_status == 'completed' else None
                        existing_payment.due_date = due_date
                        existing_payment.service_status = service_status
                        existing_payment.created_by = created_by
                        existing_payment.account_holder_type = account_holder_type
                        existing_payment.account_holder_id = account_holder_id
                        
                        # Update tracking fields - Use already calculated total_paid_all_billings
                        existing_payment.total_paid = total_paid_all_billings
                        # CRITICAL FIX: Calculate remaining_amount AFTER total_paid so they match
                        existing_payment.remaining_amount = max(Decimal('0.00'), net_liability - total_paid_all_billings)
                        existing_payment.penalty_amount = net_penalty_for_liability  # Net penalty after waivers
                        existing_payment.waived_amount = total_waived_so_far
                        existing_payment.gross_penalty_amount = gross_penalty_from_items
                        
                        # Finalize with a single comprehensive save
                        existing_payment.save()
                        
                        # Add to batch for voucher generation later
                        all_billing_records.append(billing)
                        total_cash_received += (billing.total_paid - applied_advance_this_month)
                        
                        # ─────────────────────────────────────────────────────────────
                        
                        # VERIFY: Log the updated values
                        print(f"\n✅ ServiceFeePayment ID={existing_payment.id} updated:")
                        print(f"   amount (gross): {existing_payment.amount}")
                        print(f"   total_paid: {existing_payment.total_paid}")
                        print(f"   waived_amount: {existing_payment.waived_amount}")
                        print(f"   remaining_amount (net - paid): {existing_payment.remaining_amount}")
                        print(f"   service_status: {existing_payment.service_status}")
                        
                        payment = existing_payment
                        action_type = 'PAYMENT_UPDATED'
                        
                        
                        


                        

                        

                        # Update billing total paid (cash + advance)
                    
                    created_payments.append(payment)
                    total_amount += payment_amount  # Use adjusted payment_amount
                

                    # ─────── Per-Month Voucher Generation (IMMEDIATE) ───────
                    try:
                        month_name = calendar.month_name[service_period_month]
                        
                        # 1. Payment Voucher (Cash part for THIS month)
                        # Calculate specific cash amount for this billing (total_paid includes cash + advance)
                        # applied_advance_this_month is what we tracked earlier for this period
                        cash_for_this_month = billing.total_paid - applied_advance_this_month
                        
                        if cash_for_this_month > 0:
                            print(f"   💵 Creating Payment Voucher for {month_name} {service_period_year} (Cash: {cash_for_this_month})")
                            v_res = create_payment_voucher(
                                billing_records=[billing],
                                total_amount=float(cash_for_this_month),
                                payment_method_id=payment_method,
                                member=created_by,
                                unit=unit,
                                batch_receipt_id=batch_receipt_id,
                                notes=f"Payment for {month_name} {service_period_year}",
                                entry_date=payment_datetime.date()
                            )
                            
                            if not v_res.get('success'):
                                raise ValidationError(f"Accounting Failed ({month_name}): {v_res.get('message')}")
                            
                            # Link billing to voucher
                            if v_res.get('voucher_id'):
                                billing.voucher_id = v_res.get('voucher_id')
                                billing.save(update_fields=['voucher_id'])

                        # 2. Adjustment Voucher (Waivers/Advance usage for THIS month)
                        # Check if we have waivers or advance usage
                        has_waivers = billing.waivers.exists()
                        has_advance = applied_advance_this_month > 0
                        
                        if has_waivers or has_advance:
                            print(f"   ⚖️ Creating Adjustment Voucher for {month_name} {service_period_year}")
                            adj_res = create_waiver_adjustment_voucher(
                                billing_records=[billing],
                                member=created_by,
                                unit=unit,
                                batch_receipt_id=batch_receipt_id,
                                month_name=f"{month_name} {service_period_year}",
                                entry_date=payment_datetime.date()
                            )
                            if not adj_res.get('success'):
                                print(f"⚠️ Adjustment Voucher Warning ({month_name}): {adj_res.get('message')}")
                                
                    except Exception as v_err:
                        print(f"❌ Error creating vouchers for {service_period_month}/{service_period_year}: {str(v_err)}")
                        raise ValidationError(f"Voucher Creation Failed: {str(v_err)}")
                    # ─────────────────────────────────────────────────────────────
                    
                    # Create audit trail for each payment
                    try:
                        # Get the transaction_id from the billing record
                        latest_billing = ServiceFeeBilling.objects.filter(
                            servicefeepaymentid=payment
                        ).order_by('-created_at').first()
                        
                        transaction_id = latest_billing.transaction_id if latest_billing else 'N/A'
                        
                        # Prepare new data for audit trail
                        new_data = {
                            'transaction_id': transaction_id,
                            'amount': str(payment.amount),
                            'total_paid': str(payment.total_paid),
                            'remaining_amount': str(payment.remaining_amount),
                            'service_period_month': payment.service_period_month,
                            'service_period_year': payment.service_period_year,
                            'payment_status': payment.payment_status,
                            'service_status': payment.service_status,
                            'unit_id': payment.unit_id,
                            'service_fee_id': payment.service_fee_id,
                            'resident_id': payment.resident_id if payment.resident else None,
                            'account_holder_type': payment.account_holder_type,
                            'account_holder_id': payment.account_holder_id,
                            'voucher_id': voucher_id,
                            'payment_account_code': payment_account_code,
                            'payment_account_name': payment_account_name,
                            'payment_method': payment_method,
                            'waived_amount': str(payment.waived_amount),
                            'penalty_amount': str(payment.penalty_amount),
                            'gross_penalty_amount': str(payment.gross_penalty_amount),
                            'due_date': str(payment.due_date),
                            'completion_date': str(payment.completion_date) if payment.completion_date else None,
                            'reference_number': reference_number,
                            'notes': notes
                        }
                        
                        # Prepare old data for comparison (get previous values from database)
                        old_data = {}
                        if action_type == 'PAYMENT_UPDATED':
                            # Try to get previous state from database
                            try:
                                old_payment = ServiceFeePayment.objects.get(id=payment.id)
                                old_data = {
                                    'amount': str(old_payment.amount),
                                    'total_paid': str(old_payment.total_paid),
                                    'remaining_amount': str(old_payment.remaining_amount),
                                    'payment_status': old_payment.payment_status,
                                    'service_status': old_payment.service_status,
                                    'waived_amount': str(old_payment.waived_amount),
                                    'penalty_amount': str(old_payment.penalty_amount),
                                    'gross_penalty_amount': str(old_payment.gross_penalty_amount),
                                    'completion_date': str(old_payment.completion_date) if old_payment.completion_date else None
                                }
                            except:
                                pass
                        
                        # Create audit trail with both old and new data
                        action_description = 'updated' if action_type == 'PAYMENT_UPDATED' else 'created'
                        
                        create_audit_trail(
                            member=created_by,
                            event_type=action_type,  # PAYMENT_CREATED or PAYMENT_UPDATED
                            table_name='service_fee_management_servicefeegenerate',
                            row_id=payment.id,
                            old_data=old_data if action_type == 'PAYMENT_UPDATED' else None,
                            new_data=new_data,
                            description=f'Multi-month payment {action_description} for {datetime(service_period_year, service_period_month, 1).strftime("%B %Y")}, amount: ৳{payment_amount}, status: {payment.service_status}'
                        )
                    except Exception as e:
                        print(f"   ⚠️  Audit trail creation failed: {str(e)}")
                
                # ADVANCE PAYMENT CREATION LOGIC (outside the for loop, after all periods processed)
                from datetime import timedelta
                
                # Get the latest billing record from the first created payment
                source_billing_record = None
                
                # NEW LOGIC: If no bills were paid (pure advance payment), create a standalone billing record
                if not created_payments and excess_amount > 0:
                    print(f"   📝 No bills found. Creating standalone billing record for pure advance payment")
                    
                    # CRITICAL FIX: For non-gateway payments, always use Cash
                    if not payment_gateway or payment_gateway not in ['paystation', 'sslcommerz']:
                        print(f"   🔹 Non-gateway payment, forcing Cash")
                        try:
                            payment_method_obj = PaymentMethod.objects.get(method_name='Cash')
                        except PaymentMethod.DoesNotExist:
                            print(f"❌ Could not find Cash payment method")
                            pass
                    else:
                        # Gateway payment - use provided method
                        if payment_method:
                            try:
                                payment_method_obj = PaymentMethod.objects.get(id=payment_method)
                            except PaymentMethod.DoesNotExist:
                                pass
                    
                    # Create standalone billing record for the advance payment
                    source_billing_record = ServiceFeeBilling.objects.create(
                        transaction_id=batch_transaction_id,
                        receipt_id=batch_receipt_id,
                        servicefeepaymentid=None,  # No linked ServiceFeePayment (pure advance)
                        billing_amount=Decimal('0.00'),  # No bill amount (advance only)
                        total_paid=excess_amount,  # Full amount is the advance
                        payment_method=payment_method_obj,
                        payment_date=payment_datetime,
                        reference_number=reference_number,
                        notes=f"{notes} - Advance Payment (No bills available)",
                        created_by=created_by,
                        received_by=received_by,
                        received_by_name=received_by_name,
                        from_account_number=from_account_number,
                        to_account_number=to_account_number,
                        to_account_name=to_account_name,
                        other_method_name=other_method_name,
                        voucher_id=voucher_id,
                        payment_account_code=payment_account_code,
                        payment_account_name=payment_account_name
                    )
                    print(f"   ✅ Standalone billing record created: Receipt ID={source_billing_record.receipt_id}")
                    standalone_billing_created = True  # Mark that we created a standalone record
                
                elif created_payments:
                    source_billing_record = ServiceFeeBilling.objects.filter(
                        servicefeepaymentid=created_payments[0]
                    ).order_by('-created_at').first()
                
                # Debug: Log excess_amount before creating advance payment
                print(f"\n💰 ADVANCE PAYMENT CHECK (after all periods processed):")
                print(f"   excess_amount = {excess_amount}")
                print(f"   created_payments count = {len(created_payments)}")
                print(f"   source_billing_record = {source_billing_record}")
                
                # Check if all payments are fully paid (no partial payments)
                all_payments_fully_paid = all(
                    payment.service_status == 'paid' 
                    for payment in created_payments
                ) if created_payments else True
                
                print(f"   all_payments_fully_paid = {all_payments_fully_paid}")
                
                # Create advance payment if there's excess amount
                # CHANGED: Remove the all_payments_fully_paid restriction
                # Excess cash should be saved as advance regardless of whether bills are partial or fully paid
                if excess_amount > 0:
                    try:
                        # Check for duplicate: Don't create if an identical advance was just created
                        # within the last 5 seconds with the same amount and billing source
                        recent_cutoff = timezone.now() - timedelta(seconds=5)
                        duplicate_check = AdvancePayment.objects.filter(
                            unit_id=unit_id,
                            account_holder_type=account_holder_type,
                            account_holder_id=account_holder_id,
                            amount=excess_amount,
                            source_billing=source_billing_record,
                            created_at__gte=recent_cutoff
                        ).exists()
                        
                        if duplicate_check:
                            print(f"   ⚠️  Duplicate AdvancePayment detected, skipping creation")
                        else:
                            advance = AdvancePayment.objects.create(
                                unit_id=unit_id,
                                resident=resident_member,
                                account_holder_type=account_holder_type,
                                account_holder_id=account_holder_id,
                                advance_type='service_fee_advance',
                                amount=excess_amount,
                                remaining_amount=excess_amount,
                                source_billing=source_billing_record,  # Reference to billing detail (payment detail)
                                payment_method=payment_method_obj,
                                status='available',
                                created_by=created_by,
                                notes=f'Auto-generated {"excess" if created_payments else "advance payment"} from payment on {payment_date}'
                            )
                            advance_payment_created = advance  # Store reference for response
                            print(f"   ✅ AdvancePayment created: ID={advance.id}, Amount={excess_amount}")
                            if source_billing_record:
                                print(f"   📋 Linked to billing detail: {source_billing_record.receipt_id}")
                            
                            # CRITICAL FIX: Create a separate ServiceFeeBilling record for the excess amount
                            # This ensures the Voucher Generator sees this portion of the cash payment
                            if created_payments:
                                try:
                                    pm_to_use = payment_method_obj
                                        
                                    from .models import generate_unique_sequential_id, ServiceFeeBilling
                                    unique_billing_id = f"{generate_unique_sequential_id(ServiceFeeBilling, 'billing_id', f'BILL-{now.year}-{now.month:02d}-', 6)}-ADV"
                                    
                                    # Use the SAME batch transaction/receipt ID for the excess part so it's grouped together
                                    # No new IDs generated here.

                                    excess_billing = ServiceFeeBilling.objects.create(
                                        billing_id=unique_billing_id,
                                        transaction_id=batch_transaction_id,  # Use batch ID
                                        receipt_id=batch_receipt_id,          # Use batch ID
                                        servicefeepaymentid=None,
                                        advance_payment=advance,
                                        payment_method=pm_to_use,
                                        payment_type='advance_payment',
                                        billing_amount=Decimal('0.00'),
                                        total_paid=excess_amount,
                                        payment_date=payment_datetime,
                                        reference_number=reference_number,
                                        notes=f"{notes} - Excess Payment (to Advance)",
                                        created_by=created_by,
                                        received_by=received_by,
                                        received_by_name=received_by_name,
                                        from_account_number=from_account_number,
                                        to_account_number=to_account_number,
                                        to_account_name=to_account_name,
                                        other_method_name=other_method_name,
                                        voucher_id=voucher_id,
                                        payment_account_code=payment_account_code,
                                        payment_account_name=payment_account_name
                                    )
                                    print(f"   ✅ Created distinct ServiceFeeBilling for Excess Amount (ID={excess_billing.id}) linked to {batch_receipt_id}")
                                    
                                    # Update advance sourcing to this specific record
                                    advance.source_billing = excess_billing
                                    advance.save()
                                    
                                    # Generate Voucher for this Excess record using the SAME Receipt ID
                                    v_res = create_payment_voucher(
                                        billing_records=[excess_billing],
                                        total_amount=float(excess_billing.total_paid),
                                        payment_method_id=payment_method,
                                        member=created_by,
                                        unit=unit,
                                        batch_receipt_id=batch_receipt_id, # Use batch ID
                                        notes=f"Excess payment saved as advance - {notes}"
                                    )
                                    if v_res.get('voucher_id'):
                                        excess_billing.voucher_id = v_res.get('voucher_id')
                                        excess_billing.save()
                                except Exception as e:
                                    print(f"   ❌ Failed to create Excess Billing Record: {str(e)}")
                                    raise
                            
                            # Create audit trail for advance payment creation
                            try:
                                advance_audit_data = {
                                    'id': advance.id,
                                    'unit_id': advance.unit_id,
                                    'amount': str(advance.amount),
                                    'remaining_amount': str(advance.remaining_amount),
                                    'advance_type': advance.advance_type,
                                    'status': advance.status,
                                    'account_holder_type': advance.account_holder_type,
                                    'account_holder_id': advance.account_holder_id,
                                    'resident_id': advance.resident.id if advance.resident else None,
                                    'source_billing_id': advance.source_billing.id if advance.source_billing else None,
                                    'created_by': advance.created_by.id if advance.created_by else None,
                                    'notes': advance.notes,
                                    'created_at': str(advance.created_at)
                                }
                                
                                create_audit_trail(
                                    member=created_by,
                                    event_type='ADVANCE_CREATED',
                                    table_name='service_fee_management_advancepayment',
                                    row_id=advance.id,
                                    old_data=None,
                                    new_data=advance_audit_data,
                                    description=f'Advance payment created - Amount: ৳{advance.amount}, Type: {advance.advance_type}, Status: {advance.status}'
                                )
                            except Exception as e:
                                print(f"   ⚠️  Advance payment audit trail failed: {str(e)}")
                    except Exception as e:
                        print(f"   ❌ CRITICAL: Failed to create AdvancePayment: {str(e)}")
                        # Raise exception to trigger rollback of the whole transaction
                        raise ValidationError(f"Payment Processing Error: Could not record advance credit. {str(e)}")
                else:
                    print(f"   ℹ️ No excess amount to convert to advance")
                
                # Send email receipt if enabled
                # Send email receipt if enabled (Async)
                if send_email:
                    print(f"   🚀 Email receipt scheduled for commit: {batch_receipt_id}")
                    transaction.on_commit(lambda: trigger_bulk_payment_receipt_emails([batch_receipt_id]))
                    print(f"   🚀 Email sending offloaded to background thread")
                
                # Prepare success message with excess amount info
                success_message = f'Successfully processed {len(created_payments)} payment(s) for total amount {total_amount}'
                
                # Add information about standalone billing/advance if applicable
                if standalone_billing_created and advance_payment_created:
                    success_message = f'Advance payment of {excess_amount} TK recorded successfully. No bills exist for selected periods - payment saved as advance credit for future bills.'
                elif excess_amount > 0:
                    if len(selected_periods) == 1:
                        # Single month selected - return excess
                        success_message += f'. Excess amount: {excess_amount} (payment was more than due amount)'
                    else:
                        # Multiple months - excess wasn't used (all months processed)
                        success_message += f'. Remaining excess: {excess_amount} (not applied to additional months)'
                
                # Build response data
                response_data = {
                    'payments': [{
                        'id': p.id,
                        'transaction_id': (
                            ServiceFeeBilling.objects.filter(servicefeepaymentid=p)
                            .order_by('-created_at').first().transaction_id
                            if ServiceFeeBilling.objects.filter(servicefeepaymentid=p).exists()
                            else 'N/A'
                        ),
                        'amount': str(p.amount),
                        'service_period_month': p.service_period_month,
                        'service_period_year': p.service_period_year,
                        'payment_status': p.payment_status,
                        'service_status': p.service_status,
                        'penalty_amount': str(p.penalty_amount),
                        'waived_amount': str(p.waived_amount),
                        'gross_penalty_amount': str(p.gross_penalty_amount),
                    } for p in created_payments],
                    'total_amount': str(total_amount),
                    'payment_count': len(created_payments),
                    'excess_amount': str(excess_amount) if excess_amount > 0 else None
                }
                
                # Add standalone billing and advance payment info if created
                if standalone_billing_created:
                    response_data['standalone_billing_created'] = True
                    response_data['billing_record_id'] = advance_payment_created.source_billing.id if advance_payment_created and advance_payment_created.source_billing else None
                    response_data['receipt_id'] = advance_payment_created.source_billing.receipt_id if advance_payment_created and advance_payment_created.source_billing else None
                
                if advance_payment_created:
                    response_data['advance_payment'] = {
                        'id': advance_payment_created.id,
                        'amount': str(advance_payment_created.amount),
                        'remaining_amount': str(advance_payment_created.remaining_amount),
                        'status': advance_payment_created.status,
                        'payment_method': advance_payment_created.payment_method.method_name if advance_payment_created.payment_method else None,
                        'payment_method_id': advance_payment_created.payment_method_id
                    }
                
                # Legacy consolidated voucher block handled unit-wise in loop above.
                
                # Create consolidated payment received notification for admins (all periods + any advance)
                try:
                    from notifications.utils import (
                        create_service_fee_payment_received_notification,
                        create_community_member_payment_confirmation
                    )
                    
                    # Consolidate amount to show TOTAL user payment (Bills + Advance)
                    # total_amount_input refers to the single amount paid at top.
                    # fallback to sum of created_payments
                    consolidated_amount = float(total_amount_input) if total_amount_input and float(total_amount_input) > 0 else float(total_amount)
                    
                    # Pick a representative payment object for context
                    notification_payment = None
                    if created_payments:
                        notification_payment = created_payments[0]
                    elif advance_payment_created:
                        notification_payment = advance_payment_created
                    
                    if notification_payment:
                        # Shared transaction ID for tracking
                        notif_transaction_id = None
                        first_billing = all_billing_records[0] if all_billing_records else None
                        if first_billing:
                            notif_transaction_id = first_billing.id

                        # Determine custom period text for notification
                        # import calendar
                        custom_period_text = None
                        month_count = len(created_payments)
                        has_advance = advance_payment_created is not None
                        
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
                                # Normal single month - utility will handle via payment object
                                pass
                        elif has_advance:
                            custom_period_text = "advance payment"

                        # Get payment method name for notification
                        payment_method_name = payment_method_obj.method_name if payment_method_obj else None
                        
                        # Create consolidated admin notification
                        print(f"[ServiceFeePayment] Creating consolidated payment notification for {consolidated_amount}...")
                        create_service_fee_payment_received_notification(
                            payment=notification_payment,
                            payment_amount=consolidated_amount,
                            payment_method=payment_method_name,
                            recorded_by=created_by,
                            transaction_id=notif_transaction_id,
                            custom_period=custom_period_text
                        )
                        
                        # Create consolidated community member notification
                        create_community_member_payment_confirmation(
                            payment=notification_payment,
                            payment_amount=consolidated_amount,
                            transaction_id=notif_transaction_id,
                            custom_period=custom_period_text
                        )
                        print(f"[ServiceFeePayment] ✅ Consolidated notifications created")
                except Exception as notif_error:
                    # Log but don't fail - notifications are optional
                    print(f"[ServiceFeePayment] Could not create consolidated payment notifications: {notif_error}")
                    import traceback
                    print(traceback.format_exc())
                
                end_time = time.time()
                execution_time = end_time - start_time
                print(f"[MultiMonthPayment] PROCESS COMPLETED in {execution_time:.2f} seconds")

                return Response({
                    'success': True,
                    'message': success_message,
                    'data': response_data
                }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            print(f"\n❌ Multi-month payment error: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error creating multi-month payments: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PenaltyWaiverDetailView(APIView):
    """
    API view to manage a specific penalty waiver record (Update or Delete)
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def patch(self, request, pk):
        # Edit settings permission required for penalty waivers
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            with transaction.atomic():
                waiver = PenaltyWaiver.objects.get(pk=pk)
                
                # Update fields
                data = request.data
                
                # Handle waiver type and calculations
                waiver_type = data.get('waiver_type', waiver.waiver_type)
                partial_type = data.get('partial_type')
                
                if waiver_type == 'partial' and partial_type:
                    waiver_type = f'partial_{partial_type}'
                
                waiver.waiver_type = waiver_type
                
                if 'reason' in data:
                    waiver.reason = data['reason']
                if 'notes' in data:
                    waiver.notes = data['notes']
                if 'waiver_percentage' in data:
                    waiver.percentage = data['waiver_percentage']
                
                waived_amount_val = data.get('waived_amount')
                if waived_amount_val is not None:
                    waiver.waived_amount = Decimal(str(waived_amount_val))
                
                penalty_amount = waiver.penalty_amount
                waiver.penalty_after_waiver = max(Decimal('0.00'), penalty_amount - waiver.waived_amount)
                
                waiver.save()
                
                if waiver.billing:
                    waiver.billing.calculate_totals()
                
                return Response({
                    'success': True,
                    'message': 'Penalty waiver updated successfully',
                    'data': {
                        'id': waiver.id,
                        'waived_amount': str(waiver.waived_amount),
                        'penalty_after_waiver': str(waiver.penalty_after_waiver)
                    }
                })
        except PenaltyWaiver.DoesNotExist:
            return Response({'success': False, 'message': 'Penalty waiver not found'}, status=404)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)

    def delete(self, request, pk):
        # Edit settings permission required for penalty waivers
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            waiver = PenaltyWaiver.objects.get(pk=pk)
            waiver_id = waiver.id
            amount = waiver.waived_amount
            billing = waiver.billing
            
            waiver.delete()
            
            if billing:
                billing.calculate_totals()
            
            return Response({
                'success': True,
                'message': f'Penalty waiver of ৳{amount} deleted successfully',
                'deleted_id': waiver_id
            })
        except PenaltyWaiver.DoesNotExist:
            return Response({'success': False, 'message': 'Penalty waiver not found'}, status=404)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)


class ServiceFeeResidentListView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_PAYMENTS]

    def get(self, request):
        try:
            
            # Detect if request is from mobile app or web
            user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
            is_mobile_request = 'expo' in user_agent or 'react-native' in user_agent or request.query_params.get('source') == 'mobile'
            
            # Get current user's member information for access control
            current_member = None
            user_emails = []
            user_contacts = []
            
            if request.user.is_authenticated:
                try:
                    current_member = Member.objects.get(user=request.user)
                    
                    # Collect all possible email addresses for this user
                    if current_member.general_email:
                        user_emails.append(current_member.general_email)
                    if current_member.login_email:
                        user_emails.append(current_member.login_email)
                    
                    # Collect all possible contact numbers for this user
                    if current_member.general_contact:
                        user_contacts.append(current_member.general_contact)
                    if current_member.login_contact:
                        user_contacts.append(current_member.login_contact)
                    
                    
                    # Check resident status
                    from towers.models import Resident
                    resident_units = Resident.objects.filter(
                        member_id=current_member.id, 
                        is_active=True
                    ).select_related('unit')
                    
                except Member.DoesNotExist:
                    pass
            
            # Query parameters
            tower_id = request.query_params.getlist('tower_id')  # Support multiple tower IDs
            service_period_month = request.query_params.get('service_period_month')
            service_period_year = request.query_params.get('service_period_year')
            service_period_month_from = request.query_params.get('service_period_month_from')
            service_period_year_from = request.query_params.get('service_period_year_from')
            service_period_month_to = request.query_params.get('service_period_month_to')
            service_period_year_to = request.query_params.get('service_period_year_to')
            search = request.query_params.get('search')
            status_filter = request.query_params.getlist('status')  # Support multiple statuses
            payment_method = request.query_params.getlist('payment_method')  # Support multiple methods
            unit_id = request.query_params.get('unit_id')
            resident_id = request.query_params.get('resident_id')
            service_fee_id = request.query_params.get('service_fee_id')
            include_stats = request.query_params.get('stats', 'false').lower() == 'true'
            is_grouped = request.query_params.get('grouped', 'false').lower() == 'true'
            include_payment_details = request.query_params.get('include_payment_details', 'false').lower() == 'true'
            only_paid = request.query_params.get('only_paid', 'false').lower() == 'true'
             
            # DEBUG: Log received parameters
            print(f"\n[ServiceFeeResidentList] Received parameters:")
            print(f"  - service_period_month_from: {service_period_month_from}")
            print(f"  - service_period_year_from: {service_period_year_from}")
            print(f"  - service_period_month_to: {service_period_month_to}")
            print(f"  - service_period_year_to: {service_period_year_to}")
            print(f"  - unit_id: {unit_id}")
            print(f"  - service_fee_id: {service_fee_id}")
            
            # Convert service period parameters to integers if provided
            try:
                if service_period_month:
                    service_period_month = int(service_period_month)
                if service_period_year:
                    service_period_year = int(service_period_year)
                if service_period_month_from:
                    service_period_month_from = int(service_period_month_from)
                if service_period_year_from:
                    service_period_year_from = int(service_period_year_from)
                if service_period_month_to:
                    service_period_month_to = int(service_period_month_to)
                if service_period_year_to:
                    service_period_year_to = int(service_period_year_to)
                    
                print(f"[ServiceFeeResidentList] After conversion to int:")
                print(f"  - service_period_month_from: {service_period_month_from} (type: {type(service_period_month_from).__name__})")
                print(f"  - service_period_year_from: {service_period_year_from} (type: {type(service_period_year_from).__name__})")
                print(f"  - service_period_month_to: {service_period_month_to} (type: {type(service_period_month_to).__name__})")
                print(f"  - service_period_year_to: {service_period_year_to} (type: {type(service_period_year_to).__name__})")
                
            except (ValueError, TypeError) as e:
                return Response({
                    'success': False,
                    'message': f'Invalid service period parameter format: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate date range if both from and to are provided
            if service_period_year_from and service_period_year_to and service_period_month_from and service_period_month_to:
                # Validate month values (1-12)
                if not (1 <= service_period_month_from <= 12) or not (1 <= service_period_month_to <= 12):
                    return Response({
                        'success': False,
                        'message': 'Service period months must be between 1 and 12'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Validate date range (start <= end)
                start_date = datetime(service_period_year_from, service_period_month_from, 1)
                end_date = datetime(service_period_year_to, service_period_month_to, 1)
                if start_date > end_date:
                    return Response({
                        'success': False,
                        'message': 'Service period start date must be before or equal to end date'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
            # Validate single month/year if provided
            if service_period_month and not (1 <= service_period_month <= 12):
                return Response({
                    'success': False,
                    'message': 'Service period month must be between 1 and 12'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            
            # TEMPORARY: Return simple test response to isolate the issue
            if request.query_params.get('test') == 'true':
                return Response({
                    'success': True,
                    'message': 'Test endpoint working',
                    'data': {
                        'payments': [],
                        'total_count': 0,
                        'test_params': {
                            'service_period_month': service_period_month,
                            'service_period_year': service_period_year,
                            'include_stats': include_stats
                        }
                    }
                }, status=200)



            # Base conditions: include Service Fee Payment existence
            # Use `sfp` (service fee payment) alias to match both full and simplified queries
            where_conditions = ["sfp.id IS NOT NULL"]
            include_inactive = request.query_params.get('include_inactive', 'false').lower() == 'true'
            # (Note: is_active filter removed as per user request to avoid unstable table joins)
            sql_params = []
            
            # NOTE: Contact number filtering removed - access now based on Owner/Resident relationship
            # Mobile users no longer need to match primary/secondary contact to see service fees
            
            # Filter by user's access - different logic for mobile vs web:
            # Mobile: Only community members can access (strict resident + contact check)
            # Web: Both org and comm members can access
            if current_member:
                print(f"[ACCESS CONTROL] User: {current_member.user.username}, Emails: {user_emails}, Contacts: {user_contacts}")
                if is_mobile_request:
                    # MOBILE APP: Allow community members (including those who are both org and comm)
                    # Only deny if user is ONLY org member (not a comm member)
                    if current_member.is_org_member and not current_member.is_comm_member:
                        return Response({
                            'success': False,
                            'message': 'Mobile app access is only available for community members',
                            'data': {'payments': [], 'total_count': 0}
                        }, status=200)
                    else:
                        member_type = "BOTH ORG & COMM MEMBER" if (current_member.is_org_member and current_member.is_comm_member) else "COMM MEMBER"
                        # For community members on mobile: They must be Owner OR active Resident of the unit
                        # New logic: Access based on Owner/Resident relationship, not contact matching
                        
                        owner_resident_condition = """(
                            EXISTS (SELECT 1 FROM towers_owner o WHERE o.unit_id = u.id AND o.member_id = %s)
                            OR
                            EXISTS (SELECT 1 FROM towers_resident r WHERE r.unit_id = u.id AND r.member_id = %s AND r.is_active = TRUE)
                        )"""
                        sql_params.append(current_member.id)
                        sql_params.append(current_member.id)
                        where_conditions.append(owner_resident_condition)
                        print(f"[ACCESS CONTROL - MOBILE] Applied Owner/Resident-based access control for member_id: {current_member.id}")
                else:
                    # WEB APP: Allow both org and comm members
                    # If user is org member (even if also comm member), show all data
                    if current_member.is_org_member:
                        member_type = "BOTH ORG & COMM MEMBER" if current_member.is_comm_member else "ORG MEMBER"
                    else:
                        # For community members on web: They must be Owner OR active Resident of the unit
                        # New logic: Access based on Owner/Resident relationship, not contact matching
                        
                        owner_resident_condition = """(
                            EXISTS (SELECT 1 FROM towers_owner o WHERE o.unit_id = u.id AND o.member_id = %s)
                            OR
                            EXISTS (SELECT 1 FROM towers_resident r WHERE r.unit_id = u.id AND r.member_id = %s AND r.is_active = TRUE)
                        )"""
                        sql_params.append(current_member.id)
                        sql_params.append(current_member.id)
                        where_conditions.append(owner_resident_condition)
                        print(f"[ACCESS CONTROL - WEB] Applied Owner/Resident-based access control for member_id: {current_member.id}")

            # Helper function to parse comma-separated values or lists
            def parse_filter_values(value):
                if not value:
                    return []
                # If it's already a list (from getlist()), return it
                if isinstance(value, list):
                    return [str(v).strip() for v in value if str(v).strip()]
                # If it's a string, split by comma
                if isinstance(value, str):
                    return [v.strip() for v in value.split(',') if v.strip()]
                return [str(value)]  # Single value, convert to list

          
         
          
                
            # if service_period_month_from and service_period_year_from and service_period_month_to and service_period_year_to:
                # Validate date range
                # start_date = datetime(int(service_period_year_from), int(service_period_month_from), 1)
                # end_date = datetime(int(service_period_year_to), int(service_period_month_to), 1)
                # if start_date > end_date:
                #     return Response({
                #         'success': False,
                #         'message': 'Invalid service period range: From date must be earlier than To date.',
                #         'data': {
                #             'payments': [],
                #             'total_count': 0
                #         }
                #     }, status=status.HTTP_400_BAD_REQUEST)



                # Use month range - build the date comparison condition
                # service_period_str = f"'{service_period_year_from}-{service_period_month_from.zfill(2)}' >= DATE_FORMAT(sf.service_fee_date, '%%Y-%%m')"
                # where_conditions.append(service_period_str)
                # Filter payment records within the range
                # service_period_condition = f"""
                    
                #     ((sfp.service_period_year > %s) OR 
                #      (sfp.service_period_year = %s AND sfp.service_period_month >= %s)) AND
                #     ((sfp.service_period_year < %s) OR 
                #      (sfp.service_period_year = %s AND sfp.service_period_month <= %s))
                # """
                # # Add parameters in order: year_from, year_from, month_from, year_to, year_to, month_to
                # service_period_params = [
                #     service_period_year_from, service_period_year_from, service_period_month_from, 
                #     service_period_year_to, service_period_year_to, service_period_month_to
                # ]
            # elif service_period_month and service_period_year:
            #     # Use single period
            #     service_period_str = f"'{service_period_year}-{service_period_month.zfill(2)}' >= DATE_FORMAT(sf.service_fee_date, '%%Y-%%m') AND '{service_period_year}-{service_period_month.zfill(2)}' <= DATE_FORMAT(CURDATE(), '%%Y-%%m')"
            #     where_conditions.append(service_period_str)
            #     # Filter payment records for specific month
            #     service_period_condition = f"""
                   
            #         (sfp.service_period_month = %s OR %s IS NULL) AND
            #         (sfp.service_period_year = %s OR %s IS NULL)
            #     """
            #     service_period_params = [service_period_month, service_period_month, service_period_year, service_period_year]
            # else:
            #     # No service period filtering
            #     service_period_condition = "1=1"
            #     service_period_params = []

            # Add service period filtering to WHERE clause
            if service_period_month_from and service_period_year_from and service_period_month_to and service_period_year_to:
                # Date range: FROM (year_from, month_from) TO (year_to, month_to)
                # Condition: payment.date >= FROM AND payment.date <= TO
                where_conditions.append("""
                    ((sfp.service_period_year > %s) OR 
                     (sfp.service_period_year = %s AND sfp.service_period_month >= %s)) AND
                    ((sfp.service_period_year < %s) OR 
                     (sfp.service_period_year = %s AND sfp.service_period_month <= %s))
                """)
                sql_params.extend([
                    service_period_year_from, service_period_year_from, service_period_month_from,
                    service_period_year_to, service_period_year_to, service_period_month_to
                ])
            elif service_period_month and service_period_year:
                where_conditions.append("sfp.service_period_month = %s AND sfp.service_period_year = %s")
                sql_params.extend([service_period_month, service_period_year])

            # Handle multiple tower IDs
            tower_ids = parse_filter_values(tower_id)
            if tower_ids:
                placeholders = ','.join(['%s'] * len(tower_ids))
                where_conditions.append(f"t.id IN ({placeholders})")
                sql_params.extend(tower_ids)

            if unit_id:
                where_conditions.append("u.id = %s")
                sql_params.append(unit_id)

            # if resident_id:
            #     where_conditions.append("r.id = %s")
            #     sql_params.append(resident_id)

            if service_fee_id:
                where_conditions.append("sfp.service_fee_id = %s")
                sql_params.append(service_fee_id)

            # Handle multiple statuses
            status_values = parse_filter_values(status_filter)
            if status_values:
                placeholders = ','.join(['%s'] * len(status_values))
                # where_conditions.append(f"sfp.service_status IN ({placeholders})")
                # sql_params.extend(status_values)
                where_conditions.append(f"""
                    sfp.service_status IN ({placeholders})
                """)
                sql_params.extend(status_values) 

            # Handle multiple payment methods
            payment_method_values = parse_filter_values(payment_method)
            if payment_method_values:
                placeholders = ','.join(['%s'] * len(payment_method_values))
                where_conditions.append(f"""
                    EXISTS (
                        SELECT 1 FROM service_fee_payment_details sfpd_filter 
                        WHERE sfpd_filter.servicefeepaymentid_id = sfp.id 
                        AND sfpd_filter.payment_method_id IN ({placeholders})
                    )
                """)
                sql_params.extend(payment_method_values)

            if search:
                where_conditions.append("""
                    ( 
                     u.unit_name LIKE %s OR 
                     u.primary_name LIKE %s OR 
                     u.primary_number LIKE %s OR
                     u.primary_email LIKE %s OR
                     u.secondary_name LIKE %s OR
                     u.secondary_number LIKE %s OR
                     u.secondary_email LIKE %s OR               
                     t.tower_name LIKE %s OR
                     sfp.bill_number LIKE %s)
                """)
                search_param = f"%{search}%"
                sql_params.extend([search_param] * 9)

            where_clause = " AND ".join(where_conditions)
            # groupby_clause = """ GROUP BY  sfp.id, u.id, sf.id, t.id """ 
     
            if only_paid:
                only_paid_show = " AND sfp.total_paid > 0"
            else:   
                only_paid_show = ""
            # where_clause += {'AND sfpd.id IS NOT NULL' if only_paid else ''}   
            # Combine all parameters in the correct order
            # all_params = /*service_period_params +*/ sql_params
            all_params =  sql_params
            
            # Determine the year range for months CTE
            # Default to current year if no service period specified
            current_date = datetime.now()
            current_year = current_date.year
            current_month = current_date.month

            # Initialize variables to avoid UnboundLocalError
            start_year = None
            end_year = None
            start_month = None
            end_month = None

            if service_period_year_from and service_period_year_to:
                start_year = service_period_year_from
                end_year = service_period_year_to
            elif service_period_year:
                start_year = service_period_year
                end_year = service_period_year
            else:
                start_year = current_year
                end_year = current_year
            
            # Build the months CTE based on the service period range
            if service_period_month_from and service_period_month_to:
                start_month = service_period_month_from
                end_month = service_period_month_to
            elif service_period_month:
                start_month = service_period_month
                end_month = service_period_month
            else:
                # Default to current month + next month (2 months) for upcoming payment display
                start_month = current_month
                # Calculate next month, handle year rollover
                next_month = current_month + 1
                if next_month > 12:
                    end_month = 1
                    end_year = current_year + 1
                else:
                    end_month = next_month
            
          
            # Build SQL query conditionally based on include_payment_details parameter
            # print("Include payment details:", include_payment_details)
            if include_payment_details:
                # Full query with payment details - show each transaction individually
                sql = f"""
                SELECT 
                    DATE_FORMAT(
                        CONCAT(
                            LPAD(sfp.service_period_year, 4, '0'), '-',
                            LPAD(sfp.service_period_month, 2, '0'), '-01'
                        ), 
                        '%%Y-%%m-01'
                    ) AS service_month,
                    u.id AS unit_id,
                    sfp.bill_number AS id,

                    sfp.account_holder_type,
                    sfp.account_holder_id,
                    sfp.bill_number,

                    u.unit_name,
                    u.unit_name AS unit_display,
                    t.tower_name,
                    t.tower_number AS tower_id,
                    
                    /* Owner fields from ServiceFeePayment table (Source of Truth) */
                    sfp.owner_id,
                    sfp.owner_name,
                    sfp.owner_email,
                    sfp.owner_phone,
                    
                    /* Backward compatibility aliases */
                    sfp.owner_name AS resident_name,
                    sfp.owner_name AS primary_name,
                    sfp.owner_email AS resident_email,
                    sfp.owner_email AS primary_email,
                    sfp.owner_phone AS resident_number,
                    sfp.owner_phone AS primary_number,

                    sfp.service_fee_id,
                    sfp.late_penalty_enabled AS is_late_penalty_enabled,
                    
                    /* Calculate penalty percentage if enabled */
                    CASE 
                        WHEN sfp.late_penalty_enabled = 1 THEN 
                            COALESCE(lpt_snapshot.penalty_percentage, 0)
                        ELSE 0 
                    END AS penalty_percentage,
                    
                    /* Penalty amount for this transaction detail (Source: servicefeepayment) */
                    CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,
                    
                    /* Waived amount for this transaction (Source: servicefeepayment) */
                    CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                    
                    /* Total balance across all unpaid periods (if needed by UI) */
                    COALESCE(unpaid_agg.total_unpaid, 0) AS total_balance,
                    
                    /* Advance tracking */
                    COALESCE(applied_agg.total_advance_applied, 0) AS advance_applied,
                    COALESCE(generated_agg.total_advance_generated, 0) AS advance_generated,
                    COALESCE(advance_pool_agg.total_advance, 0) AS unit_total_advance,
                    COALESCE(advance_pool_agg.total_advance, 0) AS advance_balance,
                    
                    CAST(sfp.base_service_amount AS CHAR) AS original_amount,
                    CAST(sfp.base_service_amount AS CHAR) AS fee_amount,
                    CAST(sfp.base_service_amount AS CHAR) AS service_fee_amount,
                    DAY(sfp.due_date) AS due_day,
                    sfp.due_date AS due_date,
                    sfp.service_period_month,
                    sfp.service_period_year,
                    'Monthly' AS frequency,
                    
                    sfp.id AS payment_id,
                    sfp.id AS billing_pk, -- Consolidated PK
                    
                    sfpd.total_paid AS paid_amount,
                    CAST(COALESCE(payment_agg.total_paid_amount, 0) AS CHAR) AS total_paid_all_transactions,
                    -- Display amount to pay
                    CAST(
                        CASE 
                            WHEN sfp.service_status = 'paid' THEN sfp.amount
                            ELSE sfp.remaining_amount
                        END 
                    AS CHAR) AS amount,
                    CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                    CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                    
                    -- Transaction summary details (Aggregated)
                    (SELECT method_name FROM service_fee_payment_methods spm 
                     JOIN service_fee_payment_details spd_name ON spd_name.payment_method_id = spm.id 
                     WHERE spd_name.servicefeepaymentid_id = sfp.id LIMIT 1) AS payment_method,
                    (SELECT MAX(payment_date) FROM service_fee_payment_details spd_date 
                     WHERE spd_date.servicefeepaymentid_id = sfp.id) AS payment_date,
                    NULL AS notes,
                    sfp.service_status,
               
                    COALESCE(m.full_name, 'System') AS created_by_name,
                    COALESCE(payment_agg.payment_details, JSON_ARRAY()) AS payment_details,
                    
                    /* Service fee items breakdown (Full details) */
                    COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items

                FROM service_fee_management_servicefeegenerate sfp
                INNER JOIN towers_unit u ON sfp.unit_id = u.id
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                LEFT JOIN user_member m ON sfp.created_by_id = m.id
                
                -- Pre-aggregated payment details (Full History)
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', spd.id,
                                'billing_id', spd.billing_id,
                                'transaction_id', spd.transaction_id,
                                'receipt_id', spd.receipt_id,
                                'payment_date', DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'payment_method', COALESCE(pm.method_name, spd.other_method_name, 'N/A'),
                                'amount_paid', CAST(spd.total_paid AS CHAR),
                                'reference_number', spd.reference_number,
                                'payment_type', spd.payment_type,
                                'notes', spd.notes,
                                'received_by_id', spd.received_by_id,
                                'received_by_name', COALESCE(m_rec.full_name, spd.received_by_name, 'System'),
                                'to_account_name', spd.to_account_name,
                                'to_account_number', spd.to_account_number,
                                'voucher_id', spd.voucher_id,
                                'payment_account_code', spd.payment_account_code,
                                'payment_account_name', spd.payment_account_name
                            )
                        ) as payment_details,
                        SUM(spd.total_paid) as total_paid_amount
                    FROM service_fee_payment_details spd
                    LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
                    LEFT JOIN user_member m_rec ON spd.received_by_id = m_rec.id
                    GROUP BY spd.servicefeepaymentid_id
                ) payment_agg ON payment_agg.servicefeepaymentid_id = sfp.id
                
                -- Get ACTIVE penalty tier from snapshot table
                LEFT JOIN (
                    SELECT payment_id, penalty_percentage
                    FROM service_fee_management_servicefeepaymentlatepenaltytier
                    WHERE status = 'active'
                ) lpt_snapshot ON sfp.id = lpt_snapshot.payment_id
                
                -- Pre-aggregated service fee items (Full Details matching simplified view)
                LEFT JOIN (
                    SELECT 
                        sfi.service_fee_payment_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sfi.id,
                                'item_type', sfi.item_type,
                                'item_name', sfi.item_name,
                                'amount', CAST(sfi.amount AS CHAR),
                                'description', sfi.description,
                                'bill_category_id', sfi.bill_category_id,
                                'bill_category_name', sfi.item_name,
                                'bill_upload_id', bud.bill_upload_id,
                                'upload_month', bud.upload_month,
                                'upload_year', bud.upload_year,
                                'previous_reading', CAST(bud.previous_reading AS CHAR),
                                'current_reading', CAST(bud.current_reading AS CHAR),
                                'consumption', CAST(bud.consumption AS CHAR),
                                'unit_of_measurement', bud.unit_of_measurement,
                                'price_per_unit', CAST(bud.price_per_unit AS CHAR),
                                'bill_detail_amount', CAST(bud.amount AS CHAR),
                                'penalty_tier_id', sfi.penalty_tier_id,
                                'tier_name', lpt.tier_name,
                                'tier_percentage', lpt.penalty_percentage,
                                'tier_days_overdue', lpt.days_overdue
                            )
                        ) as item_details
                    FROM service_fee_management_servicefeeitem sfi
                    LEFT JOIN service_fee_management_servicefeepaymentlatepenaltytier lpt 
                        ON sfi.penalty_tier_id = lpt.id AND lpt.status = 'active'
                    LEFT JOIN bill_upload_details bud 
                        ON sfi.bill_upload_detail_id = bud.id
                    GROUP BY sfi.service_fee_payment_id
                ) item_agg ON item_agg.service_fee_payment_id = sfp.id
                
                -- Pre-aggregated unit advance
                LEFT JOIN (
                    SELECT 
                        unit_id,
                        account_holder_type,
                        account_holder_id,
                        SUM(remaining_amount) as total_advance
                    FROM service_fee_advance_payments
                    WHERE status IN ('available', 'partial')
                    GROUP BY unit_id, account_holder_type, account_holder_id
                ) advance_pool_agg ON 
                    advance_pool_agg.unit_id = sfp.unit_id AND 
                    advance_pool_agg.account_holder_type COLLATE utf8mb4_general_ci = sfp.account_holder_type COLLATE utf8mb4_general_ci AND 
                    advance_pool_agg.account_holder_id = sfp.account_holder_id

                -- Service balance across all unpaid periods
                LEFT JOIN (
                    SELECT 
                        unit_id,
                        service_fee_id,
                        account_holder_type,
                        account_holder_id,
                        SUM(remaining_amount) as total_unpaid
                    FROM service_fee_management_servicefeegenerate
                    WHERE service_status != 'paid'
                    GROUP BY unit_id, service_fee_id, account_holder_type, account_holder_id
                ) unpaid_agg ON 
                    unpaid_agg.unit_id = sfp.unit_id AND 
                    unpaid_agg.service_fee_id = sfp.service_fee_id AND 
                    unpaid_agg.account_holder_type COLLATE utf8mb4_general_ci = sfp.account_holder_type COLLATE utf8mb4_general_ci AND 
                    unpaid_agg.account_holder_id = sfp.account_holder_id

                -- Pre-aggregated Advance Applied (Usage)
                LEFT JOIN (
                    SELECT 
                        spa.service_fee_payment_id,
                        SUM(spa.allocated_amount) as total_advance_applied
                    FROM service_fee_payment_allocations spa
                    WHERE spa.allocation_type = 'advance'
                    GROUP BY spa.service_fee_payment_id
                ) applied_agg ON applied_agg.service_fee_payment_id = sfp.id
                
                -- Pre-aggregated Advance Generated (Excess)
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        SUM(ap.amount) as total_advance_generated
                    FROM service_fee_payment_details spd
                    INNER JOIN service_fee_advance_payments ap ON ap.source_billing_id = spd.id
                    GROUP BY spd.servicefeepaymentid_id
                ) generated_agg ON generated_agg.servicefeepaymentid_id = sfp.id

                WHERE {where_clause} {only_paid_show}  
                GROUP BY sfp.id
                ORDER BY sfp.service_period_year DESC, sfp.service_period_month DESC

                """
                  # print("Generated SQL:", sql, sql_params)
            else:
                # Simplified query without payment details - build separate WHERE conditions
                simple_where_conditions = []
                simple_params = []

                include_inactive = request.query_params.get('include_inactive', 'false').lower() == 'true'
                # (Note: is_active filter removed as per user request)
                
                # NOTE: Contact number filtering removed - access now based on Owner/Resident relationship
                # Add user access control for simplified query (same as main query)
                if current_member and is_mobile_request:
                    # For community members on mobile: They must be Owner OR active Resident of the unit
                    # New logic: Access based on Owner/Resident relationship, not contact matching
                    
                    owner_resident_condition = """(
                        EXISTS (SELECT 1 FROM towers_owner o WHERE o.unit_id = u.id AND o.member_id = %s)
                        OR
                        EXISTS (SELECT 1 FROM towers_resident r WHERE r.unit_id = u.id AND r.member_id = %s AND r.is_active = TRUE)
                    )"""
                    simple_params.append(current_member.id)
                    simple_params.append(current_member.id)
                    simple_where_conditions.append(owner_resident_condition)
                    print(f"[ACCESS CONTROL - SIMPLIFIED] Applied Owner/Resident-based access control for member_id: {current_member.id}")
                
                # Add tower filter for simplified query
                if tower_ids:
                    placeholders = ','.join(['%s'] * len(tower_ids))
                    simple_where_conditions.append(f"t.id IN ({placeholders})")
                    simple_params.extend(tower_ids)
                
                # Add unit filter for simplified query
                if unit_id:
                    simple_where_conditions.append(f"u.id = %s")
                    simple_params.append(unit_id)

                # Add service fee ID filter for simplified query
                if service_fee_id:
                    simple_where_conditions.append("sfp.service_fee_id = %s")
                    simple_params.append(service_fee_id)
           
                # Add service period date range filtering for simplified query
                if service_period_month_from and service_period_year_from and service_period_month_to and service_period_year_to:
                    # Date range: FROM (year_from, month_from) TO (year_to, month_to)
                    simple_where_conditions.append("""
                        ((sfp.service_period_year > %s) OR 
                         (sfp.service_period_year = %s AND sfp.service_period_month >= %s)) AND
                        ((sfp.service_period_year < %s) OR 
                         (sfp.service_period_year = %s AND sfp.service_period_month <= %s))
                    """)
                    simple_params.extend([
                        service_period_year_from, service_period_year_from, service_period_month_from,
                        service_period_year_to, service_period_year_to, service_period_month_to
                    ])
                    print(f"   [DEBUG] Date range filter added: {service_period_month_from}/{service_period_year_from} TO {service_period_month_to}/{service_period_year_to}")
                elif service_period_month and service_period_year:
                    simple_where_conditions.append("sfp.service_period_month = %s AND sfp.service_period_year = %s")
                    simple_params.extend([service_period_month, service_period_year])
                    print(f"   [DEBUG] Single month filter added: {service_period_month}/{service_period_year}")

                # Parse status filter values before using them
                status_values = parse_filter_values(status_filter)
                
                # Add status filter for simplified query (only if status_values is not empty)
                if status_values:
                    status_placeholders = ",".join(['%s'] * len(status_values))
                    simple_where_conditions.append(f"""
                    sfp.service_status IN ({status_placeholders})
                     """
                     )
                    simple_params.extend(status_values)

                if search:
                    simple_where_conditions.append("""
                        (u.unit_name LIKE %s OR 
                         u.primary_name LIKE %s OR 
                         u.primary_number LIKE %s OR
                         u.primary_email LIKE %s OR
                         u.secondary_name LIKE %s OR
                         u.secondary_number LIKE %s OR
                         u.secondary_email LIKE %s OR               
                         t.tower_name LIKE %s)
                    """)
                    search_param = f"%{search}%"
                    simple_params.extend([search_param] * 8)
                
                # Add service fee status filtering
                # Note: We'll use HAVING clause since service_status is a calculated field
                # status_values is already defined above, so we don't need to redefine it
                having_conditions = []
                
                simple_where_clause = " AND ".join(simple_where_conditions)
                
                # Build WHERE clause
                where_clause = simple_where_clause if simple_where_clause else "1=1"
                
                sql = f"""
                SELECT 
                   
                   DATE_FORMAT(
                        CONCAT(
                            LPAD(sfp.service_period_year, 4, '0'), '-',
                            LPAD(sfp.service_period_month, 2, '0'), '-01'
                        ), 
                        '%%Y-%%m-01'
                    ) AS service_month,
                    u.id AS unit_id,
                    sfp.bill_number AS id,

                    sfp.account_holder_type,
                    sfp.account_holder_id,
                    sfp.bill_number,

                    u.unit_name,
                    u.unit_name AS unit_display,
                    
                    /* Owner fields from ServiceFeePayment table (Source of Truth) */
                    sfp.owner_id,
                    sfp.owner_name,
                    sfp.owner_email,
                    sfp.owner_phone,
                    
                    /* Backward compatibility aliases */
                    sfp.owner_name AS resident_name,
                    sfp.owner_name AS primary_name,
                    sfp.owner_email AS resident_email,
                    sfp.owner_email AS primary_email,
                    sfp.owner_phone AS resident_number,
                    sfp.owner_phone AS primary_number,

                    t.tower_name,
                    t.tower_number AS tower_id,
                    
                    sfp.service_fee_id,
                    sfp.late_penalty_enabled AS is_late_penalty_enabled,
                    
                    /* Calculate penalty percentage if enabled */
                    CASE 
                        WHEN sfp.late_penalty_enabled = 1 THEN 
                            COALESCE(lpt_snapshot.penalty_percentage, lpt_global.penalty_percentage, 0)
                        ELSE 0 
                    END AS penalty_percentage,
                    
                    /* Penalty amount from table (already calculated and updated) */
                    CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,

                    /* Total paid amount towards this bill */
                    CAST(sfp.total_paid AS CHAR) AS total_paid_amount,
                    CAST(sfp.total_paid AS CHAR) AS paid_amount,
                    
                    /* Advance tracking per billing record */
                    COALESCE(applied_agg.total_advance_applied, 0) AS advance_applied,
                    COALESCE(generated_agg.total_advance_generated, 0) AS advance_generated,
                    
                    /* Monthly impact for UI breakdown */
                    CASE 
                        WHEN COALESCE(applied_agg.total_advance_applied, 0) > 0 THEN COALESCE(applied_agg.total_advance_applied, 0)
                        WHEN COALESCE(generated_agg.total_advance_generated, 0) > 0 THEN COALESCE(generated_agg.total_advance_generated, 0)
                        ELSE 0
                    END AS advance_amount,
                    
                    /* Available pool for the unit */
                    COALESCE(advance_pool_agg.total_advance, 0) AS unit_total_advance,
                    COALESCE(advance_pool_agg.total_advance, 0) AS advance_balance,
                    
                    /* Waived amount from table */
                    CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                    
                    CAST(sfp.base_service_amount AS CHAR) AS original_amount,
                    CAST(sfp.base_service_amount AS CHAR) AS fee_amount,
                    CAST(sfp.base_service_amount AS CHAR) AS service_fee_amount,
                    CAST(sfp.additional_bill_charges AS CHAR) AS additional_bill_charges,
                    CAST(sfp.additional_bill_charges AS CHAR) AS gas_fee,
                    
                    DAY(sfp.due_date) AS due_day,
                    sfp.due_date AS due_date,
                    sfp.service_period_month,
                    sfp.service_period_year,
                    'Monthly' AS frequency,
                    
                    sfp.id AS payment_id,
                    
                    -- Total paid amount across all transactions
                    CAST(COALESCE(payment_agg.total_paid_amount, 0) AS CHAR) AS paid_amount,
                    
                    -- For unpaid/partial: show remaining amount. For paid: show original total amount
                    -- This ensures mobile app displays correct amount to pay after partial payments
                    CAST(
                        CASE 
                            WHEN sfp.service_status = 'paid' THEN sfp.amount
                            ELSE sfp.remaining_amount
                        END 
                    AS CHAR) AS amount,
                    
                    -- Calculate remaining_amount dynamically (Source: table)
                    CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                    CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                    
                    -- Get latest payment details from pre-aggregated subquery
                    COALESCE(payment_agg.latest_payment_method, 'N/A') AS payment_method,
                    COALESCE(payment_agg.latest_payment_date, sfp.due_date) AS payment_date,
                    COALESCE(payment_agg.latest_notes, '') AS notes,
                    
                    -- Status directly from DB (update_penalty_tiers cron maintains this)
                    sfp.service_status,
               
                    COALESCE(m.full_name, 'System') AS created_by_name,
                    
                    /* Service fee items breakdown */
                    COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items
                   
                FROM service_fee_management_servicefeegenerate sfp
                INNER JOIN towers_unit u ON sfp.unit_id = u.id
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                LEFT JOIN user_member m ON sfp.created_by_id = m.id
                
                -- Pre-aggregated payment info (latest only for bills)
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        MAX(pm.method_name) as latest_payment_method,
                        MAX(spd.payment_date) as latest_payment_date,
                        MAX(spd.notes) as latest_notes,
                        SUM(spd.total_paid) as total_paid_amount
                    FROM service_fee_payment_details spd
                    LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
                    GROUP BY spd.servicefeepaymentid_id
                ) payment_agg ON payment_agg.servicefeepaymentid_id = sfp.id
                


                /* Pre-aggregated Advance Applied (Usage for this month) */
                LEFT JOIN (
                    SELECT 
                        spa.service_fee_payment_id,
                        SUM(spa.allocated_amount) as total_advance_applied
                    FROM service_fee_payment_allocations spa
                    WHERE spa.allocation_type = 'advance'
                    GROUP BY spa.service_fee_payment_id
                ) applied_agg ON applied_agg.service_fee_payment_id = sfp.id
                
                /* Pre-aggregated Advance Generated (Excess from this month) */
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        SUM(ap.amount) as total_advance_generated
                    FROM service_fee_payment_details spd
                    INNER JOIN service_fee_advance_payments ap ON ap.source_billing_id = spd.id
                    GROUP BY spd.servicefeepaymentid_id
                ) generated_agg ON generated_agg.servicefeepaymentid_id = sfp.id
                
                -- Get ACTIVE penalty tier from snapshot table (status='active')
                LEFT JOIN (
                    SELECT payment_id, penalty_percentage
                    FROM service_fee_management_servicefeepaymentlatepenaltytier
                    WHERE status = 'active'
                ) lpt_snapshot ON sfp.id = lpt_snapshot.payment_id
                
                -- Fallback to global penalty tier if no snapshot
                LEFT JOIN (
                    SELECT service_fee_id, MAX(penalty_percentage) as penalty_percentage
                    FROM service_fee_latepenaltytier
                    GROUP BY service_fee_id
                ) lpt_global ON sfp.service_fee_id = lpt_global.service_fee_id
                
                -- Pre-aggregated service fee items
                LEFT JOIN (
                    SELECT 
                        sfi.service_fee_payment_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sfi.id,
                                'item_type', sfi.item_type,
                                'item_name', sfi.item_name,
                                'amount', CAST(sfi.amount AS CHAR),
                                'description', sfi.description,
                                'bill_category_id', sfi.bill_category_id,
                                'bill_category_name', sfi.item_name,
                                'bill_upload_id', bud.bill_upload_id,
                                'upload_month', bud.upload_month,
                                'upload_year', bud.upload_year,
                                'previous_reading', CAST(bud.previous_reading AS CHAR),
                                'current_reading', CAST(bud.current_reading AS CHAR),
                                'consumption', CAST(bud.consumption AS CHAR),
                                'unit_of_measurement', bud.unit_of_measurement,
                                'price_per_unit', CAST(bud.price_per_unit AS CHAR),
                                'bill_detail_amount', CAST(bud.amount AS CHAR),
                                'penalty_tier_id', sfi.penalty_tier_id,
                                'tier_name', lpt.tier_name,
                                'tier_percentage', lpt.penalty_percentage,
                                'tier_days_overdue', lpt.days_overdue
                            )
                        ) as item_details
                    FROM service_fee_management_servicefeeitem sfi
                    LEFT JOIN service_fee_management_servicefeepaymentlatepenaltytier lpt 
                        ON sfi.penalty_tier_id = lpt.id AND lpt.status = 'active'
                    LEFT JOIN bill_upload_details bud 
                        ON sfi.bill_upload_detail_id = bud.id
                    GROUP BY sfi.service_fee_payment_id
                ) item_agg ON item_agg.service_fee_payment_id = sfp.id
                
                -- Pre-aggregated unit advance (Pool)
                LEFT JOIN (
                    SELECT 
                        unit_id,
                        account_holder_type,
                        account_holder_id,
                        SUM(remaining_amount) as total_advance
                    FROM service_fee_advance_payments
                    WHERE status IN ('available', 'partial')
                    GROUP BY unit_id, account_holder_type, account_holder_id
                ) advance_pool_agg ON 
                    advance_pool_agg.unit_id = sfp.unit_id AND 
                    advance_pool_agg.account_holder_type COLLATE utf8mb4_general_ci = sfp.account_holder_type COLLATE utf8mb4_general_ci AND 
                    advance_pool_agg.account_holder_id = sfp.account_holder_id

                WHERE
                    {where_clause}
                ORDER BY sfp.service_period_year DESC, sfp.service_period_month DESC
                    
                """
                # print(sql)
            # Ensure CTE parameters are integers and not None
            try:
                if start_year is None or start_month is None or end_year is None or end_month is None:
                    raise ValueError(f"Date parameters are None: start_year={start_year}, start_month={start_month}, end_year={end_year}, end_month={end_month}")
                
                start_year = int(start_year)
                start_month = int(start_month)
                end_year = int(end_year)
                end_month = int(end_month)
                
                # Validate month range
                if not (1 <= start_month <= 12) or not (1 <= end_month <= 12):
                    raise ValueError(f"Invalid month values: start_month={start_month}, end_month={end_month}. Must be between 1 and 12.")
                
            except (ValueError, TypeError) as e:
                return Response({
                    'success': False,
                    'message': f'Invalid date parameters for query: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Prepend CTE parameters to the parameter list - NO LONGER NEEDED, queries don't use CTE
            # cte_params = [start_year, start_month, end_year, end_month]
            # all_params = cte_params + all_params
            
            # Add parameters for the simplified query (no more month/year date filtering from service_fee_date)
            if not include_payment_details:
                # Parameters are just simple_params (no more date filter parameters needed)
                all_params = simple_params 
            else:
                all_params = sql_params
       
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql, all_params)
                    columns = [col[0] for col in cursor.description]
                    raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
            except Exception as sql_error:
                import traceback
                error_details = traceback.format_exc()
                print(f"\n❌ Query Error: {str(sql_error)}")
                print(f"Error Details:\n{error_details}")
                print("="*80 + "\n")
                return Response({
                    'success': False,
                    'message': f'Database query error: {str(sql_error)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Use raw data directly without serializer
            serialized_data = raw_data
            

            # Build response
            response_data = {
                'payments': serialized_data,
                'total_count': len(serialized_data)
            }

          
            return Response({'success': True, 'data': response_data}, status=200)

        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            
            # Return detailed error response for debugging
            return Response({
                'success': False, 
                'message': f'Error retrieving resident payments: {str(e)}',
                'error_type': type(e).__name__,
                'error_details': str(e) if len(str(e)) < 200 else str(e)[:200] + '...'
            }, status=500)


class BillingDetailedListView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_BILLING_MANAGEMENT]

    def get(self, request):
        try:
            # Get pagination parameters
            page = int(request.query_params.get('page', 1))
            limit = min(int(request.query_params.get('limit', 50)), 500)  # Max 500 per page
            offset = (page - 1) * limit
            
            # Get filter parameters
            service_period_month_from = request.query_params.get('service_period_month_from')
            service_period_year_from = request.query_params.get('service_period_year_from')
            service_period_month_to = request.query_params.get('service_period_month_to')
            service_period_year_to = request.query_params.get('service_period_year_to')
            tower_id = request.query_params.getlist('tower_ids')
            unit_id = request.query_params.get('unit_id')
            service_fee_id = request.query_params.get('service_fee_id')
            account_holder_type = request.query_params.get('account_holder_type')
            account_holder_id = request.query_params.get('account_holder_id')
            status_filter = request.query_params.getlist('status')
            search = request.query_params.get('search')
            
            # Convert parameters to proper types
            where_conditions = ["sfp.id IS NOT NULL"]
            sql_params = []
            
            # Add service period filtering
            if service_period_month_from and service_period_year_from and service_period_month_to and service_period_year_to:
                where_conditions.append("""
                    ((sfp.service_period_year > %s) OR 
                     (sfp.service_period_year = %s AND sfp.service_period_month >= %s)) AND
                    ((sfp.service_period_year < %s) OR 
                     (sfp.service_period_year = %s AND sfp.service_period_month <= %s))
                """)
                sql_params.extend([
                    int(service_period_year_from), int(service_period_year_from), int(service_period_month_from),
                    int(service_period_year_to), int(service_period_year_to), int(service_period_month_to)
                ])
            
            # Add tower filter
            tower_ids = [int(t) for t in tower_id if t.isdigit()]
            if tower_ids:
                placeholders = ','.join(['%s'] * len(tower_ids))
                where_conditions.append(f"t.id IN ({placeholders})")
                sql_params.extend(tower_ids)
            
            # Add unit filter
            if unit_id:
                where_conditions.append("u.id = %s")
                sql_params.append(int(unit_id))
            
            # Add payment ID filter
            payment_id = request.query_params.get('payment_id')
            if payment_id:
                where_conditions.append("sfp.id = %s")
                sql_params.append(int(payment_id))

            # Add service fee filter (template ID)
            if service_fee_id:
                where_conditions.append("sfp.service_fee_id = %s")
                sql_params.append(int(service_fee_id))
            
            # Add account holder filters
            account_holder_type = request.query_params.get('account_holder_type')
            account_holder_id = request.query_params.get('account_holder_id')
            
            if account_holder_type:
                where_conditions.append("sfp.account_holder_type COLLATE utf8mb4_general_ci = %s")
                sql_params.append(account_holder_type)
            
            if account_holder_id:
                where_conditions.append("sfp.account_holder_id = %s")
                sql_params.append(int(account_holder_id))
            
            # Add status filter
            status_values = [s for s in status_filter if s]
            if status_values:
                placeholders = ','.join(['%s'] * len(status_values))
                where_conditions.append(f"""
                    sfp.service_status IN ({placeholders})
                """)
                sql_params.extend(status_values)
            
            # Add search filter
            if search:
                where_conditions.append("""
                    (u.unit_name LIKE %s OR u.primary_name LIKE %s OR u.secondary_name LIKE %s OR 
                     t.tower_name LIKE %s OR u.primary_email LIKE %s OR u.secondary_email LIKE %s OR
                     sfp.owner_name LIKE %s OR sfp.owner_email LIKE %s OR sfp.bill_number LIKE %s)
                """)
                search_param = f"%{search}%"
                sql_params.extend([search_param] * 9)
            
            where_clause = " AND ".join(where_conditions)
            
            # Build detailed SQL query with optimized subqueries to avoid cartesian products
            sql = f"""
                SELECT 
                    DATE_FORMAT(
                        CONCAT(
                            LPAD(sfp.service_period_year, 4, '0'), '-',
                            LPAD(sfp.service_period_month, 2, '0'), '-01'
                        ), 
                        '%%Y-%%m-01'
                    ) AS service_month,
                    sfp.service_period_month,
                    sfp.service_period_year,
                    DATE_FORMAT(
                        CONCAT(
                            LPAD(sfp.service_period_year, 4, '0'), '-',
                            LPAD(sfp.service_period_month, 2, '0'), '-01'
                        ), 
                        '%%M %%Y'
                    ) AS month_name,
                    
                    /* Service fee payment table columns - direct use */
                    CAST(sfp.base_service_amount AS CHAR) AS original_amount,
                    CAST(sfp.base_service_amount AS CHAR) AS service_fee_amount,
                    CAST(sfp.amount AS CHAR) AS total_amount,
                    CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                    CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                    
                    /* Payment tracking fields */
                    CAST(sfp.total_paid AS CHAR) AS paid_amount,
                    CAST(sfp.total_paid AS CHAR) AS total_paid,
                    CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                    CAST(sfp.gross_penalty_amount AS CHAR) AS gross_penalty_amount,
                    CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,
                    
                    sfp.due_date,
                    sfp.created_at,
                    DATE_FORMAT(sfp.created_at, '%%b %%d, %%Y') AS invoiceDate,
                    
                    /* Unit and tower information */
                    u.id AS unit_id,
                    u.unit_name,
                    u.unit_name AS unit_display,
                    t.id AS tower_id,
                    t.tower_name,
                    
                    /* Service fee information */
                    sfp.service_fee_id,
                    sfp.id AS payment_id,
                    sfp.bill_number,
                    
                    /* Owner fields from ServiceFeePayment table */
                    sfp.owner_id,
                    sfp.owner_name,
                    sfp.owner_email,
                    sfp.owner_phone,
                    
                    /* Backward compatibility aliases */
                    sfp.owner_name AS resident_name,
                    sfp.owner_name AS primary_name,
                    sfp.owner_email AS resident_email,
                    sfp.owner_email AS primary_email,
                    sfp.owner_phone AS resident_number,
                    sfp.owner_phone AS primary_number,
                    
                    /* Service status - directly from DB */
                    sfp.service_status,

                    sfp.account_holder_type,
                    sfp.account_holder_id,
                    
                    /* Service fee items (includes bill categories, penalties, base fee) */
                    COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items,
                    
                    /* Penalty amount from items */
                    CAST(COALESCE(item_agg.penalty_amount, 0) AS CHAR) AS penalty_amount,
                    
                    /* Created by user */
                    COALESCE(m.full_name, 'System') AS created_by_name,
                    
                    /* Payment details (actual transactions) */
                    COALESCE(payment_agg.payment_details, JSON_ARRAY()) AS payment_details
                
                FROM service_fee_management_servicefeegenerate sfp
                
                /* Essential joins only */
                INNER JOIN towers_unit u ON u.id = sfp.unit_id
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                
                LEFT JOIN user_member m ON sfp.created_by_id = m.id
                
                /* Service fee items - single query for all items (base fee, bill categories, penalties) AND penalty sum */
                LEFT JOIN (
                    SELECT 
                        sfi.service_fee_payment_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sfi.id,
                                'item_type', sfi.item_type,
                                'item_name', sfi.item_name,
                                'amount', CAST(sfi.amount AS CHAR),
                                'description', sfi.description,
                                'bill_category_id', sfi.bill_category_id,
                                'bill_category_name', sfi.item_name,
                                'bill_upload_id', bud.bill_upload_id,
                                'upload_month', bud.upload_month,
                                'upload_year', bud.upload_year,
                                'previous_reading', CAST(bud.previous_reading AS CHAR),
                                'current_reading', CAST(bud.current_reading AS CHAR),
                                'consumption', CAST(bud.consumption AS CHAR),
                                'unit_of_measurement', bud.unit_of_measurement,
                                'price_per_unit', CAST(bud.price_per_unit AS CHAR),
                                'bill_detail_amount', CAST(bud.amount AS CHAR),
                                'penalty_tier_id', sfi.penalty_tier_id,
                                'tier_name', lpt.tier_name,
                                'tier_percentage', lpt.penalty_percentage,
                                'tier_days_overdue', lpt.days_overdue
                            )
                        ) as item_details,
                        SUM(CASE WHEN sfi.item_type = 'penalty' THEN sfi.amount ELSE 0 END) as penalty_amount
                    FROM service_fee_management_servicefeeitem sfi
                    LEFT JOIN service_fee_management_servicefeepaymentlatepenaltytier lpt 
                        ON sfi.penalty_tier_id = lpt.id AND lpt.status = 'active'
                    LEFT JOIN bill_upload_details bud 
                        ON sfi.bill_upload_detail_id = bud.id
                    LEFT JOIN bill_uploads bu 
                        ON bud.bill_upload_id = bu.id
                    GROUP BY sfi.service_fee_payment_id
                ) item_agg ON item_agg.service_fee_payment_id = sfp.id
                
                /* Payment details aggregation */
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', spd.id,
                                'billing_id', spd.billing_id,
                                'transaction_id', spd.transaction_id,
                                'receipt_id', spd.receipt_id,
                                'payment_date', DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'payment_method', COALESCE(pm.method_name, spd.other_method_name, 'N/A'),
                                'amount_paid', CAST(spd.total_paid AS CHAR),
                                'reference_number', spd.reference_number,
                                'payment_type', spd.payment_type,
                                'notes', spd.notes,
                                'received_by_id', spd.received_by_id,
                                'received_by_name', COALESCE(m_rec.full_name, spd.received_by_name, 'System'),
                                'to_account_name', spd.to_account_name,
                                'to_account_number', spd.to_account_number,
                                'voucher_id', spd.voucher_id,
                                'payment_account_code', spd.payment_account_code,
                                'payment_account_name', spd.payment_account_name,
                                'service_period_month', sfp_inner.service_period_month,
                                'service_period_year', sfp_inner.service_period_year,
                                'penalty_amount', CAST(sfp_inner.penalty_amount AS CHAR),
                                'waived_amount', CAST(sfp_inner.waived_amount AS CHAR),
                                'gross_penalty_amount', CAST(sfp_inner.gross_penalty_amount AS CHAR),
                                'amount', CAST(sfp_inner.amount AS CHAR)
                            )
                        ) as payment_details
                    FROM service_fee_payment_details spd
                    LEFT JOIN service_fee_management_servicefeegenerate sfp_inner ON spd.servicefeepaymentid_id = sfp_inner.id
                    LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
                    LEFT JOIN user_member m_rec ON spd.received_by_id = m_rec.id
                    GROUP BY spd.servicefeepaymentid_id
                ) payment_agg ON payment_agg.servicefeepaymentid_id = sfp.id

                WHERE {where_clause}
                ORDER BY sfp.service_period_year DESC, sfp.service_period_month DESC, sfp.created_at DESC, u.unit_name ASC
            """
            
            # print("Final SQL Query for BillingDetailedListView:", sql)
            # Execute main query
            with connection.cursor() as cursor:
                cursor.execute(sql, sql_params)
                columns = [col[0] for col in cursor.description]
                raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Build response
            response_data = {
                'payments': raw_data
            }
            
            return Response({'success': True, 'data': response_data}, status=200)
            
        except Exception as e:
            import traceback
            return Response({
                'success': False,
                'message': f'Error retrieving billing details: {str(e)}',
                'error_details': traceback.format_exc()
            }, status=500)


class ServiceFeePaymentDetailsView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_UNIT_PAYMENT_HISTORY]
    
    def get(self, request):
        try:
            unit_id = request.query_params.get('unit_id')
            service_fee_id = request.query_params.get('service_fee_id')
            account_holder_type = request.query_params.get('account_holder_type')
            account_holder_id = request.query_params.get('account_holder_id')
            
            if not all([unit_id, service_fee_id]):
                return Response({
                    'success': False,
                    'message': 'Missing required parameters (unit_id, service_fee_id)'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Build WHERE conditions
            where_conditions = ["sfp.unit_id = %s", "sfp.service_fee_id = %s"]
            sql_params = [int(unit_id), int(service_fee_id)]

            if account_holder_type:
                where_conditions.append("sfp.account_holder_type COLLATE utf8mb4_general_ci = %s")
                sql_params.append(account_holder_type)
            
            if account_holder_id:
                where_conditions.append("sfp.account_holder_id = %s")
                sql_params.append(int(account_holder_id))
            
            where_clause = " AND ".join(where_conditions)
            
            # Get all payment records for this unit (actual payments from payment table)
            sql = """
                SELECT 
                    sfp.id AS payment_id,
                    sfp.bill_number,
                    sfp.transaction_id,
                    CAST(sfp.amount AS CHAR) AS amount,
                    sfp.payment_status,
                    DATE_FORMAT(sfp.completion_date, '%%Y-%%m-%%d %%H:%%i:%%s') AS payment_date,
                    DATE_FORMAT(sfp.due_date, '%%Y-%%m-%%d') AS due_date,
                    sfp.service_status,
                    sfp.service_period_month,
                    sfp.service_period_year,
                    DATE_FORMAT(CONCAT(sfp.service_period_year, '-', LPAD(sfp.service_period_month, 2, '0'), '-01'), '%%M %%Y') AS period_display,
                    
                    -- Unit information
                    u.id AS unit_id,
                    u.unit_name,
                    
                    -- Owner fields (primary contact info)
                    sfp.owner_id,
                    sfp.owner_name,
                    sfp.owner_email,
                    sfp.owner_phone,
                    
                    -- Contact information from towers_unit (DEPRECATED - for backward compatibility)
                    COALESCE(sfp.owner_name, u.primary_name, u.secondary_name) AS resident_name,
                    COALESCE(sfp.owner_email, u.primary_email, u.secondary_email) AS primary_email,
                    COALESCE(sfp.owner_phone, u.primary_number, u.secondary_number) AS primary_number,
                    
                    -- Tower information
                    t.id AS tower_id,
                    t.tower_name,
                    
                    -- Service Fee information
                    sfp.service_fee_id,
                    CAST(sf_config.fee_amount AS CHAR) AS fee_amount,
                    CAST(sf_config.fee_amount AS CHAR) AS service_fee_amount,
                    CAST(sf_config.fee_amount AS CHAR) AS original_amount,
                    
                    -- Payment details from billing table
                    sfb.reference_number,
                    sfb.notes,
                    sfb.billing_id,
                    sfb.receipt_id,
                    
                    -- Payment method
                    pm.id AS payment_method_id,
                    pm.method_name AS payment_method,
                    
                    -- Created by
                    cb.id AS created_by_id,
                    cb.full_name AS created_by_name,
                    
                    -- Timestamps
                    DATE_FORMAT(sfp.created_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS created_at,
                    DATE_FORMAT(sfp.updated_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS updated_at
                    
                FROM service_fee_management_servicefeegenerate sfp
                
                -- Join with unit to get unit information
                LEFT JOIN towers_unit u ON sfp.unit_id = u.id
                
                -- Join with floor and tower to get tower information
                LEFT JOIN towers_floor f ON u.floor_id = f.id
                LEFT JOIN towers_tower t ON f.tower_id = t.id
                
                -- Join with generation config snapshot
                LEFT JOIN service_fee_management_servicefeegenerationconfig sf_config ON sfp.generation_config_id = sf_config.id
                
                -- Join with payment details
                LEFT JOIN service_fee_payment_details sfb 
                    ON sfp.id = sfb.servicefeepaymentid_id
                    
                -- Join with payment method
                LEFT JOIN service_fee_payment_methods pm 
                    ON pm.id = sfb.payment_method_id
                    
                -- Join with created by user
                LEFT JOIN user_member cb 
                    ON cb.id = sfp.created_by_id
                    
                WHERE {where_clause}
                ORDER BY 
                    sfp.service_period_year DESC, 
                    sfp.service_period_month DESC,
                    sfp.created_at DESC
            """
            
            with connection.cursor() as cursor:
                cursor.execute(sql, sql_params)
                columns = [col[0] for col in cursor.description]
                payment_records = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Calculate totals
            total_paid = sum(float(p.get('amount', 0) or 0) for p in payment_records)
            completed_count = sum(1 for p in payment_records if p.get('payment_status') == 'completed')
            
            return Response({
                'success': True,
                'data': {
                    'payment_records': payment_records,
                    'total_count': len(payment_records),
                    'total_paid_amount': f"{total_paid:.2f}",
                    'completed_count': completed_count
                }
            }, status=200)
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            return Response({
                'success': False,
                'message': f'Error retrieving payment details: {str(e)}'
            }, status=500)


class ServiceFeeUnpaidPeriodsView(APIView):
    """
    API view to get unpaid service periods for payment modal
    Shows months with amounts that need to be paid (for record payment modal)
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        # Record payment permission to read unpaid periods for payment modal
        self.required_permission_id = [PERMISSION_RECORD_PAYMENT]
        try:
            unit_id = request.query_params.get('unit_id')
            service_fee_id = request.query_params.get('service_fee_id')
            account_holder_type = request.query_params.get('account_holder_type') or None
            account_holder_id = request.query_params.get('account_holder_id') or None
            
            if not all([unit_id]):
                return Response({
                    'success': False,
                    'message': 'Missing required parameters (unit_id)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get total advance available for this unit AND account holder
            # CRITICAL: Must filter by account_holder to prevent double-counting
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT SUM(remaining_amount) 
                    FROM service_fee_advance_payments 
                    WHERE unit_id = %s 
                    AND status IN ('available', 'partial')
                    AND (%s IS NULL OR account_holder_type COLLATE utf8mb4_general_ci = %s COLLATE utf8mb4_general_ci)
                    AND (%s IS NULL OR account_holder_id = %s)
                """, [
                    unit_id,
                    account_holder_type, account_holder_type,
                    account_holder_id, account_holder_id
                ])
                total_advance_record = cursor.fetchone()
                unit_total_advance = float(total_advance_record[0] or 0)

            # Optimized query using direct columns from ServiceFeePayment table
            sql = f"""
                SELECT 
                    DATE_FORMAT(
                        CONCAT(
                            LPAD(sfp.service_period_year, 4, '0'), '-',
                            LPAD(sfp.service_period_month, 2, '0'), '-01'
                        ), 
                        '%%Y-%%m-01'
                    ) AS service_month,
                    sfp.service_period_month,
                    sfp.service_period_year,
                    DATE_FORMAT(
                        CONCAT(
                            LPAD(sfp.service_period_year, 4, '0'), '-',
                            LPAD(sfp.service_period_month, 2, '0'), '-01'
                        ), 
                        '%%M %%Y'
                    ) AS month_name,
                    
                    /* Service fee payment table columns - direct use */
                    CAST(sfp.base_service_amount AS CHAR) AS original_amount,
                    CAST(sfp.base_service_amount AS CHAR) AS service_fee_amount,
                    CAST(sfp.amount AS CHAR) AS total_amount,
                    CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                    CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                    CAST(sfp.additional_bill_charges AS CHAR) AS additional_bill_charges,
                    CAST(sfp.additional_bill_charges AS CHAR) AS gas_fee,
                    
                    /* Payment tracking - calculated from actual billing records */
                    CAST(COALESCE(payment_agg.total_paid_amount, 0) AS CHAR) AS paid_amount,
                    CAST(COALESCE(payment_agg.total_paid_amount, 0) AS CHAR) AS paid,
                    CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                    
                    /* Penalty columns from table */
                    CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,
                    CAST(sfp.gross_penalty_amount AS CHAR) AS gross_penalty_amount,
                    
                    sfp.due_date,
                    sfp.late_penalty_enabled AS late_penalty_enabled,
                    sfp.late_penalty_enabled AS is_late_penalty_enabled,
                    
                    sf_config.due_day AS due_day,
                    COALESCE(lpt_snapshot.penalty_percentage, 0) AS penalty_percentage,
                    
                    /* Unit and tower information */
                    u.id AS unit_id,
                    u.unit_name,
                    t.id AS tower_id,
                    t.tower_name,
                    
                    /* Service fee information */
                    sfp.service_fee_id,
                    sfp.id AS payment_id,
                    sfp.bill_number,
                    
                    /* Owner fields from ServiceFeePayment table */
                    sfp.owner_id,
                    sfp.owner_name,
                    sfp.owner_email,
                    sfp.owner_phone,
                    
                    /* Backward compatibility aliases */
                    sfp.owner_name AS resident_name,
                    sfp.owner_name AS primary_name,
                    sfp.owner_email AS resident_email,
                    sfp.owner_email AS primary_email,
                    sfp.owner_phone AS resident_number,
                    sfp.owner_phone AS primary_number,
                    
                    /* Service status */
                    sfp.service_status,
                    
                    /* Account holder information */
                    sfp.account_holder_type,
                    sfp.account_holder_id,
                    
                    /* Advance amount - Calculated from aggregation */
                    COALESCE(adv_agg.total_advance, 0) AS advance_amount,
                    
                    /* Waiver data - computed flag */
                    CASE 
                        WHEN COALESCE(sfp.waived_amount, 0) > 0 THEN TRUE
                        ELSE FALSE
                    END AS waiver_applied,
                    
                    /* Waiver details from waivers table */
                    COALESCE(waiver_agg.waiver_details, JSON_ARRAY()) AS waiver_data,
                    
                    /* Payment details aggregation (actual transactions) */
                    COALESCE(payment_agg.payment_details, JSON_ARRAY()) AS payment_details,
                    
                    /* Service fee items (includes bill categories, penalties, base fee) */
                    COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items
                
                FROM service_fee_management_servicefeegenerate sfp
                
                /* Essential joins only */
                INNER JOIN towers_unit u ON u.id = sfp.unit_id
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                
                /* LEFT JOIN with generation config snapshot */
                LEFT JOIN service_fee_management_servicefeegenerationconfig sf_config ON sfp.generation_config_id = sf_config.id
                
                /* Service fee items - single query for all items (consistent with BillingDetailedListView) */
                LEFT JOIN (
                    SELECT 
                        sfi.service_fee_payment_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sfi.id,
                                'item_type', sfi.item_type,
                                'item_name', sfi.item_name,
                                'amount', CAST(sfi.amount AS CHAR),
                                'description', sfi.description,
                                'bill_category_id', sfi.bill_category_id,
                                'bill_category_name', sfi.item_name,
                                'bill_upload_id', bud.bill_upload_id,
                                'upload_month', bud.upload_month,
                                'upload_year', bud.upload_year,
                                'previous_reading', CAST(bud.previous_reading AS CHAR),
                                'current_reading', CAST(bud.current_reading AS CHAR),
                                'consumption', CAST(bud.consumption AS CHAR),
                                'unit_of_measurement', bud.unit_of_measurement,
                                'price_per_unit', CAST(bud.price_per_unit AS CHAR),
                                'bill_detail_amount', CAST(bud.amount AS CHAR),
                                'penalty_tier_id', sfi.penalty_tier_id,
                                'tier_name', lpt.tier_name,
                                'tier_percentage', lpt.penalty_percentage,
                                'tier_days_overdue', lpt.days_overdue
                            )
                        ) as item_details
                    FROM service_fee_management_servicefeeitem sfi
                    LEFT JOIN service_fee_management_servicefeepaymentlatepenaltytier lpt 
                        ON sfi.penalty_tier_id = lpt.id AND lpt.status = 'active'
                    LEFT JOIN bill_upload_details bud 
                        ON sfi.bill_upload_detail_id = bud.id
                    GROUP BY sfi.service_fee_payment_id
                ) item_agg ON item_agg.service_fee_payment_id = sfp.id
                
                /* Payment details aggregation (actual transactions) */
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        SUM(spd.total_paid) as total_paid_amount,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', spd.id,
                                'billing_id', spd.billing_id,
                                'transaction_id', spd.transaction_id,
                                'receipt_id', spd.receipt_id,
                                'payment_date', DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'payment_method', COALESCE(pm.method_name, spd.other_method_name, 'N/A'),
                                'amount_paid', CAST(spd.total_paid AS CHAR),
                                'reference_number', spd.reference_number,
                                'payment_type', spd.payment_type,
                                'notes', spd.notes,
                                'received_by_id', spd.received_by_id,
                                'received_by_name', COALESCE(m_rec.full_name, spd.received_by_name, 'System'),
                                'to_account_name', spd.to_account_name,
                                'to_account_number', spd.to_account_number,
                                'voucher_id', spd.voucher_id,
                                'payment_account_code', spd.payment_account_code,
                                'payment_account_name', spd.payment_account_name
                            )
                        ) as payment_details
                    FROM service_fee_payment_details spd
                    LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
                    LEFT JOIN user_member m_rec ON spd.received_by_id = m_rec.id
                    GROUP BY spd.servicefeepaymentid_id
                ) payment_agg ON payment_agg.servicefeepaymentid_id = sfp.id
                
                /* Waiver details aggregation - join through payment_details */
                LEFT JOIN (
                    SELECT 
                        spd.servicefeepaymentid_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', pw.id,
                                'waived_amount', pw.waived_amount,
                                'waiver_type', pw.waiver_type,
                                'percentage', pw.percentage,
                                'reason', pw.reason,
                                'notes', pw.notes,
                                'applied_at', DATE_FORMAT(pw.applied_at, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'applied_by', COALESCE(m_sub.full_name, 'System')
                            )
                        ) as waiver_details
                    FROM service_fee_payment_details spd
                    INNER JOIN service_fee_penalty_waivers pw ON pw.billing_id = spd.id
                    LEFT JOIN user_member m_sub ON pw.applied_by_id = m_sub.id
                    GROUP BY spd.servicefeepaymentid_id
                ) waiver_agg ON waiver_agg.servicefeepaymentid_id = sfp.id
                
                /* Get ACTIVE penalty tier from snapshot table */
                LEFT JOIN (
                    SELECT payment_id, penalty_percentage
                    FROM service_fee_management_servicefeepaymentlatepenaltytier
                    WHERE status = 'active'
                ) lpt_snapshot ON sfp.id = lpt_snapshot.payment_id

                /* Advance aggregation */
                LEFT JOIN (
                    SELECT 
                        unit_id, 
                        account_holder_type, 
                        account_holder_id, 
                        SUM(remaining_amount) as total_advance
                    FROM service_fee_advance_payments
                    WHERE status IN ('available', 'partial')
                    GROUP BY unit_id, account_holder_type, account_holder_id
                ) adv_agg ON adv_agg.unit_id = sfp.unit_id 
                    AND adv_agg.account_holder_type = sfp.account_holder_type
                    AND adv_agg.account_holder_id = sfp.account_holder_id
                
                WHERE sfp.unit_id = %s
                AND sfp.service_status IN ('due', 'partial', 'overdue')
                /* Filter by account holder if provided */
                AND (%s IS NULL OR sfp.account_holder_type COLLATE utf8mb4_general_ci = %s COLLATE utf8mb4_general_ci)
                AND (%s IS NULL OR sfp.account_holder_id = %s)
                ORDER BY sfp.service_period_year ASC, sfp.service_period_month ASC
            """
            # print(sql, [unit_id, service_fee_id])
            with connection.cursor() as cursor:
                cursor.execute(sql, [
                    unit_id, 
                    account_holder_type, account_holder_type,
                    account_holder_id, account_holder_id
                ])
                columns = [col[0] for col in cursor.description]
                unpaid_periods = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Inject unit-wide total advance into the results
            # To ensure frontend .reduce() works correctly, we put the full total in the FIRST row
            # and 0 in others (already defaulted to 0 in SQL)
            # NOTE: SQL query now handles advance_amount per row based on account holder
            # if unpaid_periods and len(unpaid_periods) > 0:
            #    unpaid_periods[0]['advance_amount'] = unit_total_advance
                
            return Response({
                'success': True,
                'data': {
                    'unpaid_periods': unpaid_periods,
                    'total_due': sum(float(p.get('remaining_amount', 0) or 0) for p in unpaid_periods),
                    'total_advance': unit_total_advance
                }
            }, status=200)
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            return Response({
                'success': False,
                'message': f'Error retrieving unpaid periods: {str(e)}'
            }, status=500)


# ==================== REMINDER VIEWS ====================

class ReminderListView(APIView):
    """
    API view to list all reminders with filtering and search
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        """Get all reminders with filtering options"""
        # Permission for viewing reminders
        self.required_permission_id = [PERMISSION_VIEW_REMINDERS]
        try:
            from .models import Reminder, ReminderTiming, ReminderPaymentStatus, ReminderTower, ReminderSpecificTarget
            from .serializers import ReminderSerializer, ReminderFilterSerializer
            
            # Get current user's member profile (optional for testing)
            member = None
            if hasattr(request, 'user') and request.user.is_authenticated:
                try:
                    member = Member.objects.get(user=request.user)
                except Member.DoesNotExist:
                    # Allow listing even without member profile for testing
                    pass
            
            # Validate filter parameters
            filter_serializer = ReminderFilterSerializer(data=request.GET)
            if not filter_serializer.is_valid():
                return Response({
                    'success': False,
                    'message': 'Invalid filter parameters',
                    'errors': filter_serializer.errors
                }, status=400)
            
            # Start with base queryset - with optimized joins
            queryset = Reminder.objects.select_related('created_by').prefetch_related(
                Prefetch('timing_rules', queryset=ReminderTiming.objects.all()),
                Prefetch('payment_statuses', queryset=ReminderPaymentStatus.objects.all()),
                Prefetch('reminder_towers', queryset=ReminderTower.objects.select_related('tower')),
                Prefetch('specific_targets', queryset=ReminderSpecificTarget.objects.all())
            ).all()
            
            # Apply filters
            filters = filter_serializer.validated_data
            
            # Search filter
            search = filters.get('search')
            if search:
                queryset = queryset.filter(
                    Q(reminder_name__icontains=search) |
                    Q(message_preview__icontains=search) |
                    Q(audience__icontains=search)
                )
            
            # Status filter
            status_filter = filters.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            # Reminder type filter
            reminder_type = filters.get('reminder_type')
            if reminder_type:
                queryset = queryset.filter(reminder_type=reminder_type)
            
            # Audience filter
            audience = filters.get('audience')
            if audience:
                queryset = queryset.filter(audience=audience)
            
            # Channel filter
            channel = filters.get('channel')
            if channel:
                if channel == 'App':
                    queryset = queryset.filter(app_notification=True)
                elif channel == 'SMS':
                    queryset = queryset.filter(sms=True)
                elif channel == 'Email':
                    queryset = queryset.filter(email=True)
            
            # Serialize data - now includes normalized table data
            serializer = ReminderSerializer(queryset, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data,
                'count': len(serializer.data)
            }, status=200)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)


class ReminderDetailView(APIView):
    """
    API view to get, update, or delete a specific reminder
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request, pk):
        """Get a specific reminder"""
        # Permission for viewing reminders
        self.required_permission_id = [PERMISSION_VIEW_REMINDERS]
        try:
            from .models import Reminder, ReminderTiming, ReminderPaymentStatus, ReminderTower, ReminderSpecificTarget
            from .serializers import ReminderSerializer
            
            # Use optimized queryset with prefetch_related
            reminder = Reminder.objects.select_related('created_by').prefetch_related(
                Prefetch('timing_rules', queryset=ReminderTiming.objects.all()),
                Prefetch('payment_statuses', queryset=ReminderPaymentStatus.objects.all()),
                Prefetch('reminder_towers', queryset=ReminderTower.objects.select_related('tower')),
                Prefetch('specific_targets', queryset=ReminderSpecificTarget.objects.all())
            ).get(pk=pk)
            
            serializer = ReminderSerializer(reminder)
            
            return Response({
                'success': True,
                'data': serializer.data
            }, status=200)
            
        except Reminder.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Reminder not found'
            }, status=404)
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)
    
    def put(self, request, pk):
        """Update a specific reminder"""
        # Permission for editing reminders
        self.required_permission_id = [PERMISSION_EDIT_REMINDER]
        try:
            from .models import Reminder
            from .serializers import ReminderCreateSerializer
            
            reminder = get_object_or_404(Reminder, pk=pk)
            serializer = ReminderCreateSerializer(
                reminder, 
                data=request.data, 
                partial=True,
                context={'request': request}
            )
            
            if serializer.is_valid():
                serializer.save()
                
                # Log the update (skip if no authenticated user)
                try:
                    if hasattr(request, 'user') and request.user.is_authenticated:
                        try:
                            member = Member.objects.get(user=request.user)
                            create_audit_trail(
                                member=member,
                                event_type='REMINDER_UPDATED',
                                table_name='service_fee_reminders',
                                row_id=reminder.id,
                                new_data={'reminder_name': reminder.reminder_name, 'status': reminder.status},
                                description=f"Updated reminder: {reminder.reminder_name}"
                            )
                        except Member.DoesNotExist:
                            pass
                except Exception:
                    # Skip audit trail if it fails
                    pass
                
                # Refresh reminder from database with optimized queries
                reminder.refresh_from_db()
                from .models import ReminderTiming, ReminderPaymentStatus, ReminderTower, ReminderSpecificTarget
                reminder = Reminder.objects.select_related('created_by').prefetch_related(
                    Prefetch('timing_rules', queryset=ReminderTiming.objects.all()),
                    Prefetch('payment_statuses', queryset=ReminderPaymentStatus.objects.all()),
                    Prefetch('reminder_towers', queryset=ReminderTower.objects.select_related('tower')),
                    Prefetch('specific_targets', queryset=ReminderSpecificTarget.objects.all())
                ).get(pk=pk)
                
                from .serializers import ReminderSerializer
                response_serializer = ReminderSerializer(reminder)
                
                return Response({
                    'success': True,
                    'message': 'Reminder updated successfully',
                    'data': response_serializer.data
                }, status=200)
            else:
                return Response({
                    'success': False,
                    'message': 'Validation error',
                    'errors': serializer.errors
                }, status=400)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)
    
    def delete(self, request, pk):
        """Delete a specific reminder"""
        # Permission for deleting reminders
        self.required_permission_id = [PERMISSION_DELETE_REMINDER]
        try:
            from .models import Reminder
            
            reminder = get_object_or_404(Reminder, pk=pk)
            reminder_name = reminder.reminder_name
            
            # Log the deletion (skip if no authenticated user)
            try:
                if hasattr(request, 'user') and request.user.is_authenticated:
                    try:
                        member = Member.objects.get(user=request.user)
                        create_audit_trail(
                            member=member,
                            event_type='REMINDER_DELETED',
                            table_name='service_fee_reminders',
                            row_id=reminder.id,
                            old_data={'reminder_name': reminder_name},
                            description=f"Deleted reminder: {reminder_name}"
                        )
                    except Member.DoesNotExist:
                        pass
            except Exception:
                # Skip audit trail if it fails
                pass
            
            reminder.delete()
            
            return Response({
                'success': True,
                'message': f'Reminder "{reminder_name}" deleted successfully'
            }, status=200)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)


class ReminderCreateView(APIView):
    """
    API view to create a new reminder
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def post(self, request):
        """Create a new reminder"""
        # Permission for adding reminders
        self.required_permission_id = [PERMISSION_ADD_REMINDER]
        try:
            from .serializers import ReminderCreateSerializer
            
            serializer = ReminderCreateSerializer(
                data=request.data,
                context={'request': request}
            )
            
            if serializer.is_valid():
                reminder = serializer.save()
                
                # Log the creation (skip if no authenticated user)
                try:
                    if hasattr(request, 'user') and request.user.is_authenticated:
                        try:
                            member = Member.objects.get(user=request.user)
                            create_audit_trail(
                                member=member,
                                event_type='REMINDER_CREATED',
                                table_name='service_fee_reminders',
                                row_id=reminder.id,
                                new_data={'reminder_name': reminder.reminder_name, 'reminder_type': reminder.reminder_type},
                                description=f"Created reminder: {reminder.reminder_name}"
                            )
                        except Member.DoesNotExist:
                            pass
                except Exception:
                    # Skip audit trail if it fails
                    pass
                
                from .serializers import ReminderSerializer
                response_serializer = ReminderSerializer(reminder)
                
                return Response({
                    'success': True,
                    'message': 'Reminder created successfully',
                    'data': response_serializer.data
                }, status=201)
            else:
                return Response({
                    'success': False,
                    'message': 'Validation error',
                    'errors': serializer.errors
                }, status=400)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)

 
class ReminderSendView(APIView):
    """
    API view to manually send a reminder (Updated with Due/Overdue payment logic)
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def post(self, request, pk):
        """Send a reminder manually"""
        self.required_permission_id = [PERMISSION_MANAGE_REMINDERS]
        try:
            from .models import Reminder, ReminderLog
            from datetime import datetime
            from user.models import Member
            from towers.models import Unit
            
            reminder = get_object_or_404(Reminder, pk=pk)
            
            # Determine recipients based on audience
            recipients = self._get_reminder_recipients(reminder)
            
            
            # Get active channels from reminder
            channels = reminder.channels_active
            
            logs_created = 0
            
            # Send to each recipient via each active channel
            for recipient in recipients:
                # Get recipient's unit (if available)
                unit = None
                try:
                    # Get unit through resident relationship
                    resident = recipient.resident.first()
                    if resident:
                        unit = resident.unit
                except:
                    pass
                
                # Create a log entry for each active channel
                for channel in channels:
                    # Generate message content based on reminder template
                    message_content = self._generate_message_content(reminder, recipient, unit)
                    
                    # Create ReminderLog entry
                    reminder_log = ReminderLog.objects.create(
                        reminder=reminder,
                        recipient=recipient,
                        unit=unit,
                        channel=channel,
                        message_content=message_content,
                        delivery_status='sent',  # Mark as sent immediately for manual sends
                        sent_at=datetime.now()
                    )
                    logs_created += 1
                    
                    # Here you would integrate with actual sending services:
                    # - For App: Create in-app notification
                    # - For SMS: Send via SMS service
                    # - For Email: Send via email service
                    # For now, we'll just log the send attempt
            
            # Update reminder tracking
            reminder.last_sent = datetime.now()
            reminder.total_sent += logs_created
            reminder.save()
            
            # Log the manual send (skip if no authenticated user)
            try:
                if hasattr(request, 'user') and request.user.is_authenticated:
                    try:
                        member = Member.objects.get(user=request.user)
                        create_audit_trail(
                            member=member,
                            event_type='REMINDER_SENT',
                            table_name='service_fee_reminders',
                            row_id=reminder.id,
                            new_data={'total_sent': reminder.total_sent, 'last_sent': str(reminder.last_sent)},
                            description=f"Manually sent reminder: {reminder.reminder_name}"
                        )
                    except Member.DoesNotExist:
                        pass
            except Exception:
                # Skip audit trail if it fails
                pass
            
            return Response({
                'success': True,
                'message': f'Reminder "{reminder.reminder_name}" sent to {len(recipients)} recipients via {len(channels)} channels',
                'data': {
                    'total_sent': reminder.total_sent,
                    'last_sent': reminder.last_sent,
                    'logs_created': logs_created,
                    'recipients_count': len(recipients),
                    'channels_used': channels
                }
            }, status=200)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)

    def _get_reminder_recipients(self, reminder):
        """
        Determine recipients based on reminder audience configuration
        """
        from user.models import Member
        from towers.models import Unit, Resident, Tower
        
        recipients = []
        
        if reminder.audience == 'All Towers':
            # Get all members who are residents
            recipients = list(Member.objects.filter(resident__isnull=False).distinct())
        
        elif reminder.audience == 'All Residents':
            # Get all members who are residents
            recipients = list(Member.objects.filter(resident__isnull=False).distinct())
        
        elif reminder.audience == 'Specific Tower':
            # Get residents from specific towers using tower IDs (supports multiple)
            if reminder.specific_target:
                try:
                    # Check if it's a comma-separated list of IDs (multiple towers)
                    if ',' in reminder.specific_target:
                        tower_ids = [int(id.strip()) for id in reminder.specific_target.split(',') if id.strip()]
                        recipients = list(Member.objects.filter(
                            resident__unit__floor__tower_id__in=tower_ids
                        ).distinct())
                    else:
                        # Single tower ID
                        tower_id = int(reminder.specific_target)
                        recipients = list(Member.objects.filter(
                            resident__unit__floor__tower_id=tower_id
                        ).distinct())
                except (ValueError, TypeError):
                    # Fallback to name-based lookup for old data
                    recipients = list(Member.objects.filter(
                        resident__unit__floor__tower__tower_name__icontains=reminder.specific_target
                    ).distinct())
        
        elif reminder.audience == 'Specific Units':
            # Get residents from specific units using unit IDs (supports multiple)
            if reminder.specific_target:
                try:
                    # Check if it's a comma-separated list of IDs (multiple units)
                    if ',' in reminder.specific_target:
                        unit_ids = [int(id.strip()) for id in reminder.specific_target.split(',') if id.strip()]
                        recipients = list(Member.objects.filter(
                            resident__unit_id__in=unit_ids
                        ).distinct())
                    else:
                        # Single unit ID
                        unit_id = int(reminder.specific_target)
                        recipients = list(Member.objects.filter(
                            resident__unit_id=unit_id
                        ).distinct())
                except (ValueError, TypeError):
                    # Fallback to name-based lookup for old data
                    unit_names = [name.strip() for name in reminder.specific_target.split(',')]
                    recipients = list(Member.objects.filter(
                        resident__unit__unit_name__in=unit_names
                    ).distinct())
        
        elif reminder.audience == 'Specific Resident':
            # Get specific residents using resident IDs (supports multiple)
            if reminder.specific_target:
                try:
                    # Check if it's a comma-separated list of IDs (multiple residents)
                    if ',' in reminder.specific_target:
                        resident_ids = [int(id.strip()) for id in reminder.specific_target.split(',') if id.strip()]
                        recipients = list(Member.objects.filter(
                            resident__id__in=resident_ids
                        ))
                    else:
                        # Single resident ID
                        resident_id = int(reminder.specific_target)
                        recipients = list(Member.objects.filter(
                            resident__id=resident_id
                        ))
                except (ValueError, TypeError):
                    # Fallback to name-based lookup for old data
                    recipients = list(Member.objects.filter(
                        resident__isnull=False,
                        full_name__icontains=reminder.specific_target
                    ))
        
        elif reminder.audience == 'Due Only':
            # Get residents with due service fees (due_day is greater than current day - not yet overdue)
            from django.utils import timezone
            from django.db.models import Q, OuterRef, Subquery, Sum, Exists
            from service_fee.models import ServiceFee
            from django.db.models import F
            
            today = timezone.now().date()
            current_day = today.day
            
            # Get all residents who have active service fees where due_day > current day (not overdue yet)
            recipients = list(Member.objects.filter(
                Q(resident__isnull=False) &
                (
                    # Option 1: Residents who have service fees via unit assignment
                    Q(resident__unit__service_fees__is_active=True, 
                      resident__unit__service_fees__due_day__gt=current_day) |
                    # Option 2: Residents who have service fees via tower assignment
                    Q(resident__unit__floor__tower__service_fees__is_active=True,
                      resident__unit__floor__tower__service_fees__due_day__gt=current_day)
                )
            ).exclude(
                # Exclude residents who have fully paid all their service fees
                service_fee_management_payments__service_status='paid'
            ).distinct())
        
        elif reminder.audience == 'Overdue Only':
            # Get residents with overdue service fees (due_day is less than or equal to current day)
            from django.utils import timezone
            from django.db.models import Q, OuterRef, Subquery, Sum
            from service_fee.models import ServiceFee
            from django.db.models import F
            
            today = timezone.now().date()
            current_day = today.day
            
            # Get residents who have overdue payments (due_day <= current day)
            recipients = list(Member.objects.filter(
                Q(resident__isnull=False) &
                (
                    # Option 1: Has active service fees via unit where due_day <= current day
                    Q(resident__unit__service_fees__is_active=True,
                      resident__unit__service_fees__due_day__lte=current_day) |
                    # Option 2: Has active service fees via tower where due_day <= current day
                    Q(resident__unit__floor__tower__service_fees__is_active=True,
                      resident__unit__floor__tower__service_fees__due_day__lte=current_day)
                )
            ).exclude(
                # Exclude residents who have fully paid
                service_fee_management_payments__service_status='paid'
            ).distinct())
        
        elif reminder.audience == 'Paid Only':
            # Get residents who have paid service fees (service_status = 'paid')
            recipients = list(Member.objects.filter(
                Q(resident__isnull=False) &
                Q(service_fee_management_payments__service_status='paid')
            ).distinct())
        
        return recipients

    def _generate_message_content(self, reminder, recipient, unit=None):
        """
        Generate personalized message content for the reminder
        """
        message = reminder.message_preview
        
        # Replace placeholders with actual data
        message = message.replace('{recipient_name}', recipient.full_name or recipient.user.username)
        
        if unit:
            message = message.replace('{tower_name}', unit.tower.tower_name if unit.tower else 'Your Tower')
            message = message.replace('{unit_number}', unit.unit_name)
        else:
            message = message.replace('{tower_name}', 'Your Tower')
            message = message.replace('{unit_number}', 'Your Unit')
        
        # Add current date
        from datetime import datetime
        message = message.replace('{current_date}', datetime.now().strftime('%d %b %Y'))
        
        # Add payment-specific placeholders for Paid Only reminders
        if reminder.audience == 'Paid Only':
            try:
                # Get the latest payment for this recipient
                latest_payment = recipient.service_fee_management_payments.filter(
                    service_status='paid'
                ).order_by('-payment_date').first()
                
                if latest_payment:
                    # Get transaction_id from billing record
                    latest_billing = ServiceFeeBilling.objects.filter(servicefeepaymentid=latest_payment).order_by('-created_at').first()
                    transaction_id = latest_billing.transaction_id if latest_billing else 'N/A'
                    
                    message = message.replace('{payment_amount}', str(latest_payment.amount))
                    message = message.replace('{payment_date}', latest_payment.payment_date.strftime('%d %b %Y') if latest_payment.payment_date else 'N/A')
                    message = message.replace('{payment_method}', latest_payment.payment_method or 'N/A')
                    message = message.replace('{transaction_id}', transaction_id)
                else:
                    # Fallback values if no payment found
                    message = message.replace('{payment_amount}', 'N/A')
                    message = message.replace('{payment_date}', 'N/A')
                    message = message.replace('{payment_method}', 'N/A')
                    message = message.replace('{transaction_id}', 'N/A')
            except Exception:
                # Fallback if payment lookup fails
                message = message.replace('{payment_amount}', 'N/A')
                message = message.replace('{payment_date}', 'N/A')
                message = message.replace('{payment_method}', 'N/A')
                message = message.replace('{transaction_id}', 'N/A')
        
        return message


class ReminderLogsView(APIView):
    """
    API view to get reminder delivery logs
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request, pk=None):
        """Get reminder logs, optionally filtered by reminder ID"""
        self.required_permission_id = [PERMISSION_MANAGE_REMINDERS]
        try:
            from .models import ReminderLog
            from .serializers import ReminderLogSerializer
            
            queryset = ReminderLog.objects.select_related(
                'reminder', 'recipient', 'unit'
            ).all()
            
            # Filter by specific reminder if pk provided
            if pk:
                queryset = queryset.filter(reminder_id=pk)
            
            # Apply date range filter if provided
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
            
            if start_date:
                queryset = queryset.filter(sent_at__date__gte=start_date)
            if end_date:
                queryset = queryset.filter(sent_at__date__lte=end_date)
            
            # Apply status filter
            status_filter = request.GET.get('delivery_status')
            if status_filter:
                queryset = queryset.filter(delivery_status=status_filter)
            
            serializer = ReminderLogSerializer(queryset, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data,
                'count': len(serializer.data)
            }, status=200)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)


class CompletePendingPaymentView(APIView):
    """
    API view to manually complete a pending payment
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def post(self, request):
        # Record-payment permission required for completing pending payments
        self.required_permission_id = [PERMISSION_RECORD_PAYMENT]
        """
        Complete a pending payment manually
        """
        from django.db import transaction
        try:
            with transaction.atomic():
                payment_id = request.data.get('payment_id')
                
                if not payment_id:
                    return Response({
                        'success': False,
                        'message': 'payment_id is required'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Get the payment details first
                try:
                    payment = ServiceFeePayment.objects.get(id=payment_id)
                except ServiceFeePayment.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': f'Payment with ID {payment_id} not found'
                    }, status=status.HTTP_404_NOT_FOUND)
                
                if payment.payment_status == 'completed':
                    return Response({
                        'success': True,
                        'message': 'Payment is already completed',
                        'payment_status': payment.payment_status,
                        'service_status': payment.service_status
                    })
                
                # Complete the payment
                success = complete_pending_payment(payment_id)
                
                if success:
                    # Refresh the payment object
                    payment.refresh_from_db()
                    
                    # Get transaction_id from billing record
                    latest_billing = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment).order_by('-created_at').first()
                    transaction_id = latest_billing.transaction_id if latest_billing else 'N/A'
                    
                    # Generate Voucher for this manual completion
                    if latest_billing:
                        from .utils.voucher_generator import create_payment_voucher
                        voucher_result = create_payment_voucher(
                            billing_records=[latest_billing],
                            total_amount=float(latest_billing.total_paid),  # Use actual cash in billing record
                            payment_method_id=payment.payment_method_rel.id if payment.payment_method_rel else None,
                            member=None,
                            unit=payment.unit,
                            batch_receipt_id=latest_billing.receipt_id,
                            notes=f"Manual Completion of Pending Payment #{payment_id}"
                        )
                        
                        if not voucher_result.get('success'):
                            raise Exception(f"Accounting Integration Failed: {voucher_result.get('message')}")

                    # Schedule async email sending after successful transaction commit
                    def trigger_async_email(p_obj):
                        try:
                            # Import here to avoid circular dependencies if any
                            from .serializers import ServiceFeePaymentSerializer
                            # Refresh to get latest data
                            p_obj.refresh_from_db()
                            p_data = ServiceFeePaymentSerializer(p_obj).data
                            threading.Thread(
                                target=send_payment_email_if_enabled,
                                kwargs={
                                    'payment_obj': p_obj,
                                    'payment_data': p_data,
                                    'send_email': True,
                                    'operation_type': "manual completion"
                                },
                                daemon=True
                            ).start()
                        except Exception as e:
                            print(f"Error triggering async email: {str(e)}")

                    transaction.on_commit(lambda: trigger_async_email(payment))
                    
                    # Create payment received notification for admins
                    try:
                        from notifications.utils import (
                            create_service_fee_payment_received_notification,
                            create_community_member_payment_confirmation
                        )
                        
                        payment_amount = payment.amount
                        if latest_billing:
                            payment_amount = latest_billing.total_paid
                        
                        # Create admin notification
                        create_service_fee_payment_received_notification(
                            payment=payment,
                            payment_amount=payment_amount,
                            payment_method=None,  # Not available in this context
                            recorded_by=None,  # Manual completion, no specific recorder
                            transaction_id=latest_billing.id if latest_billing else None
                        )
                        print(f"[CompletePendingPayment] ✅ Payment received notification created for payment ID {payment.id}")
                        
                        # Create community member confirmation notification
                        print(f"[CompletePendingPayment] Creating community member payment confirmation for payment ID {payment.id}...")
                        create_community_member_payment_confirmation(
                            payment=payment,
                            payment_amount=payment_amount,
                            transaction_id=latest_billing.id if latest_billing else None
                        )
                        print(f"[CompletePendingPayment] ✅ Community member payment confirmation created for payment ID {payment.id}")
                    except Exception as notif_error:
                        # Log but don't fail - notifications are optional
                        print(f"[CompletePendingPayment] Could not create payment notification: {notif_error}")
                        import traceback
                        print(traceback.format_exc())

                    return Response({
                        'success': True,
                        'message': 'Payment completed successfully',
                        'payment_id': payment.id,
                        'transaction_id': transaction_id,
                        'amount': str(payment.amount),
                        'payment_status': payment.payment_status,
                        'service_status': payment.service_status,
                        'completion_date': payment.completion_date
                    })
                else:
                    return Response({
                        'success': False,
                        'message': 'Failed to complete payment'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error completing payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProcessScheduledRemindersView(APIView):
    """
    API view to process scheduled reminders
    This can be called by cron jobs or scheduled tasks
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def post(self, request):
        """Process all scheduled reminders that need to be sent"""
        self.required_permission_id = [PERMISSION_MANAGE_REMINDERS]
        try:
            from .models import Reminder, ReminderLog
            from datetime import datetime
            
            processed_count = 0
            logs_created = 0
            
            # Get all active scheduled reminders
            scheduled_reminders = Reminder.objects.filter(
                reminder_type='Scheduled',
                status='Active'
            )
            
            for reminder in scheduled_reminders:
                # For demonstration, process all scheduled reminders
                # In production, you'd check timing conditions here
                
                # Get recipients and channels
                recipients = self._get_scheduled_recipients(reminder)
                channels = reminder.channels_active
                
                # Send to each recipient via each active channel
                reminder_logs_count = 0
                for recipient in recipients:
                    unit = None
                    try:
                        # Get unit through resident relationship
                        resident = recipient.resident.first()
                        if resident:
                            unit = resident.unit
                    except:
                        pass
                    
                    for channel in channels:
                        message_content = self._generate_scheduled_message(reminder, recipient, unit)
                        
                        # Create ReminderLog entry
                        ReminderLog.objects.create(
                            reminder=reminder,
                            recipient=recipient,
                            unit=unit,
                            channel=channel,
                            message_content=message_content,
                            delivery_status='sent',
                            sent_at=datetime.now()
                        )
                        reminder_logs_count += 1
                        logs_created += 1
                
                # Update reminder tracking
                reminder.last_sent = datetime.now()
                reminder.total_sent += reminder_logs_count
                reminder.save()
                
                processed_count += 1
            
            return Response({
                'success': True,
                'message': f'Processed {processed_count} scheduled reminders, created {logs_created} logs',
                'data': {
                    'processed_reminders': processed_count,
                    'logs_created': logs_created
                }
            }, status=200)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)
    
    def _get_scheduled_recipients(self, reminder):
        """Get recipients for scheduled reminders"""
        from user.models import Member
        
        recipients = []
        
        if reminder.audience in ['All Towers', 'All Residents']:
            recipients = list(Member.objects.filter(resident__isnull=False).distinct())
        elif reminder.audience == 'Specific Tower':
            if reminder.specific_target:
                recipients = list(Member.objects.filter(
                    resident__unit__tower__tower_name__icontains=reminder.specific_target
                ).distinct())
        elif reminder.audience == 'Due Only':
            # Get residents with active service fees but incomplete payments (not overdue)
            from django.utils import timezone
            from django.db.models import Q
            
            today = timezone.now().date()
            recipients = list(Member.objects.filter(
                Q(resident__isnull=False) &
                (
                    # Have active service fees via unit or tower
                    Q(resident__unit__service_fees__is_active=True) |
                    Q(resident__unit__floor__tower__service_fees__is_active=True)
                )
            ).exclude(
                # Exclude fully paid
                service_fee_management_payments__service_status='paid'
            ).exclude(
                # Exclude overdue (due date passed)
                service_fee_management_payments__due_date__lt=today
            ).distinct())
        elif reminder.audience == 'Overdue Only':
            # Get residents with overdue service fees
            from django.utils import timezone
            from django.db.models import Q
            
            today = timezone.now().date()
            recipients = list(Member.objects.filter(
                Q(resident__isnull=False) &
                (
                    # Have active service fees
                    Q(resident__unit__service_fees__is_active=True) |
                    Q(resident__unit__floor__tower__service_fees__is_active=True)
                ) &
                (
                    # Either marked as overdue or due date has passed
                    Q(service_fee_management_payments__service_status='overdue') |
                    Q(service_fee_management_payments__due_date__lt=today,
                      service_fee_management_payments__service_status__in=['due', 'partial'])
                )
            ).exclude(
                service_fee_management_payments__service_status='paid'
            ).distinct())
        elif reminder.audience == 'Paid Only':
            # Get residents who have paid service fees (service_status = 'paid')
            recipients = list(Member.objects.filter(
                Q(resident__isnull=False) &
                Q(service_fee_management_payments__service_status='paid')
            ).distinct())
        
        return recipients
    
    def _generate_scheduled_message(self, reminder, recipient, unit=None):
        """Generate message content for scheduled reminders"""
        message = reminder.message_preview
        
        # Replace placeholders
        message = message.replace('{recipient_name}', recipient.full_name or recipient.user.username)
        
        if unit:
            message = message.replace('{tower_name}', unit.tower.tower_name if unit.tower else 'Your Tower')
            message = message.replace('{unit_number}', unit.unit_name)
        else:
            message = message.replace('{tower_name}', 'Your Tower')
            message = message.replace('{unit_number}', 'Your Unit')
        
        # Add current date
        from datetime import datetime
        message = message.replace('{current_date}', datetime.now().strftime('%d %b %Y'))
        
        return message


class ReminderTestView(APIView):
    """
    Comprehensive test endpoint for Reminder functionality
    Test scheduler status, create test reminders, send test reminders, view logs
    """
    permission_classes = [AllowAny]  # Allow testing without authentication
    
    def get(self, request):
        """
        Test reminder functionality and view logs
        
        Query params:
        - action: 'status' | 'logs' | 'test_send' | 'scheduler_info'
        - reminder_id: ID of reminder to test (for test_send)
        """
        try:
            from .models import Reminder, ReminderLog, ServiceFeePayment
            from .reminder_scheduler import get_scheduler
            from django.utils import timezone
            
            action = request.query_params.get('action', 'status')
            
            # ==================== SCHEDULER STATUS ====================
            if action == 'status':
                scheduler = get_scheduler()
                
                # Get reminder statistics
                total_reminders = Reminder.objects.count()
                active_reminders = Reminder.objects.filter(status='Active').count()
                scheduled_reminders = Reminder.objects.filter(
                    reminder_type='Scheduled',
                    status='Active'
                ).count()
                
                # Get recent logs
                recent_logs = ReminderLog.objects.select_related(
                    'reminder', 'recipient', 'unit'
                ).order_by('-sent_at')[:10]
                
                logs_data = []
                for log in recent_logs:
                    logs_data.append({
                        'id': log.id,
                        'reminder_name': log.reminder.reminder_name,
                        'recipient_name': log.recipient.full_name if log.recipient else 'N/A',
                        'unit_name': log.unit.unit_name if log.unit else 'N/A',
                        'channel': log.channel,
                        'delivery_status': log.delivery_status,
                        'sent_at': log.sent_at.strftime('%Y-%m-%d %H:%M:%S') if log.sent_at else None,
                        'error_message': log.error_message
                    })
                
                return Response({
                    'success': True,
                    'message': 'Reminder system status',
                    'data': {
                        'scheduler': {
                            'running': scheduler.running,
                            'check_interval_seconds': scheduler.check_interval,
                            'check_interval_display': f'{scheduler.check_interval // 60} minutes'
                        },
                        'statistics': {
                            'total_reminders': total_reminders,
                            'active_reminders': active_reminders,
                            'scheduled_reminders': scheduled_reminders,
                            'total_logs': ReminderLog.objects.count(),
                            'logs_today': ReminderLog.objects.filter(
                                sent_at__date=timezone.now().date()
                            ).count()
                        },
                        'recent_logs': logs_data
                    }
                }, status=200)
            
            # ==================== VIEW ALL LOGS ====================
            elif action == 'logs':
                reminder_id = request.query_params.get('reminder_id')
                limit = int(request.query_params.get('limit', 50))
                
                logs_query = ReminderLog.objects.select_related(
                    'reminder', 'recipient', 'unit'
                ).order_by('-sent_at')
                
                if reminder_id:
                    logs_query = logs_query.filter(reminder_id=reminder_id)
                
                logs = logs_query[:limit]
                
                logs_data = []
                for log in logs:
                    logs_data.append({
                        'id': log.id,
                        'reminder_id': log.reminder.id,
                        'reminder_name': log.reminder.reminder_name,
                        'reminder_type': log.reminder.reminder_type,
                        'recipient_id': log.recipient.id if log.recipient else None,
                        'recipient_name': log.recipient.full_name if log.recipient else 'N/A',
                        'unit_id': log.unit.id if log.unit else None,
                        'unit_name': log.unit.unit_name if log.unit else 'N/A',
                        'tower_name': log.unit.floor.tower.tower_name if log.unit and log.unit.floor and log.unit.floor.tower else 'N/A',
                        'channel': log.channel,
                        'message_content': log.message_content[:100] + '...' if len(log.message_content) > 100 else log.message_content,
                        'delivery_status': log.delivery_status,
                        'sent_at': log.sent_at.strftime('%Y-%m-%d %H:%M:%S') if log.sent_at else None,
                        'delivered_at': log.delivered_at.strftime('%Y-%m-%d %H:%M:%S') if log.delivered_at else None,
                        'error_message': log.error_message
                    })
                
                return Response({
                    'success': True,
                    'message': f'Retrieved {len(logs_data)} reminder logs',
                    'data': {
                        'logs': logs_data,
                        'count': len(logs_data),
                        'total_count': logs_query.count()
                    }
                }, status=200)
            
            # ==================== TEST SEND ====================
            elif action == 'test_send':
                reminder_id = request.query_params.get('reminder_id')
                
                if not reminder_id:
                    return Response({
                        'success': False,
                        'message': 'reminder_id is required for test_send action'
                    }, status=400)
                
                try:
                    reminder = Reminder.objects.get(id=reminder_id)
                except Reminder.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': f'Reminder with ID {reminder_id} not found'
                    }, status=404)
                
                # Get recipients based on audience
                from .views import ReminderSendView
                send_view = ReminderSendView()
                recipients = send_view._get_reminder_recipients(reminder)
                
                # Get channels
                channels = reminder.channels_active
                
                logs_created = 0
                
                # Send to each recipient via each channel
                for recipient in recipients[:5]:  # Limit to 5 recipients for testing
                    unit = None
                    try:
                        resident = recipient.resident.first()
                        if resident:
                            unit = resident.unit
                    except:
                        pass
                    
                    for channel in channels:
                        message_content = send_view._generate_message_content(reminder, recipient, unit)
                        
                        # Create log entry
                        ReminderLog.objects.create(
                            reminder=reminder,
                            recipient=recipient,
                            unit=unit,
                            channel=channel,
                            message_content=message_content,
                            delivery_status='sent',
                            sent_at=timezone.now()
                        )
                        logs_created += 1
                
                # Update reminder stats
                reminder.last_sent = timezone.now()
                reminder.total_sent += logs_created
                reminder.save()
                
                return Response({
                    'success': True,
                    'message': f'Test reminder sent to {min(len(recipients), 5)} recipients via {len(channels)} channels',
                    'data': {
                        'reminder_id': reminder.id,
                        'reminder_name': reminder.reminder_name,
                        'recipients_count': len(recipients),
                        'recipients_sent': min(len(recipients), 5),
                        'channels': channels,
                        'logs_created': logs_created,
                        'total_sent': reminder.total_sent,
                        'last_sent': reminder.last_sent.strftime('%Y-%m-%d %H:%M:%S')
                    }
                }, status=200)
            
            # ==================== SCHEDULER INFO ====================
            elif action == 'scheduler_info':
                scheduler = get_scheduler()
                
                # Get active scheduled reminders
                scheduled_reminders = Reminder.objects.filter(
                    reminder_type='Scheduled',
                    status='Active',
                    email=True
                )
                
                reminders_data = []
                for reminder in scheduled_reminders:
                    reminders_data.append({
                        'id': reminder.id,
                        'reminder_name': reminder.reminder_name,
                        'send_when': reminder.send_when,
                        'audience': reminder.audience,
                        'channels': reminder.channels_active,
                        'total_sent': reminder.total_sent,
                        'last_sent': reminder.last_sent.strftime('%Y-%m-%d %H:%M:%S') if reminder.last_sent else None
                    })
                
                # Get unpaid/partial billings count
                unpaid_count = ServiceFeePayment.objects.exclude(
                    service_status='paid'
                ).count()
                
                return Response({
                    'success': True,
                    'message': 'Scheduler information',
                    'data': {
                        'scheduler': {
                            'running': scheduler.running,
                            'check_interval': scheduler.check_interval,
                            'check_interval_display': f'{scheduler.check_interval // 60} minutes'
                        },
                        'active_scheduled_reminders': reminders_data,
                        'active_reminders_count': len(reminders_data),
                        'unpaid_billings_count': unpaid_count,
                        'current_time': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
                }, status=200)
            
            else:
                return Response({
                    'success': False,
                    'message': f'Invalid action: {action}. Valid actions: status, logs, test_send, scheduler_info'
                }, status=400)
                
        except Exception as e:
            import traceback
            return Response({
                'success': False,
                'message': f'Error in reminder test: {str(e)}',
                'traceback': traceback.format_exc()
            }, status=500)
    
    def post(self, request):
        """
        Create a test reminder
        
        Body:
        {
            "reminder_name": "Test Reminder",
            "reminder_type": "Scheduled",
            "status": "Active",
            "send_when": ["1 day before due"],
            "email": true,
            "audience": "All Towers",
            "message_preview": "Test message"
        }
        """
        try:
            from .models import Reminder
            from .serializers import ReminderCreateSerializer
            
            serializer = ReminderCreateSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                reminder = serializer.save()
                
                return Response({
                    'success': True,
                    'message': 'Test reminder created successfully',
                    'data': {
                        'id': reminder.id,
                        'reminder_name': reminder.reminder_name,
                        'reminder_type': reminder.reminder_type,
                        'status': reminder.status,
                        'send_when': reminder.send_when,
                        'channels': reminder.channels_active,
                        'audience': reminder.audience
                    }
                }, status=201)
            else:
                return Response({
                    'success': False,
                    'message': 'Validation error',
                    'errors': serializer.errors
                }, status=400)
                
        except Exception as e:
            import traceback
            return Response({
                'success': False,
                'message': f'Error creating test reminder: {str(e)}',
                'traceback': traceback.format_exc()
            }, status=500)


# ================================
# SSLCommerz Payment Gateway Views
# ================================

class SSLCommerzPaymentInitView(APIView):
    """
    Initialize SSLCommerz payment session
    """
    permission_classes = [AllowAny]  # Can be changed to IsAuthenticated if needed
    
    def post(self, request):
        """
        Initialize payment with SSLCommerz
        
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
            "customer_address": "Dhaka, Bangladesh"
        }
        """
        try:
            from .utils.sslcommerz_utils import get_payment_gateway, generate_payment_urls
            import uuid
            
            
            # Extract payment data
            unit_id = request.data.get('unit_id')
            service_fee_id = request.data.get('service_fee_id')
            amount = request.data.get('amount')
            service_period_month = request.data.get('service_period_month')
            service_period_year = request.data.get('service_period_year')
            selected_payments = request.data.get('selected_payments', [])  # Array of selected months
            
            
            # Customer information
            customer_name = request.data.get('customer_name', 'Customer')
            customer_email = request.data.get('customer_email', 'customer@example.com')
            customer_phone = request.data.get('customer_phone', '01700000000')
            customer_address = request.data.get('customer_address', 'Dhaka')
            
            # Validate required fields
            if not all([unit_id, service_fee_id, amount, service_period_month, service_period_year]):
                return Response({
                    'success': False,
                    'message': 'Missing required fields: unit_id, service_fee_id, amount, service_period_month, service_period_year'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Convert IDs to integers to ensure type safety
            try:
                unit_id = int(unit_id)
                service_fee_id = int(service_fee_id)
                service_period_month = int(service_period_month)
                service_period_year = int(service_period_year)
            except (ValueError, TypeError) as e:
                return Response({
                    'success': False,
                    'message': f'Invalid data types for unit_id, service_fee_id, or service period: {str(e)}'
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
            
            # Generate base transaction ID for grouping related payments
            import random
            numeric_suffix = "".join([str(random.randint(0, 9)) for _ in range(10)])
            base_transaction_id = f"SSLC-{numeric_suffix}"
            
            # Determine which months to create payments for
            payment_months = []
            if selected_payments and len(selected_payments) > 0:
                print(f"\n💳 SSLCommerz Init - Processing {len(selected_payments)} selected payments")
                
                # CRITICAL: Sort by date - OLDEST FIRST to ensure sequential payment
                # This ensures June is paid before July, etc.
                sorted_payments = sorted(
                    selected_payments,
                    key=lambda x: (x.get('year', 9999), x.get('month', 99))
                )
                
                print(f"📅 Sorted payments (oldest first): {[(p.get('month'), p.get('year')) for p in sorted_payments]}")
                
                for idx, payment_data in enumerate(sorted_payments):
                    month = payment_data.get('month')
                    year = payment_data.get('year')
                    frontend_amount = payment_data.get('amount', 0)
                    
                    print(f"\n🔍 Processing payment {idx + 1}/{len(sorted_payments)}: {month}/{year}")
                    print(f"   Frontend amount: {frontend_amount}")
                    
                    # IMPORTANT: Recalculate actual remaining amount by checking existing completed payments
                    # Don't trust frontend's due_amount as it might be stale
                    try:
                        # Use the new validation function
                        can_pay, actual_remaining, total_paid, fee_amount = validate_payment_eligibility(
                            unit_id, service_fee_id, month, year
                        )
                        
                        print(f"   Validation result: can_pay={can_pay}, remaining={actual_remaining}")
                        
                        # Only add if there's remaining amount to pay
                        if can_pay and actual_remaining > 0:
                            payment_months.append({
                                'month': month,
                                'year': year,
                                'due_amount': actual_remaining  # Use recalculated amount
                            })
                            print(f"   ✅ Added to payment_months with amount: {actual_remaining}")
                        else:
                            print(f"   ❌ Skipped - already fully paid or no remaining amount")
                            
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        print(f"   ⚠️ Exception during validation - using frontend amount as fallback")
                        # Fallback to frontend amount if calculation fails
                        payment_months.append({
                            'month': month,
                            'year': year,
                            'due_amount': payment_data.get('amount', 0)
                        })
                
                print(f"\n📊 Final payment_months count: {len(payment_months)}")
                if payment_months:
                    print(f"   Months to process: {[(p['month'], p['year'], p['due_amount']) for p in payment_months]}")

            else:
                # Fallback to single month
                # Also recalculate for single month
                try:
                    # Use the new validation function
                    can_pay, actual_remaining, total_paid, fee_amount = validate_payment_eligibility(
                        unit_id, service_fee_id, service_period_month, service_period_year
                    )
                    
                    if can_pay and actual_remaining > 0:
                        payment_months.append({
                            'month': service_period_month,
                            'year': service_period_year,
                            'due_amount': actual_remaining
                        })
                    else:
                        return Response({
                            'success': False,
                            'message': f'Payment for {service_period_month}/{service_period_year} is already fully paid.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                        
                except Exception as e:
                    payment_months.append({
                        'month': service_period_month,
                        'year': service_period_year,
                        'due_amount': amount
                    })
            
            # Check if we have any valid payment months after recalculation
            if not payment_months or len(payment_months) == 0:
                return Response({
                    'success': False,
                    'message': 'All selected months are already fully paid. No payment needed.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # CRITICAL: Distribute the paid amount across selected months (OLDEST FIRST)
            # Example scenario (as user described):
            # - June: Already paid 7000 TK, needs 3000 TK more (total fee: 10000 TK)
            # - July: Needs 10000 TK (total fee: 10000 TK)
            # - User pays: 8000 TK total
            # Expected result:
            #   → June gets 3000 TK → service_status becomes "paid" ✅
            #   → July gets 5000 TK → service_status becomes "partial" ⚠️
            
            
            remaining_amount = float(amount)
            for idx, payment_month_data in enumerate(payment_months, 1):
                due_amount = float(payment_month_data.get('due_amount', 0))
                month = payment_month_data.get('month')
                year = payment_month_data.get('year')
                
                if remaining_amount >= due_amount:
                    # Can pay FULL amount for this month → service_status will be "paid"
                    payment_month_data['amount'] = due_amount
                    remaining_amount -= due_amount
                elif remaining_amount > 0:
                    # PARTIAL payment for this month → service_status will be "partial"
                    payment_month_data['amount'] = remaining_amount
                    shortfall = due_amount - remaining_amount
                    remaining_amount = 0
                else:
                    # No money left for this month
                    payment_month_data['amount'] = 0
            
            # Create payment records for all selected months (even if amount is 0 for tracking)
            created_payments = []
            for index, payment_month_data in enumerate(payment_months):
                month = payment_month_data['month']
                year = payment_month_data['year']
                month_amount = payment_month_data['amount']
                
                # Skip creating payment record if amount is 0
                if month_amount == 0:
                    continue
                
                # Create unique transaction ID for each payment record
                # Format: SSLC-XXXXXXXXXXXX-001, SSLC-XXXXXXXXXXXX-002, etc.
                transaction_id = f"{base_transaction_id}-{str(index + 1).zfill(3)}"
                
                # Check if a payment record already exists for this month
                # For partial payments: reuse the existing record instead of creating new
                # Query ServiceFeePayment directly (not through billing relationship)
                existing_payment = ServiceFeePayment.objects.filter(
                    unit_id=unit_id,
                    service_fee_id=service_fee_id,
                    service_period_month=month,
                    service_period_year=year,
                    payment_status__in=['pending', 'failed', 'cancelled', 'partial']
                ).first()
                
                if existing_payment:
                    print(f"   ♻️ Reusing existing payment record: ID={existing_payment.id} for {month}/{year}")
                    # Don't delete - we'll update this record when payment completes
                    payment = existing_payment
                    # Update the payment record to pending status for this new attempt
                    payment.payment_status = 'pending'
                    payment.save()
                    created_payments.append(payment)
                    continue  # Skip creating new record
                
                # Double-check if month is fully paid
                # Check if there's a completed payment with service_status='paid'
                fully_paid_payment = ServiceFeePayment.objects.filter(
                    unit_id=unit_id,
                    service_fee_id=service_fee_id,
                    service_period_month=month,
                    service_period_year=year,
                    payment_status='completed',
                    service_status='paid'
                ).first()
                
                if fully_paid_payment:
                    print(f"   ⏭️ Skipping {month}/{year} - already fully paid (payment ID: {fully_paid_payment.id})")
                    continue  # Skip this month, move to next
                
                print(f"   ✅ Month {month}/{year} is not fully paid - proceeding")
                
                print(f"   ✅ Creating payment record for {month}/{year}")
                
                # Create new pending payment record for this month
                # IMPORTANT: amount should be the ORIGINAL service fee amount, not the partial payment amount
                # This matches the manual payment behavior where amount field stays constant
                # Note: ServiceFeeBilling will be created later when payment is completed
                payment = ServiceFeePayment.objects.create(
                    service_fee_id=service_fee.id,
                    unit_id=unit.id,
                    resident_id=unit.primary_resident_id if hasattr(unit, 'primary_resident_id') else None,
                    amount=service_fee.fee_amount,  # Use FULL service fee amount, not partial payment
                    currency='BDT',
                    payment_status='pending',
                    service_period_month=month,
                    service_period_year=year,
                    due_date=f"{year}-{month:02d}-{min(service_fee.due_day, 28):02d}",
                )
                
                print(f"   ✅ Payment record created: id={payment.id}, amount={payment.amount}")
                created_payments.append(payment)
            
            # Verify we created at least one payment
            if not created_payments or len(created_payments) == 0:
                return Response({
                    'success': False,
                    'message': 'No payment records could be created. All selected months may already be fully paid.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Use the first payment for SSL Commerce initialization
            payment = created_payments[0]
            # Generate callback URLs using base transaction ID
            callback_urls = generate_payment_urls(request, base_transaction_id)
            
            # CRITICAL: Store ALL payment IDs that were created in this transaction
            # This ensures we ONLY process the selected months, not all pending payments
            payment_ids_str = ','.join([str(p.id) for p in created_payments])
            print(f"📋 Storing payment IDs for this transaction: {payment_ids_str}")
            
            # CREATE TRANSACTION MAPPING
            # SSLCommerz sandbox doesn't reliably return value_a/b/c in callbacks
            # So we store a server-side mapping of transaction_id -> payment_ids
            from .models import SSLCommerzTransactionMapping
            try:
                mapping = SSLCommerzTransactionMapping.create_mapping(
                    transaction_id=base_transaction_id,
                    payment_ids=[p.id for p in created_payments],
                    unit_id=unit_id,
                    service_fee_id=service_fee_id,
                    amount=float(amount)
                )
                print(f"✅ Created transaction mapping: {base_transaction_id} -> {payment_ids_str}")
                print(f"   Mapping expires at: {mapping.expires_at}")
            except Exception as mapping_error:
                print(f"⚠️  Failed to create transaction mapping: {str(mapping_error)}")
                # Continue anyway - we'll try value_a as fallback
            
            # Prepare payment data for SSLCommerz
            payment_data = {
                'amount': float(amount),
                'currency': 'BDT',
                'transaction_id': base_transaction_id,  # Use base transaction ID for SSL Commerce
                'customer_name': customer_name,
                'customer_email': customer_email,
                'customer_phone': customer_phone,
                'customer_address': customer_address,
                'customer_city': 'Dhaka',
                'customer_postcode': '1000',
                'customer_country': 'Bangladesh',
                'product_name': f'Service Fee - {unit.unit_name}',
                'product_category': 'Service Fee',
                'product_profile': 'general',
                'success_url': callback_urls['success_url'],
                'fail_url': callback_urls['fail_url'],
                'cancel_url': callback_urls['cancel_url'],
                'ipn_url': callback_urls['ipn_url'],
                'value_a': payment_ids_str,  # Store ALL payment IDs (comma-separated)
                'value_b': str(unit_id),
                'value_c': str(service_fee_id),
                'value_d': f"{service_period_month}-{service_period_year}"
            }
            
            # Initialize payment with SSLCommerz
            gateway = get_payment_gateway()
            result = gateway.init_payment(payment_data)
            
            if result.get('success'):
                # Audit trail
                try:
                    create_audit_trail(
                        member=request.user.member if request.user.is_authenticated else None,
                        event_type='PAYMENT_CREATED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=payment.id,
                        new_data=None,
                        old_data=None,
                        description=f"Payment session created for transaction {transaction_id}"
                    )
                except Exception as e:
                    pass
                
                return Response({
                    'success': True,
                    'gateway_url': result['gateway_url'],
                    'session_key': result['session_key'],
                    'transaction_id': base_transaction_id,
                    'payment_id': payment.id,
                    'message': 'Payment session created successfully'
                }, status=status.HTTP_200_OK)
            else:
                # Update payment status to failed
                payment.payment_status = 'failed'
                # Note: ServiceFeePayment doesn't have a notes field
                payment.save()
                
                return Response({
                    'success': False,
                    'message': result.get('message', 'Payment initialization failed'),
                    'error': result.get('error')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            import traceback
            
            return Response({
                'success': False,
                'message': f'Payment initialization error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SSLCommerzPaymentSuccessView(APIView):
    """
    Handle successful payment callback from SSLCommerz
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Handle POST callback from SSLCommerz on successful payment
        """
        try:
            from .utils.sslcommerz_utils import get_payment_gateway
            from django.utils import timezone
            
            # Log all incoming callback data for debugging
            print(f"\n{'='*80}")
            print(f"🔔 SSLCOMMERZ CALLBACK RECEIVED")
            print(f"{'='*80}")
            print(f"Request data: {request.data}")
            print(f"Request method: {request.method}")
            print(f"Request headers: {dict(request.headers)}")
            print(f"{'='*80}")
            
            # Extract callback data
            val_id = request.data.get('val_id')
            tran_id = request.data.get('tran_id')
            amount = request.data.get('amount')
            card_type = request.data.get('card_type')
            store_amount = request.data.get('store_amount')
            card_no = request.data.get('card_no')
            bank_tran_id = request.data.get('bank_tran_id')
            status_msg = request.data.get('status')
            tran_date = request.data.get('tran_date')
            currency = request.data.get('currency')
            card_issuer = request.data.get('card_issuer')
            card_brand = request.data.get('card_brand')
            card_issuer_country = request.data.get('card_issuer_country')
            value_a = request.data.get('value_a')  # Payment ID
            
            if not all([val_id, tran_id, amount]):
                return Response({
                    'success': False,
                    'message': 'Missing required callback parameters'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find payment record with this transaction ID
            base_tran_id = tran_id
            payment_id = value_a  # Payment ID stored in value_a during initialization
            
            print(f"\n{'='*80}")
            print(f"🔍 SEARCHING FOR PAYMENT RECORDS")
            print(f"{'='*80}")
            print(f"Transaction ID from SSLCommerz: {base_tran_id}")
            print(f"Payment IDs from value_a: {payment_id}")
            print(f"⚠️  IMPORTANT: Will ONLY process these specific payment IDs")
            print(f"⚠️  Other pending payments will NOT be processed")
            
            # CRITICAL: value_a contains ALL payment IDs for this transaction (comma-separated)
            # We must ONLY process these specific payments, not all pending payments
            payments = None
            
            # METHOD 1: Check transaction mapping table (primary method)
            # SSLCommerz sandbox doesn't reliably return value_a/b/c, so we use server-side mapping
            from .models import SSLCommerzTransactionMapping
            try:
                payment_ids_from_mapping = SSLCommerzTransactionMapping.get_payment_ids(base_tran_id)
                if payment_ids_from_mapping:
                    print(f"   ✅ Found transaction mapping for {base_tran_id}")
                    print(f"   📋 Payment IDs from mapping: {payment_ids_from_mapping}")
                    
                    payments = ServiceFeePayment.objects.filter(
                        id__in=payment_ids_from_mapping,
                        payment_status='pending'
                    ).order_by('service_period_year', 'service_period_month')
                    
                    if payments.exists():
                        print(f"   ✅ Found {payments.count()} payment(s) using transaction mapping")
                    else:
                        print(f"   ⚠️  Mapping found but no pending payments with those IDs")
                        payments = None
                else:
                    print(f"   ⚠️  No transaction mapping found for {base_tran_id}")
            except Exception as mapping_error:
                print(f"   ❌ Error checking transaction mapping: {str(mapping_error)}")
            
            # METHOD 2: Try value_a (fallback for production or if mapping failed)
            if not payments or not payments.exists():
                if payment_id:
                    try:
                        # payment_id from value_a can be:
                        # 1. Single ID: "610"
                        # 2. Multiple IDs: "610,611,612"
                        payment_ids_str = str(payment_id).strip()
                    
                        if ',' in payment_ids_str:
                            # Multiple payment IDs - parse them
                            payment_ids = [int(pid.strip()) for pid in payment_ids_str.split(',') if pid.strip()]
                            print(f"   📋 Multiple payment IDs found: {payment_ids}")
                            
                            # Get ONLY these specific payment records
                            payments = ServiceFeePayment.objects.filter(
                                id__in=payment_ids,
                                payment_status='pending'
                            ).order_by('service_period_year', 'service_period_month')
                            
                            print(f"   ✅ Found {payments.count()} payments for this transaction")
                        else:
                            # Single payment ID
                            payment_id_int = int(payment_ids_str)
                            print(f"   📋 Single payment ID: {payment_id_int}")
                            
                            payments = ServiceFeePayment.objects.filter(
                                id=payment_id_int,
                                payment_status='pending'
                            )
                            
                            print(f"   ✅ Found payment: ID={payment_id_int}")
                    
                    except (ValueError, ServiceFeePayment.DoesNotExist) as e:
                        print(f"   ⚠️ Could not find payment by ID: {e}")
                        payments = None
            
            # FALLBACK: If value_a is empty or payment IDs not found, find payments by unit_id and service_fee_id
            # This handles cases where SSLCommerz doesn't return value_a in callback
            if not payments or not payments.exists():
                print(f"   ⚠️ value_a is empty or payment IDs not found, trying fallback")
                
                # Get unit_id and service_fee_id from value_b and value_c
                value_b = request.data.get('value_b')  # unit_id
                value_c = request.data.get('value_c')  # service_fee_id
                
                if value_b and value_c:
                    try:
                        unit_id = int(value_b)
                        service_fee_id = int(value_c)
                        print(f"   🔍 Searching for pending payments: unit_id={unit_id}, service_fee_id={service_fee_id}")
                        
                        # Find all pending payments for this unit and service fee
                        # These should be the payments created for this transaction
                        # Note: This assumes payments were created recently and are still pending
                        payments = ServiceFeePayment.objects.filter(
                            unit_id=unit_id,
                            service_fee_id=service_fee_id,
                            payment_status='pending'
                        ).order_by('service_period_year', 'service_period_month', '-created_at')
                        
                        if payments.exists():
                            print(f"   ✅ Found {payments.count()} pending payment(s) for unit {unit_id}, service_fee {service_fee_id}")
                        else:
                            print(f"   ❌ No pending payments found for unit {unit_id}, service_fee {service_fee_id}")
                    except (ValueError, TypeError) as e:
                        print(f"   ⚠️ Could not parse unit_id or service_fee_id from value_b/value_c: {e}")
                        payments = None
                else:
                    print(f"   ⚠️ value_b (unit_id) or value_c (service_fee_id) not found in callback")
                    print(f"   value_b: {value_b}, value_c: {value_c}")
                    
                    # Last resort: Try to find by transaction ID pattern in billing records
                    # (in case billing records were already created somehow)
                    print(f"   🔍 Last resort: Searching for payments with billing records matching transaction ID: {base_tran_id}")
                    payments = ServiceFeePayment.objects.filter(
                        billing_records__transaction_id__startswith=base_tran_id,
                        payment_status='pending'
                    ).distinct().order_by('service_period_year', 'service_period_month')
                    
                    if payments.exists():
                        print(f"   ✅ Found {payments.count()} payment(s) by transaction ID pattern")
                    else:
                        print(f"   ❌ ERROR: Could not find payment records by any method")
                        print(f"   This transaction cannot be completed without valid payment records")
            
            print(f"   Found {payments.count() if payments else 0} payment record(s)")
            
            if not payments or not payments.exists():
                print(f"❌ No pending payment records found")
                return Response({
                    'success': False,
                    'message': f'Payment records not found for transaction {tran_id}'
                }, status=status.HTTP_404_NOT_FOUND)
            
            print(f"✅ Found {payments.count()} payment record(s):")
            for idx, p in enumerate(payments, 1):
                month = p.service_period_month if p.service_period_month else 0
                year = p.service_period_year if p.service_period_year else 0
                print(f"   {idx}. ID={p.id} | {month:02d}/{year} | {p.amount} TK | Status: {p.payment_status}")
            print(f"{'='*80}\n")
            
            # Get or create SSLCommerz payment method
            sslcommerz_method, created = PaymentMethod.objects.get_or_create(
                method_name='SSLCommerz',
                defaults={
                    'display_order': 5,
                    'description': 'SSLCommerz payment gateway',
                    'is_active': True
                }
            )
            
            # Update ALL payment records with this transaction ID (for multiple months)
            print(f"\n{'='*80}")
            print(f"🔄 UPDATING ALL PAYMENT RECORDS ATOMICALLY")
            print(f"{'='*80}")
            
            # Wrap in transaction for rollback on any failure
            from django.db import transaction
            from .utils.voucher_generator import create_payment_voucher
            
            with transaction.atomic():
                total_payment_amount = float(amount)
                remaining_payment_to_distribute = total_payment_amount
                completed_payments = []
                billing_records_to_voucher = []

                for idx, payment in enumerate(payments, 1):
                    # ... (Logic to calculate and update payment)
                    service_fee = ServiceFee.objects.get(id=payment.service_fee_id)
                    total_fee_amount = float(payment.amount)
                    
                    total_paid_from_billings = ServiceFeeBilling.objects.filter(
                        servicefeepaymentid=payment
                    ).aggregate(total=Sum('total_paid'))['total'] or 0
                    
                    amount_needed_for_month = total_fee_amount - float(total_paid_from_billings)
                    
                    if remaining_payment_to_distribute >= amount_needed_for_month:
                        current_transaction_amount = amount_needed_for_month
                        remaining_payment_to_distribute -= amount_needed_for_month
                    elif remaining_payment_to_distribute > 0:
                        current_transaction_amount = remaining_payment_to_distribute
                        remaining_payment_to_distribute = 0
                    else:
                        continue

                    # Update status
                    total_paid_for_month = float(total_paid_from_billings) + current_transaction_amount
                    if total_paid_for_month >= total_fee_amount:
                        payment.payment_status = 'completed'
                        payment.service_status = 'paid'
                        payment.remaining_amount = 0
                        payment.completion_date = timezone.now()
                    else:
                        payment.payment_status = 'pending'
                        payment.service_status = 'partial'
                        payment.remaining_amount = max(0, total_fee_amount - total_paid_for_month)

                    payment.payment_method_rel = sslcommerz_method
                    payment.save()

                    # Create billing record
                    from .models import generate_unique_sequential_id, ServiceFeeBilling
                    prefix_date = f"{payment.service_period_year}-{payment.service_period_month:02d}-"
                    
                    billing = ServiceFeeBilling.objects.create(
                        servicefeepaymentid=payment,
                        transaction_id=generate_unique_sequential_id(ServiceFeeBilling, 'transaction_id', f"TXN-{prefix_date}", 8),
                        billing_id=generate_unique_sequential_id(ServiceFeeBilling, 'billing_id', f"BILL-{prefix_date}", 5),
                        receipt_id=generate_unique_sequential_id(ServiceFeeBilling, 'receipt_id', f"RCP-{prefix_date}", 5),
                        billing_amount=service_fee.fee_amount,
                        total_paid=current_transaction_amount,
                        currency='BDT',
                        payment_method=sslcommerz_method,
                        payment_date=timezone.now(),
                        reference_number=bank_tran_id or tran_id,
                        notes=f"SSLCommerz Payment. Card: {card_type}, Bank Tran: {bank_tran_id}",
                        created_by=None
                    )
                    billing_records_to_voucher.append(billing)
                    completed_payments.append(payment)

                # Generate Voucher for the entire SSLCommerz transaction
                if billing_records_to_voucher:
                    # CRITICAL FIX: Calculate actual total cash from billing records instead of using payment input
                    # This ensures debit and credit sides match in the voucher
                    actual_total_cash = sum(float(b.total_paid) for b in billing_records_to_voucher)
                    print(f"   💰 Voucher Generation: total_payment_amount={total_payment_amount}, actual_total_cash={actual_total_cash}")
                    
                    voucher_result = create_payment_voucher(
                        billing_records=billing_records_to_voucher,
                        total_amount=actual_total_cash,  # Use actual cash allocated, not payment input
                        payment_method_id=sslcommerz_method.id,
                        member=None,
                        unit=payments[0].unit,
                        batch_receipt_id=tran_id,
                        notes=f"SSLCommerz Batch Payment: {tran_id}"
                    )
                    
                    if not voucher_result.get('success'):
                        raise Exception(f"Accounting Integration Failed: {voucher_result.get('message')}")
                    
                    print(f"   ✅ Batch Payment voucher created: {voucher_result.get('voucher_number')}")

            # Summary of all completed payments
            print(f"\n{'='*80}")
            print(f"✅ PAYMENT SUCCESS SUMMARY")
            print(f"{'='*80}")
            print(f"Total payments processed: {len(completed_payments)}")
            print(f"\nBreakdown:")
            for idx, p in enumerate(completed_payments, 1):
                p_month = p.service_period_month if p.service_period_month else 0
                p_year = p.service_period_year if p.service_period_year else 0
                p_status = p.service_status if p.service_status else 'unknown'
                status_emoji = "✅" if p_status == 'paid' else "⚠️"
                print(f"   {idx}. {p_month:02d}/{p_year}: {p.amount} TK → {p_status.upper()} {status_emoji}")
            print(f"{'='*80}\n")
            
            # Use the first payment for response data
            payment = completed_payments[0]
            
            # Return success response immediately
            response_data = {
                'success': True,
                'message': f'Payment completed successfully for {len(completed_payments)} month(s)',
                'transaction_id': tran_id,
                'payment_id': payment.id,
                'payment_status': payment.payment_status,
                'amount': str(payment.amount),
                'currency': payment.currency,
                'completed_payments': [
                    {
                        'id': p.id,
                        'month': p.service_period_month if p.service_period_month else None,
                        'year': p.service_period_year if p.service_period_year else None,
                        'amount': str(p.amount)
                    } for p in completed_payments
                ]
            }
            
            # Validate payment with SSLCommerz asynchronously (background task)
            try:
                from .utils.sslcommerz_utils import get_payment_gateway
                import threading
                
                def async_validation():
                    try:
                        gateway = get_payment_gateway()
                        # Use the actual SSLCommerz amount for validation (not the total amount)
                        sslcommerz_amount = float(amount)  # Amount from SSLCommerz callback
                        validation_result = gateway.validate_payment(val_id, tran_id, sslcommerz_amount)
                        
                        if not validation_result.get('success'):
                            # If validation fails, update ALL payment statuses
                            for payment in completed_payments:
                                payment.payment_status = 'failed'
                                # Payment validation failed - status updated
                                payment.save()
                            print(f"Payment validation failed for {tran_id}: {validation_result.get('message')}")
                    except Exception as e:
                        print(f"Async validation error: {str(e)}")
                
                # Start validation in background thread
                validation_thread = threading.Thread(target=async_validation)
                validation_thread.daemon = True
                validation_thread.start()
                
            except Exception as e:
                print(f"Error starting async validation: {str(e)}")
            
            # Create audit trail asynchronously
            try:
                def async_audit_trail():
                    try:
                        create_audit_trail(
                            member=None,
                            event_type='PAYMENT_UPDATED',
                            table_name='service_fee_management_servicefeegenerate',
                            row_id=payment.id,
                            new_data=None,
                            old_data=None,
                            description=f"Payment completed for transaction {tran_id}. Amount: {amount} {currency}"
                        )
                    except Exception as e:
                        pass
                
                audit_thread = threading.Thread(target=async_audit_trail)
                audit_thread.daemon = True
                audit_thread.start()
            except Exception as e:
                print(f"Error starting async audit trail: {str(e)}")
            
            # Create payment received notifications for admins (mobile app payment)
            # This ensures notifications work for both mobile app payments and web app payment recording
            try:
                from notifications.utils import (
                    create_service_fee_payment_received_notification,
                    create_community_member_payment_confirmation
                )
                
                # Consolidate SSLCommerz notifications to show total paid amount
                notif_amount = float(amount)
                representative_payment = completed_payments[0] if completed_payments else None
                
                if representative_payment:
                    # Get transaction ID for notification identity
                    notif_billing_id = None
                    if billing_records_to_voucher:
                        notif_billing_id = billing_records_to_voucher[0].id

                    # Create admin notification
                    create_service_fee_payment_received_notification(
                        payment=representative_payment,
                        payment_amount=notif_amount,
                        payment_method='SSLCommerz',
                        recorded_by=None,  # Mobile app payment, no admin recorder
                        transaction_id=notif_billing_id
                    )
                    
                    # Create community member confirmation notification
                    create_community_member_payment_confirmation(
                        payment=representative_payment,
                        payment_amount=notif_amount,
                        transaction_id=notif_billing_id
                    )
                    print(f"[SSLCommerz] ✅ Consolidated notifications created for {notif_amount}")
                
            except Exception as notif_error:
                # Log but don't fail - notifications are optional
                print(f"[SSLCommerz] Could not create consolidated payment notifications: {notif_error}")
                import traceback
                print(traceback.format_exc())
            
            # Send email for all completed payments
            # Note: SSLCommerz callbacks don't have sendEmail in request, so default to True
            try:
                def async_email_send():
                    try:
                        # Send email for each completed payment
                        for completed_payment in completed_payments:
                            try:
                                # Refresh payment to get latest data
                                completed_payment.refresh_from_db()
                                
                                # Get serialized payment data
                                serializer = ServiceFeePaymentSerializer(completed_payment)
                                payment_data = serializer.data
                                
                                # Always send email for SSLCommerz payments (default True)
                                send_email = True
                                
                                print(f"\n📧 Preparing email for payment ID: {completed_payment.id}")
                                
                                # Send email receipt
                                email_sent = send_payment_email_if_enabled(
                                    payment_obj=completed_payment,
                                    payment_data=payment_data,
                                    send_email=send_email,
                                    operation_type="SSLCommerz payment"
                                )
                                
                                if email_sent:
                                    print(f"   ✅ Email sent successfully for payment {completed_payment.id}")
                                else:
                                    print(f"   ❌ Email failed for payment {completed_payment.id}")
                                    
                            except Exception as payment_email_error:
                                import traceback
                                print(f"   ❌ Error sending email for payment {completed_payment.id}: {str(payment_email_error)}")
                                print(traceback.format_exc())
                                
                    except Exception as e:
                        import traceback
                        print(f"❌ Email sending thread error: {str(e)}")
                        print(traceback.format_exc())
                
                # Start email sending in background thread
                email_thread = threading.Thread(target=async_email_send)
                email_thread.daemon = True
                email_thread.start()
                print(f"📧 Email sending thread started for {len(completed_payments)} payment(s)")
                
            except Exception as e:
                import traceback
                print(f"❌ Error starting async email thread: {str(e)}")
                print(traceback.format_exc())
            
            return Response(response_data, status=status.HTTP_200_OK)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Payment processing error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SSLCommerzPaymentFailView(APIView):
    """
    Handle failed payment callback from SSLCommerz
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Handle POST callback from SSLCommerz on failed payment
        """
        try:
            tran_id = request.data.get('tran_id')
            status_msg = request.data.get('status')
            error_message = request.data.get('error')
            
            if not tran_id:
                return Response({
                    'success': False,
                    'message': 'Missing transaction ID'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find payment record by transaction_id (stored in billing_records)
            # transaction_id is stored in ServiceFeeBilling, not ServiceFeePayment
            payments = ServiceFeePayment.objects.filter(billing_records__transaction_id=tran_id).distinct()
            if not payments.exists():
                # Try partial match if exact match fails
                payments = ServiceFeePayment.objects.filter(billing_records__transaction_id__startswith=tran_id).distinct()
            
            if not payments.exists():
                return Response({
                    'success': False,
                    'message': f'Payment record not found for transaction {tran_id}'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get the first payment (should typically be only one)
            payment = payments.first()
            
            # Update payment status
            payment.payment_status = 'failed'
            # Payment failed - status updated
            payment.save()
            
            # Create audit trail
            try:
                create_audit_trail(
                    member=None,
                    event_type='PAYMENT_UPDATED',
                    table_name='service_fee_management_servicefeegenerate',
                    row_id=payment.id,
                    new_data=None,
                    old_data=None,
                    description=f"Payment failed for transaction {tran_id}. Error: {error_message or status_msg}"
                )
            except Exception as e:
                print(f"Audit trail error: {str(e)}")
            
            return Response({
                'success': False,
                'message': 'Payment failed',
                'transaction_id': tran_id,
                'error': error_message or status_msg
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error processing failed payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SSLCommerzPaymentCancelView(APIView):
    """
    Handle cancelled payment callback from SSLCommerz
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Handle POST callback from SSLCommerz on cancelled payment
        """
        try:
            tran_id = request.data.get('tran_id')
            status_msg = request.data.get('status')
            
            if not tran_id:
                return Response({
                    'success': False,
                    'message': 'Missing transaction ID'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find payment record by transaction_id (stored in billing_records)
            # transaction_id is stored in ServiceFeeBilling, not ServiceFeePayment
            payments = ServiceFeePayment.objects.filter(billing_records__transaction_id=tran_id).distinct()
            if not payments.exists():
                # Try partial match if exact match fails
                payments = ServiceFeePayment.objects.filter(billing_records__transaction_id__startswith=tran_id).distinct()
            
            if not payments.exists():
                return Response({
                    'success': False,
                    'message': f'Payment record not found for transaction {tran_id}'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get the first payment (should typically be only one)
            payment = payments.first()
            
            # Update payment status
            payment.payment_status = 'cancelled'
            # Payment cancelled - status updated
            payment.save()
            
            # Create audit trail
            try:
                create_audit_trail(
                    member=None,
                    event_type='PAYMENT_UPDATED',
                    table_name='service_fee_management_servicefeegenerate',
                    row_id=payment.id,
                    new_data=None,
                    old_data=None,
                    description=f"Payment cancelled for transaction {tran_id}"
                )
            except Exception as e:
                print(f"Audit trail error: {str(e)}")
            
            return Response({
                'success': True,
                'message': 'Payment cancelled',
                'transaction_id': tran_id,
                'payment_status': payment.payment_status
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error processing cancelled payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SSLCommerzPaymentManualCancelView(APIView):
    """
    Handle manual cancellation when user backs out from payment gateway
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Manually cancel a pending payment when user backs out
        
        Expected payload:
        {
            "transaction_id": "SSLC-BA6796A25035"
        }
        """
        try:
            tran_id = request.data.get('transaction_id')
            
            if not tran_id:
                return Response({
                    'success': False,
                    'message': 'Missing transaction ID'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find payment record by transaction_id (stored in billing_records)
            # transaction_id is stored in ServiceFeeBilling, not ServiceFeePayment
            payments = ServiceFeePayment.objects.filter(billing_records__transaction_id=tran_id).distinct()
            if not payments.exists():
                # Try partial match if exact match fails
                payments = ServiceFeePayment.objects.filter(billing_records__transaction_id__startswith=tran_id).distinct()
            
            if not payments.exists():
                # If payment not found, consider it already cleaned up
                return Response({
                    'success': True,
                    'message': 'Payment record not found or already cleaned up'
                }, status=status.HTTP_200_OK)
            
            # Get the first payment (should typically be only one)
            payment = payments.first()
            
            # Only cancel if payment is still pending
            if payment.payment_status == 'pending':
                # Delete the pending payment record to allow new payment attempts
                payment.delete()
                
                # Create audit trail
                try:
                    create_audit_trail(
                        member=None,
                        event_type='PAYMENT_DELETED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=payment.id,
                        new_data=None,
                        old_data=None,
                        description=f"User backed out from payment gateway for transaction {tran_id}"
                    )
                except Exception as e:
                    pass
                
                return Response({
                    'success': True,
                    'message': 'Pending payment cancelled and record deleted',
                    'transaction_id': tran_id
                }, status=status.HTTP_200_OK)
            else:
                # Payment already processed, don't delete
                return Response({
                    'success': False,
                    'message': f'Cannot cancel payment with status: {payment.payment_status}',
                    'payment_status': payment.payment_status
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error cancelling payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SSLCommerzCallbackTestView(APIView):
    """
    Test endpoint to verify callback URLs are working
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        Test GET request to callback URL
        """
        from django.utils import timezone
        return Response({
            'success': True,
            'message': 'Callback URL is accessible',
            'timestamp': timezone.now().isoformat(),
            'method': 'GET'
        })
    
    def post(self, request):
        """
        Test POST request to callback URL
        """
        from django.utils import timezone
        return Response({
            'success': True,
            'message': 'Callback URL is accessible',
            'timestamp': timezone.now().isoformat(),
            'method': 'POST',
            'received_data': request.data
        })


class SSLCommerzPaymentIPNView(APIView):
    """
    Handle IPN (Instant Payment Notification) from SSLCommerz
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Handle IPN POST from SSLCommerz
        This is called by SSLCommerz after payment processing
        """
        try:
            from .utils.sslcommerz_utils import get_payment_gateway
            from django.utils import timezone
            
            # Log all incoming IPN data for debugging
            print(f"\n{'='*80}")
            print(f"🔔 SSLCOMMERZ IPN RECEIVED")
            print(f"{'='*80}")
            print(f"Request data: {request.data}")
            print(f"Request method: {request.method}")
            print(f"Request headers: {dict(request.headers)}")
            print(f"{'='*80}")
            
            # Extract IPN data
            val_id = request.data.get('val_id')
            tran_id = request.data.get('tran_id')
            amount = request.data.get('amount')
            status_msg = request.data.get('status')
            
            # Verify hash
            gateway = get_payment_gateway()
            if not gateway.verify_hash(request.data):
                return Response({
                    'success': False,
                    'message': 'Invalid hash verification'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find payment record with this transaction ID
            base_tran_id = tran_id
            # Look for payments by transaction_id (stored in billing_records)
            # transaction_id is stored in ServiceFeeBilling, not ServiceFeePayment
            payments = ServiceFeePayment.objects.filter(billing_records__transaction_id=base_tran_id).distinct()
            if not payments.exists():
                payments = ServiceFeePayment.objects.filter(billing_records__transaction_id__startswith=base_tran_id).distinct()
            if not payments.exists():
                return Response({
                    'success': False,
                    'message': f'Payment records not found for transaction {tran_id}'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Use the first payment for validation
            payment = payments.first()
            # Use the actual SSLCommerz amount for validation (not the total amount)
            sslcommerz_amount = float(amount)  # Amount from SSLCommerz IPN
            
            # Validate payment with SSLCommerz amount
            validation_result = gateway.validate_payment(val_id, tran_id, sslcommerz_amount)
            
            if validation_result.get('success') and status_msg in ['VALID', 'VALIDATED']:
                # Update ALL payments if not already completed
                for payment in payments:
                    if payment.payment_status != 'completed':
                        payment.payment_status = 'completed'
                        payment.completion_date = timezone.now()
                        
                        # Get period info for notes
                        p_month = payment.service_period_month if payment.service_period_month else 0
                        p_year = payment.service_period_year if payment.service_period_year else 0
                        # Payment validated via IPN - status updated
                        
                        # CRITICAL: Calculate service_status based on TOTAL payments (same logic as success view)
                        try:
                            # Check if billing exists to get period information
                            service_fee = ServiceFee.objects.get(id=payment.service_fee_id)
                            total_fee_amount = float(service_fee.fee_amount)
                            
                            # Get period from payment
                            period_month = payment.service_period_month
                            period_year = payment.service_period_year
                            
                            # Get all OTHER completed payments for this period (excluding current payment)
                            other_payments_total = ServiceFeePayment.objects.filter(
                                unit_id=payment.unit_id,
                                service_fee_id=payment.service_fee_id,
                                service_period_month=period_month,
                                service_period_year=period_year,
                                payment_status='completed'
                            ).exclude(
                                id=payment.id  # Exclude current payment to avoid double counting
                            ).aggregate(total=Sum('amount'))['total'] or 0
                            
                            # Add current payment amount to get TOTAL PAID for this month
                            total_paid_for_month = other_payments_total + float(payment.amount)
                            
                            print(f"\n{'='*60}")
                            print(f"IPN SERVICE STATUS: {period_month:02d}/{period_year}")
                            print(f"{'='*60}")
                            print(f"Fee: {total_fee_amount} TK | Paid: {total_paid_for_month} TK")
                            
                            # Calculate service status
                            if total_paid_for_month >= total_fee_amount:
                                print(f"✅ IPN: FULLY PAID")
                            else:
                                remaining = total_fee_amount - total_paid_for_month
                                print(f"⚠️  IPN: PARTIAL (needs {remaining} TK more)")
                            print(f"{'='*60}\n")
                                
                        except ServiceFee.DoesNotExist:
                            print(f"❌ IPN: ServiceFee not found for ID: {payment.service_fee_id}")
                        except Exception as calc_error:
                            print(f"❌ Error calculating service status: {str(calc_error)}")
                        
                        payment.save()
                
                # Create audit trail
                try:
                    create_audit_trail(
                        member=None,
                        event_type='PAYMENT_UPDATED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=payment.id,
                        new_data=None,
                        old_data=None,
                        description=f"Payment validated via IPN for transaction {tran_id} ({len(payments)} payments)"
                    )
                except Exception as e:
                    pass
                
                # Create payment received notifications for admins (IPN-validated payment)
                try:
                    from notifications.utils import create_service_fee_payment_received_notification
                    
                    for p in payments:
                        try:
                            create_service_fee_payment_received_notification(
                                payment=p,
                                payment_amount=p.amount,
                                payment_method='SSLCommerz',
                                recorded_by=None  # IPN callback, no admin recorder
                            )
                            print(f"[SSLCommerz IPN] ✅ Payment received notification created for payment ID {p.id}")
                        except Exception as notif_err:
                            print(f"[SSLCommerz IPN] Could not create payment notification for payment {p.id}: {notif_err}")
                except Exception as notif_error:
                    # Log but don't fail - notifications are optional
                    print(f"[SSLCommerz IPN] Could not create payment notifications: {notif_error}")
                    import traceback
                    print(traceback.format_exc())
            
            return Response({
                'success': True,
                'message': 'IPN processed successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'IPN processing error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== SERVICE FEE BILLING VIEWS (NORMALIZED MODEL) ====================

class ServiceFeeBillingListCreateView(APIView):
    """
    API view for listing and creating service fee billings
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        """
        Get list of service fee billings with filtering
        """
        # View permission for listing billings
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            queryset = ServiceFeeBilling.objects.select_related(
                'service_fee', 'unit', 'unit__floor__tower', 'resident', 'created_by'
            ).prefetch_related('payments')
            
            # Filter by unit
            unit_id = request.query_params.get('unit')
            if unit_id:
                queryset = queryset.filter(unit_id=unit_id)
            
            # Filter by tower
            tower_id = request.query_params.get('tower_id')
            if tower_id:
                queryset = queryset.filter(unit__floor__tower_id=tower_id)
            
            # Filter by service status
            service_status = request.query_params.get('service_status')
            if service_status:
                queryset = queryset.filter(service_status=service_status)
            
            # Filter by service period
            service_period_month = request.query_params.get('service_period_month')
            service_period_year = request.query_params.get('service_period_year')
            if service_period_month:
                queryset = queryset.filter(service_period_month=service_period_month)
            if service_period_year:
                queryset = queryset.filter(service_period_year=service_period_year)
            
            # Search functionality
            search = request.query_params.get('search')
            if search:
                queryset = queryset.filter(
                    Q(billing_id__icontains=search) |
                    Q(unit__unit_name__icontains=search) |
                    Q(resident__full_name__icontains=search)
                ).distinct()
            
            # Ordering
            ordering = request.query_params.get('ordering', '-created_at')
            queryset = queryset.order_by(ordering)
            
            # Pagination
            page_size = int(request.query_params.get('page_size', 20))
            page = int(request.query_params.get('page', 1))
            offset = (page - 1) * page_size
            total_count = queryset.count()
            billings = queryset[offset:offset + page_size]
            
            serializer = ServiceFeeBillingSerializer(billings, many=True)
            
            return Response({
                'success': True,
                'data': {
                    'billings': serializer.data,
                    'pagination': {
                        'total_count': total_count,
                        'page': page,
                        'page_size': page_size,
                        'total_pages': (total_count + page_size - 1) // page_size
                    }
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving billings: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """
        Create a new service fee billing
        """
        # Add permission for creating billing
        self.required_permission_id = [PERMISSION_ADD_SERVICE_FEE_SETTINGS]
        try:
            serializer = ServiceFeeBillingSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                billing = serializer.save()
                
                # Create audit trail
                try:
                    member = None
                    if hasattr(billing, 'created_by_id') and billing.created_by_id:
                        try:
                            member = Member.objects.get(id=billing.created_by_id)
                        except Member.DoesNotExist:
                            pass
                    
                    create_audit_trail(
                        member=member,
                        event_type='BILLING_CREATED',
                        table_name='service_fee_payment_details',
                        row_id=billing.id,
                        new_data=ServiceFeeBillingSerializer(billing).data,
                        description=f'Billing created for unit {billing.unit.unit_name}, period: {billing.service_period_month}/{billing.service_period_year}'
                    )
                except Exception as e:
                    print(f"Error creating audit trail: {str(e)}")
                
                return Response({
                    'success': True,
                    'message': 'Billing created successfully',
                    'data': ServiceFeeBillingSerializer(billing).data
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'success': False,
                'message': 'Invalid data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error creating billing: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeBillingDetailView(APIView):
    """
    API view for retrieving, updating, and deleting a specific billing
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request, billing_id):
        """
        Get details of a specific billing
        """
        # View permission for reading billing detail
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            billing = ServiceFeeBilling.objects.select_related(
                'service_fee', 'unit', 'unit__floor__tower', 'resident'
            ).prefetch_related('payments').get(id=billing_id)
            
            serializer = ServiceFeeBillingSerializer(billing)
            
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except ServiceFeeBilling.DoesNotExist:
            return Response({
                'success': False,
                'message': f'Billing with ID {billing_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving billing: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request, billing_id):
        """
        Update a specific billing
        """
        # Edit permission for updating billing
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            billing = ServiceFeeBilling.objects.get(id=billing_id)
            serializer = ServiceFeeBillingSerializer(billing, data=request.data, partial=True, context={'request': request})
            
            if serializer.is_valid():
                old_data = ServiceFeeBillingSerializer(billing).data
                billing = serializer.save()
                
                # Create audit trail
                try:
                    member = None
                    if hasattr(billing, 'updated_by_id') and billing.updated_by_id:
                        try:
                            member = Member.objects.get(id=billing.updated_by_id)
                        except Member.DoesNotExist:
                            pass
                    
                    create_audit_trail(
                        member=member,
                        event_type='BILLING_UPDATED',
                        table_name='service_fee_payment_details',
                        row_id=billing.id,
                        old_data=old_data,
                        new_data=ServiceFeeBillingSerializer(billing).data,
                        description=f'Billing updated for unit {billing.unit.unit_name}'
                    )
                except Exception as e:
                    print(f"Error creating audit trail: {str(e)}")
                
                return Response({
                    'success': True,
                    'message': 'Billing updated successfully',
                    'data': ServiceFeeBillingSerializer(billing).data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'success': False,
                'message': 'Invalid data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except ServiceFeeBilling.DoesNotExist:
            return Response({
                'success': False,
                'message': f'Billing with ID {billing_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error updating billing: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, billing_id):
        """
        Delete a specific billing
        """
        try:
            billing = ServiceFeeBilling.objects.get(id=billing_id)
            
            # Check if there are any payments associated with this billing
            if billing.payments.exists():
                return Response({
                    'success': False,
                    'message': 'Cannot delete billing with associated payments'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            billing_data = ServiceFeeBillingSerializer(billing).data
            billing.delete()
            
            # Create audit trail
            try:
                create_audit_trail(
                    member=None,
                    event_type='BILLING_DELETED',
                    table_name='service_fee_payment_details',
                    row_id=billing_id,
                    old_data=billing_data,
                    description=f'Billing deleted for unit {billing_data.get("unit_display")}'
                )
            except Exception as e:
                print(f"Error creating audit trail: {str(e)}")
            
            return Response({
                'success': True,
                'message': 'Billing deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except ServiceFeeBilling.DoesNotExist:
            return Response({
                'success': False,
                'message': f'Billing with ID {billing_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error deleting billing: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateServiceFeeView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_GENERATE_SERVICE_FEES]
    
    def post(self, request):
        try:
            # Get request parameters
            service_fee_id = request.data.get('service_fee_id')
            service_fee_ids = request.data.get('service_fee_ids')
            tower_id = request.data.get('tower_id')
            unit_ids_param = request.data.get('unit_ids', '')
            year = request.data.get('year')
            month = request.data.get('month')
            force_regenerate = request.data.get('force_regenerate', False)
            bill_category_ids = request.data.get('bill_category_ids')
            created_by_id = request.data.get('created_by')
            created_by_member = None
            
            # Resolve ID and Member instance
            if created_by_id:
                try:
                    from user.models import Member
                    created_by_member = Member.objects.filter(id=created_by_id).first()
                except Exception:
                    pass
            elif request.user.is_authenticated:
                from user.models import Member
                created_by_member = Member.objects.filter(user=request.user).first()
                if created_by_member:
                    created_by_id = created_by_member.id
            
            print(f"DEBUG: GenerateServiceFeeView request - created_by_id: {created_by_id}, member: {created_by_member}")
            
            print(f"DEBUG: GenerateServiceFeeView request data: {request.data}")
            print(f"DEBUG: Parsed params - tower_id: {tower_id}, unit_ids: {unit_ids_param}, bill_category_ids: {bill_category_ids}")

            # Validate required parameters
            if not year or not month:
                return Response({
                    'success': False,
                    'message': 'Year and month are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Accept either service_fee_id (single) or service_fee_ids (list)
            try:
                year = int(year)
                month = int(month)
            except (TypeError, ValueError):
                return Response({
                    'success': False,
                    'message': 'Invalid parameter types. year and month must be integers.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Collect all service_fee_ids to process
            fee_ids = []
            if service_fee_ids:
                if isinstance(service_fee_ids, str):
                    # Accept comma-separated string
                    fee_ids = [int(fid.strip()) for fid in service_fee_ids.split(',') if fid.strip().isdigit()]
                elif isinstance(service_fee_ids, list):
                    fee_ids = [int(fid) for fid in service_fee_ids if str(fid).isdigit()]
            elif service_fee_id:
                try:
                    fee_ids = [int(service_fee_id)]
                except (TypeError, ValueError):
                    return Response({
                        'success': False,
                        'message': 'Invalid service_fee_id.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            if not fee_ids:
                return Response({
                    'success': False,
                    'message': 'At least one service_fee_id is required.'
                }, status=status.HTTP_400_BAD_REQUEST)


            # Wrap entire operation in transaction for rollback on voucher failure
            with transaction.atomic():
                # Call generate_service_fees ONCE for all service_fee_ids (SYNCHRONOUS)
                result = generate_service_fees(
                    year=year,
                    month=month,
                    unit_ids=unit_ids_param if unit_ids_param else None,
                    tower_id=tower_id,
                    service_fee_ids=fee_ids,
                    bill_category_ids=bill_category_ids,
                    force_regenerate=force_regenerate,
                    created_by=created_by_id
                )

                if result['success']:
                    # After successful bill generation, create vouchers for each unit
                    voucher_result = {'success': True, 'created_count': 0, 'errors': []}
                    if result['created_count'] > 0 or result['regenerated_count'] > 0:
                        try:
                            from service_fee_management.models import ServiceFeePayment
                            from .utils.voucher_generator import create_vouchers_for_generated_bills
                            
                            # Fetch the newly generated/updated payments with breakdown items
                            # Filter by created_by to ensure we ONLY voucher what we just generated
                            newly_generated_payments = ServiceFeePayment.objects.filter(
                                service_period_year=year,
                                service_period_month=month,
                                created_by_id=created_by_id
                            ).select_related(
                                'unit', 'unit__floor', 'unit__floor__tower'
                            ).prefetch_related(
                                'items', 'items__bill_category'
                            )
                            
                            # Apply same filters as generation if specified
                            if tower_id:
                                newly_generated_payments = newly_generated_payments.filter(unit__floor__tower_id=tower_id)
                            
                            if unit_ids_param:
                                unit_ids_list = [int(u.strip()) for u in unit_ids_param.split(',') if u.strip().isdigit()]
                                newly_generated_payments = newly_generated_payments.filter(unit_id__in=unit_ids_list)
                            
                            if newly_generated_payments.exists():
                                voucher_result = create_vouchers_for_generated_bills(
                                    newly_generated_payments,
                                    year,
                                    month,
                                    created_by=created_by_member
                                )
                                print(f"✅ Voucher generation result: {voucher_result}")
                                
                                # If voucher creation failed, raise exception to trigger rollback
                                if not voucher_result.get('success', False):
                                    errors = '\n'.join(voucher_result.get('errors', ['Unknown error']))
                                    raise Exception(f"❌ Voucher creation failed. All bills will be rolled back.\n{errors}")
                                
                                try:
                                    import threading
                                    from .tasks import auto_payment_task
                                    payment_ids_list = list(newly_generated_payments.values_list('id', flat=True))
                                    
                                    print(f"🔄 Triggering auto-payment background tasks for {len(payment_ids_list)} bills")
                                    
                                    def run_auto_payments(pids):
                                        for payment_id in pids:
                                            try:
                                                auto_payment_task(payment_id)
                                            except Exception as e:
                                                print(f"❌ Auto-payment task failed for bill {payment_id}: {e}")

                                    # Start auto-payments in a background thread to avoid blocking response
                                    threading.Thread(target=run_auto_payments, args=(payment_ids_list,), daemon=True).start()
                                    print(f"✅ Background auto-payment thread started")
                                except Exception as task_error:
                                    print(f"⚠️ Warning: Could not queue auto-payment tasks: {task_error}")

                                # ✅ Queue Bill email dispatch for AFTER transaction commit
                                try:
                                    from django.db import transaction as db_transaction
                                    from .utils.bill_email_utils import trigger_bill_emails_for_generated_bills
                                    payment_ids_list = list(newly_generated_payments.values_list('id', flat=True))
                                    
                                    print(f"📧 [BillEmail] Queuing dispatch for {len(payment_ids_list)} bills (after commit)")
                                    # trigger_bill_emails_for_generated_bills already starts its own background thread
                                    db_transaction.on_commit(lambda pids=payment_ids_list: trigger_bill_emails_for_generated_bills(pids))
                                except Exception as email_err:
                                    print(f"⚠️ Warning: Could not queue bill emails: {email_err}")
                                    logger.error(f"Bill email queuing failed: {email_err}", exc_info=True)
                                    
                        except Exception as e:
                            print(f"❌ CRITICAL: Voucher creation failed: {str(e)}")
                            # Re-raise to trigger transaction rollback
                            raise
                    
                    # ── Service Fee Notifications ────────────────────────────────────────
                    # Triggered after successful bill generation + voucher creation.
                    # Errors here must NOT fail the main request.
                    total_generated = result.get('created_count', 0) + result.get('regenerated_count', 0)
                    if total_generated > 0:
                        try:
                            from notifications.utils import (
                                create_service_fee_bills_generated_notification,
                                create_community_member_bill_issued_notification,
                            )
                            
                            # Resolve tower name for the bulk notification (if filtered by tower)
                            tower_name = None
                            if tower_id:
                                from towers.models import Tower as _Tower
                                tower_obj = _Tower.objects.filter(id=tower_id).first()
                                tower_name = tower_obj.tower_name if tower_obj else None
                            
                            # 1. Bulk "Monthly Bills Generated" notification
                            #    Recipients: staff with Generate Service Fees + View Billing Management
                            #    Channel: web in-app only (no push)
                            #    Excludes the staff member who triggered the generation
                            print(f"[GenerateServiceFee] 📣 Creating bulk bills-generated notification "
                                  f"(year={year}, month={month}, units={total_generated})...")
                            create_service_fee_bills_generated_notification(
                                year=year,
                                month=month,
                                units_count=total_generated,
                                tower_name=tower_name,
                                bill_generator_id=created_by_id,
                            )
                            print(f"[GenerateServiceFee] ✅ Bulk bills-generated notification created")
                            
                            # 2. Individual "Service Fee Bill Issued" notification per unit
                            #    Recipients: all owners + active residents of each unit
                            #    Channel: both (web in-app + push)
                            if 'newly_generated_payments' in dir() and newly_generated_payments.exists():
                                print(f"[GenerateServiceFee] 📣 Creating bill-issued notifications "
                                      f"for {newly_generated_payments.count()} unit(s)...")
                                
                                all_bill_notifications = []
                                for payment in newly_generated_payments:
                                    try:
                                        # Create in-app notification without sending push immediately
                                        unit_notifs = create_community_member_bill_issued_notification(payment, send_push=False)
                                        if unit_notifs:
                                            all_bill_notifications.extend(unit_notifs)
                                    except Exception as per_payment_err:
                                        print(f"[GenerateServiceFee] ⚠️ Bill-issued notification failed "
                                              f"for payment {payment.id}: {per_payment_err}")
                                
                                # Send ALL push notifications in a single batch
                                if all_bill_notifications:
                                    print(f"[GenerateServiceFee] 📣 Sending bulk push for {len(all_bill_notifications)} notifications...")
                                    from notifications.unified_push_service import send_unified_push_for_notifications
                                    send_unified_push_for_notifications(all_bill_notifications)
                                    
                                print(f"[GenerateServiceFee] ✅ Bill-issued notifications complete")
                        except Exception as notif_err:
                            # Never fail the generation request due to notification errors
                            print(f"[GenerateServiceFee] ⚠️ Notification error (generation still succeeded): {notif_err}")
                            import traceback as _tb
                            _tb.print_exc()
                    # ────────────────────────────────────────────────────────────────────
                    
                    return Response({
                        'success': True,
                        'message': result['message'],
                        'data': {
                            'created_count': result['created_count'],
                            'regenerated_count': result['regenerated_count'],
                            'skipped_count': result['skipped_count'],
                            'created_records': result['created_records'],
                            'regenerated_records': result['regenerated_records'],
                            'skipped_records': result['skipped_records'],
                            'total_created': result['total_created'],
                            'total_regenerated': result['total_regenerated'],
                            'total_skipped': result['total_skipped'],
                            'year': result['year'],
                            'month': result['month'],
                            'month_name': result['month_name'],
                            'vouchers': {
                                'created_count': voucher_result.get('created_count', 0),
                                'failed_count': voucher_result.get('failed_count', 0),
                                'errors': voucher_result.get('errors', [])
                            }
                        }
                    }, status=status.HTTP_201_CREATED if (result['created_count'] > 0 or result['regenerated_count'] > 0) else status.HTTP_200_OK)
                else:
                    transaction.set_rollback(True)
                    return Response({
                        'success': False,
                        'message': result.get('error', 'Error generating service fees')
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': f'Error generating service fees: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateMissingMonthsView(APIView):
    """
    Generate service fees for ALL missing months in a date range
    Useful for generating all months from service start to current month at once
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        # Generate permission required for missing months
        self.required_permission_id = [PERMISSION_GENERATE_SERVICE_FEES]
        """
        Diagnostic endpoint OR manual trigger
        
        Usage: 
        - GET /api/service-fee-management/generate-missing-months/?diagnostic=test5
        - GET /api/service-fee-management/generate-missing-months/?trigger=auto
        """
        diagnostic = request.query_params.get('diagnostic')
        trigger = request.query_params.get('trigger')
        
        if trigger == 'auto':
            # Manually trigger the auto-generation (same as scheduler)
            from .utils.service_fee_generator import generate_all_missing_months
            from datetime import datetime
            
            now = datetime.now()
            
            print(f"\n[ManualTrigger] 🔄 Manually triggered auto-generation")
            
            created_by = None
            if request.user.is_authenticated:
                member = Member.objects.filter(user=request.user).first()
                if member:
                    created_by = member.id

            result = generate_all_missing_months(
                from_month=None,  # Will use earliest service fee date
                from_year=None,
                to_month=now.month,  # Current month
                to_year=now.year,
                force_regenerate=False,
                created_by=created_by
            )
            
            return Response({
                'success': result['success'],
                'message': result.get('message', 'Auto-generation completed'),
                'data': {
                    'months_generated': result.get('months_generated', 0),
                    'total_created': result.get('total_created', 0),
                    'total_regenerated': result.get('total_regenerated', 0),
                    'total_skipped': result.get('total_skipped', 0),
                    'results_by_month': result.get('results_by_month', {})
                }
            }, status=200)
        
        if diagnostic == 'test5':
            from service_fee.models import ServiceFee
            from towers.models import Tower, Unit
            
            result = {
                'diagnostic': 'Test 5 Tower Service Fee Analysis',
                'checks': []
            }
            
            # Check 1: Tower exists
            test5_towers = Tower.objects.filter(tower_name='Test 5')
            if test5_towers.exists():
                tower = test5_towers.first()
                result['checks'].append({
                    'check': 'Tower Exists',
                    'status': 'PASS',
                    'tower_id': tower.id,
                    'tower_name': tower.tower_name
                })
                
                # Check units
                units = Unit.objects.filter(floor__tower=tower)
                occupied_units = units.all()
                result['checks'].append({
                    'check': 'Units in Tower',
                    'total_units': units.count(),
                    'occupied_units': occupied_units.count(),
                    'occupied_unit_ids': list(occupied_units.values_list('id', flat=True)[:10])
                })
            else:
                result['checks'].append({
                    'check': 'Tower Exists',
                    'status': 'FAIL',
                    'message': 'Tower Test 5 not found'
                })
            
            # Check 2: Service fees
            service_fees = ServiceFee.objects.filter(towers__tower_name='Test 5', is_active=True)
            if service_fees.exists():
                sf_data = []
                for sf in service_fees:
                    sf_units = sf.units.all()
                    occupied_sf_units = sf_units.all()
                    sf_data.append({
                        'service_fee_id': sf.id,
                        'fee_amount': str(sf.fee_amount),
                        'currency': sf.currency,
                        'service_fee_date': str(sf.service_fee_date),
                        'frequency': sf.frequency,
                        'is_active': sf.is_active,
                        'due_day': sf.due_day,
                        'assigned_units': sf_units.count(),
                        'assigned_unit_ids': list(sf_units.values_list('id', flat=True)[:10]),
                        'occupied_units': occupied_sf_units.count()
                    })
                result['checks'].append({
                    'check': 'Service Fees',
                    'status': 'PASS',
                    'service_fees': sf_data
                })
            else:
                result['checks'].append({
                    'check': 'Service Fees',
                    'status': 'FAIL',
                    'message': 'No active service fees found for Test 5'
                })
            
            # Check 3: Run generator query
            query = """
                SELECT 
                    sf.id AS service_fee_id,
                    sf.service_fee_date,
                    sf.is_active,
                    t.tower_name,
                    u.id AS unit_id,
                    u.unit_name,
                    u.unit_status,
                    sfp.id AS existing_payment_id
                FROM service_fee_servicefee sf
                INNER JOIN service_fee_servicefee_towers sft ON sf.id = sft.servicefee_id
                INNER JOIN service_fee_servicefee_units su ON sf.id = su.servicefee_id
                INNER JOIN towers_unit u ON u.id = su.unit_id
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                LEFT JOIN service_fee_management_servicefeegenerate sfp 
                    ON sfp.service_fee_id = sf.id
                    AND sfp.unit_id = u.id
                    AND sfp.service_period_year = 2025
                    AND sfp.service_period_month = 11
                WHERE 
                    sf.is_active = 1
                    AND t.tower_name = 'Test 5'
            """
            
            with connection.cursor() as cursor:
                cursor.execute(query)
                columns = [col[0] for col in cursor.description]
                records = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            result['checks'].append({
                'check': 'Generator Query (Nov 2025)',
                'records_found': len(records),
                'records': records[:5] if records else []
            })
            
            return Response(result, status=200)
        
        elif diagnostic == 'test5_payments':
            # Check all generated payments for Test 5
            from service_fee_management.models import ServiceFeePayment
            
            payments = ServiceFeePayment.objects.filter(
                service_fee_id=83  # Test 5 service fee ID
            ).order_by('service_period_year', 'service_period_month').values(
                'id', 'unit_id', 'service_period_month', 'service_period_year',
                'amount', 'remaining_amount', 'service_status', 'due_date', 'created_at'
            )
            
            return Response({
                'diagnostic': 'Test 5 Payments',
                'service_fee_id': 83,
                'total_payments': payments.count(),
                'payments': list(payments)
            }, status=200)
        
        return Response({
            'error': 'Invalid diagnostic parameter. Use ?diagnostic=test5 or ?diagnostic=test5_payments'
        }, status=400)
    
    def post(self, request):
        # Generate permission required for missing months
        self.required_permission_id = [PERMISSION_GENERATE_SERVICE_FEES]
        """
        Generate service fees for all months in a range
        
        Request body:
        {
            "from_month": 1,
            "from_year": 2025,
            "to_month": 11,
            "to_year": 2025,
            "force_regenerate": false
        }
        """
        try:
            from .utils.service_fee_generator import generate_all_missing_months
            
            # Get parameters from request
            from_month = request.data.get('from_month')
            from_year = request.data.get('from_year')
            to_month = request.data.get('to_month')
            to_year = request.data.get('to_year')
            force_regenerate = request.data.get('force_regenerate', False)
            created_by = request.data.get('created_by')
            
            # If not in request data, try to get from authenticated user
            if not created_by and request.user.is_authenticated:
                member = Member.objects.filter(user=request.user).first()
                if member:
                    created_by = member.id
            
            print(f"\n[GenerateMissingMonthsView] Received request:")
            print(f"  From: {from_month}/{from_year} To: {to_month}/{to_year}")
            print(f"  Force Regenerate: {force_regenerate}")
            
            # Call bulk generation
            result = generate_all_missing_months(
                from_month=from_month,
                from_year=from_year,
                to_month=to_month,
                to_year=to_year,
                force_regenerate=force_regenerate,
                created_by=created_by
            )
            
            if result['success']:
                # Trigger notifications after bulk generation
                try:
                    from .utils.service_fee_generator import datetime as _dt
                    now = _dt.now()
                    
                    from notifications.utils import (
                        create_service_fee_bills_generated_notification,
                        create_community_member_bill_issued_notification
                    )
                    from .models import ServiceFeePayment
                    
                    # 1. Bulk notification for staff
                    create_service_fee_bills_generated_notification(
                        year=to_year,
                        month=to_month,
                        units_count=result.get('total_created', 0),
                        tower_name="Multiple Towers",
                        bill_generator_id=created_by
                    )
                    
                    # 2. Individual notifications for units (for ALL generated months)
                    # To keep it simple and avoid spam, we'll just query all payments created in this session
                    session_payments = ServiceFeePayment.objects.filter(
                        service_period_year__gte=from_year,
                        service_period_year__lte=to_year,
                        created_by_id=created_by,
                        updated_at__gte=now
                    )
                    
                    if session_payments.exists():
                        all_unit_notifs = []
                        for payment in session_payments:
                            try:
                                unit_notifs = create_community_member_bill_issued_notification(payment, send_push=False)
                                if unit_notifs:
                                    all_unit_notifs.extend(unit_notifs)
                            except:
                                continue
                        
                        if all_unit_notifs:
                            from notifications.unified_push_service import send_unified_push_for_notifications
                            send_unified_push_for_notifications(all_unit_notifs)
                            
                except Exception as notif_outer_err:
                    print(f"[GenerateMissingMonthsView] ⚠️ Notification error: {notif_outer_err}")

                return Response({
                    'success': True,
                    'message': result['message'],
                    'data': {
                        'months_generated': result['months_generated'],
                        'total_created': result['total_created'],
                        'total_regenerated': result['total_regenerated'],
                        'total_skipped': result['total_skipped'],
                        'results_by_month': result['results_by_month']
                    }
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': result.get('error', 'Error generating service fees')
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"[GenerateMissingMonthsView] ❌ Error: {str(e)}\n{error_details}")
            return Response({
                'success': False,
                'message': f'Error generating service fees: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeleteGeneratedServiceFeeView(APIView):
    """
    Delete generated service fee for a specific unit, service fee, month, and year
    This will delete all payment records and the service fee payment record
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def delete(self, request):
        # Permission for deleting generated service fees
        self.required_permission_id = [PERMISSION_DELETE_GENERATED_SERVICE_FEES]
        try:
            import traceback
            from django.db import transaction
            
            print("=" * 80)
            print("DELETE GENERATED SERVICE FEE REQUEST")
            print("=" * 80)
            
            # Get parameters from request body
            payment_id = request.data.get('payment_id')
            unit_id = request.data.get('unit_id')
            service_fee_id = request.data.get('service_fee_id')
            service_period_month = request.data.get('service_period_month')
            service_period_year = request.data.get('service_period_year')
            
            print(f"Parameters:")
            print(f"   Unit ID: {unit_id}")
            print(f"   Service Fee ID: {service_fee_id}")
            print(f"   Month: {service_period_month}")
            print(f"   Year: {service_period_year}")
            
            # Validate required parameters
            if not all([payment_id]):
                return Response({
                    'success': False,
                    'message': 'Missing required parameters: payment_id'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Convert to integers
            try:
                payment_id = int(payment_id)
            except ValueError:
                return Response({
                    'success': False,
                    'message': 'Invalid parameter types. All IDs must be integers.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find the service fee payment record
            payments = ServiceFeePayment.objects.filter(
                id=payment_id
            )
            
            if not payments.exists():
                return Response({
                    'success': False,
                    'message': 'No generated service fee found for this unit and period.'
                }, status=status.HTTP_404_NOT_FOUND)

            deleted_count = 0
            payment_details_deleted = 0
            
            # Use transaction to ensure all deletes happen together
            with transaction.atomic():
                for payment in payments:
                    print(f"Deleting payment ID: {payment.id}")
                    
                    # Check for related payment details (billing records)
                    billings = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment)
                    details_count = billings.count()
                    if details_count > 0:
                        return Response({
                            'success': False,
                            'message': 'Cannot delete service fee. Payment transactions already exist for this period.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                   

                    # billings.delete()
                    # payment_details_deleted += details_count
                    
                    print(f"   Deleted {details_count} payment details/billing records")
                    
                    # Delete the payment record itself
                    payment.delete()
                    deleted_count += 1
                    
                    print(f"   Payment deleted successfully")
            
            print("=" * 80)
            print(f"DELETION COMPLETE")
            print(f"   Total payments deleted: {deleted_count}")
            # print(f"   Total payment details deleted: {payment_details_deleted}")
            print("=" * 80)
            
            return Response({
                'success': True,
                'message': f'Successfully deleted {deleted_count} service fee payment(s)',
                'deleted_count': deleted_count,
                'payment_details_deleted': 0
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': f'Error deleting generated service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeGenerationScheduleListCreateView(APIView):
    """
    API view for listing and creating service fee generation schedules
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def get(self, request):
        """
        Get list of schedules with optional filtering
        """
        # View permission for listing schedules
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            queryset = ServiceFeeGenerationSchedule.objects.select_related('tower', 'service_fee', 'created_by').all()

            # Filter by status
            status_filter = request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)

            # Filter by tower
            tower_id = request.query_params.get('tower_id', None)
            if tower_id:
                queryset = queryset.filter(tower_id=tower_id)

            # Filter by service fee
            service_fee_id = request.query_params.get('service_fee_id', None)
            if service_fee_id:
                queryset = queryset.filter(service_fee_id=service_fee_id)

            # Search
            search = request.query_params.get('search', None)
            if search:
                queryset = queryset.filter(
                    Q(schedule_name__icontains=search) |
                    Q(tower__tower_name__icontains=search)
                )

            # Ordering
            ordering = request.query_params.get('ordering', '-created_at')
            if ordering:
                queryset = queryset.order_by(ordering)

            # Serialize with error handling for each item
            serializer = ServiceFeeGenerationScheduleSerializer(queryset, many=True)
            
            # Try to get serialized data, catch any errors during serialization
            try:
                serialized_data = serializer.data
            except Exception as serialization_error:
                # If serialization fails, try to serialize each item individually
                # to identify which item is causing the problem
                serialized_data = []
                for item in queryset:
                    try:
                        item_serializer = ServiceFeeGenerationScheduleSerializer(item)
                        serialized_data.append(item_serializer.data)
                    except Exception as item_error:
                        # Skip problematic items and log the error
                        import traceback
                        print(f"Error serializing schedule {item.id}: {str(item_error)}")
                        print(traceback.format_exc())
                        # Add a basic representation of the item
                        serialized_data.append({
                            'id': item.id,
                            'schedule_name': getattr(item, 'schedule_name', 'N/A'),
                            'tower_name': getattr(item.tower, 'tower_name', 'N/A') if item.tower else 'All Towers',
                            'service_fee_display': 'N/A',
                            'generation_day': getattr(item, 'generation_day', None),
                            'generation_hour': getattr(item, 'generation_hour', None),
                            'generation_minute': getattr(item, 'generation_minute', None),
                            'next_execution_display': 'N/A',
                            'status': getattr(item, 'status', 'active'),
                            'error': 'Serialization error'
                        })

            return Response({
                'success': True,
                'data': serialized_data,
                'count': queryset.count()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error retrieving schedules: {str(e)}")
            print(error_trace)
            return Response({
                'success': False,
                'message': f'Error retrieving schedules: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        Create a new schedule
        """
        # Edit permission for creating schedules
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            serializer = ServiceFeeGenerationScheduleSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                # Set created_by
                if request.user.is_authenticated:
                    try:
                        member = Member.objects.get(user=request.user)
                        serializer.save(created_by=member)
                    except Member.DoesNotExist:
                        serializer.save()
                else:
                    serializer.save()

                return Response({
                    'success': True,
                    'message': 'Schedule created successfully',
                    'data': serializer.data
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'message': 'Validation error',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error creating schedule: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeGenerationScheduleTestView(APIView):
    """
    API view for testing schedule execution manually
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        # Manage schedule permission required for testing scheduler
        self.required_permission_id = [PERMISSION_MANAGE_SCHEDULE_CONFIGURATION]
        """
        Test execute a schedule manually (for testing purposes)
        """
        try:
            import logging
            logger = logging.getLogger(__name__)
            
            from .models import ServiceFeeGenerationSchedule
            from django.utils import timezone
            from .reminder_scheduler import ServiceFeeGenerationScheduler
            
            schedule = ServiceFeeGenerationSchedule.objects.select_related('tower', 'service_fee').get(pk=pk)
            
            # Create scheduler instance
            scheduler = ServiceFeeGenerationScheduler()
            
            # Execute the schedule with current time
            now = timezone.now()
            scheduler._execute_schedule(schedule, now)
            
            # Reload schedule to get updated execution info
            schedule.refresh_from_db()
            
            return Response({
                'success': True,
                'message': f'Schedule "{schedule.schedule_name}" executed successfully',
                'data': {
                    'schedule_id': schedule.id,
                    'schedule_name': schedule.schedule_name,
                    'last_executed': schedule.last_executed,
                    'last_execution_result': schedule.last_execution_result
                }
            }, status=status.HTTP_200_OK)
            
        except ServiceFeeGenerationSchedule.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Schedule not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            error_trace = traceback.format_exc()
            logger.error(f"Error testing schedule: {str(e)}\n{error_trace}")
            return Response({
                'success': False,
                'message': f'Error testing schedule: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ServiceFeeGenerationSchedulerStatusView(APIView):
    """
    API view to check scheduler status
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get(self, request):
        # Manage schedule permission required for viewing scheduler status
        self.required_permission_id = [PERMISSION_MANAGE_SCHEDULE_CONFIGURATION]
        """
        Get scheduler status
        """
        try:
            from .reminder_scheduler import get_service_fee_scheduler
            
            scheduler = get_service_fee_scheduler()
            
            return Response({
                'success': True,
                'data': {
                    'scheduler_running': scheduler.running,
                    'check_interval_seconds': scheduler.check_interval,
                    'message': 'Scheduler is running automatically in background' if scheduler.running else 'Scheduler is not running'
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error checking scheduler status: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeGenerationSchedulerTestView(APIView):
    """
    API view for testing the scheduler manually with current time
    Tests all active schedules to see if they should run now
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def post(self, request):
        # Manage schedule permission required for triggering scheduler test
        self.required_permission_id = [PERMISSION_MANAGE_SCHEDULE_CONFIGURATION]
        """
        Test the scheduler manually - check all active schedules at current time
        """
        try:
            import logging
            from django.utils import timezone
            from .models import ServiceFeeGenerationSchedule
            from .reminder_scheduler import ServiceFeeGenerationScheduler
            
            logger = logging.getLogger(__name__)
            now = timezone.now()
            
            # Get all active schedules
            schedules = ServiceFeeGenerationSchedule.objects.filter(status='active').select_related('tower', 'service_fee')
            
            # Create scheduler instance
            scheduler = ServiceFeeGenerationScheduler()
            
            results = {
                'test_time': now.strftime('%Y-%m-%d %H:%M:%S'),
                'scheduler_running': scheduler.running,
                'total_active_schedules': schedules.count(),
                'schedules_checked': [],
                'schedules_executed': [],
                'schedules_skipped': []
            }
            
            # Check each schedule
            for schedule in schedules:
                schedule_info = {
                    'id': schedule.id,
                    'schedule_name': schedule.schedule_name,
                    'generation_day': schedule.generation_day,
                    'generation_hour': schedule.generation_hour,
                    'generation_minute': schedule.generation_minute,
                    'recurring_frequency': schedule.recurring_frequency,
                    'next_execution': schedule.next_execution.strftime('%Y-%m-%d %H:%M:%S') if schedule.next_execution else None,
                    'should_run': False,
                    'executed': False,
                    'message': ''
                }
                
                # Check if schedule should run now
                try:
                    should_run = schedule.should_run_now(now)
                    schedule_info['should_run'] = should_run
                    
                    if should_run:
                        # Execute the schedule
                        try:
                            scheduler._execute_schedule(schedule, now)
                            schedule.refresh_from_db()
                            schedule_info['executed'] = True
                            schedule_info['message'] = f"Executed successfully. Result: {schedule.last_execution_result}"
                            results['schedules_executed'].append(schedule_info)
                        except Exception as e:
                            schedule_info['executed'] = False
                            schedule_info['message'] = f"Execution failed: {str(e)}"
                            results['schedules_executed'].append(schedule_info)
                    else:
                        schedule_info['message'] = f"Not due yet. Next execution: {schedule_info['next_execution']}"
                        results['schedules_skipped'].append(schedule_info)
                        
                except Exception as e:
                    schedule_info['message'] = f"Error checking schedule: {str(e)}"
                    results['schedules_skipped'].append(schedule_info)
                
                results['schedules_checked'].append(schedule_info)
            
            return Response({
                'success': True,
                'message': f'Scheduler test completed. Checked {len(results["schedules_checked"])} schedules.',
                'data': results
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            error_trace = traceback.format_exc()
            logger.error(f"Error testing scheduler: {str(e)}\n{error_trace}")
            return Response({
                'success': False,
                'message': f'Error testing scheduler: {str(e)}',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeGenerationScheduleDetailView(APIView):
    """
    API view for retrieving, updating, and deleting a specific schedule
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def get_object(self, pk):
        try:
            return ServiceFeeGenerationSchedule.objects.select_related('tower', 'service_fee', 'created_by').get(pk=pk)
        except ServiceFeeGenerationSchedule.DoesNotExist:
            return None

    def get(self, request, pk):
        """
        Get a specific schedule
        """
        # View permission for reading a schedule
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            schedule = self.get_object(pk)
            if not schedule:
                return Response({
                    'success': False,
                    'message': 'Schedule not found'
                }, status=status.HTTP_404_NOT_FOUND)

            serializer = ServiceFeeGenerationScheduleSerializer(schedule)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving schedule: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, pk):
        """
        Update a schedule (full update)
        """
        # Edit permission for updating schedule
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            schedule = self.get_object(pk)
            if not schedule:
                return Response({
                    'success': False,
                    'message': 'Schedule not found'
                }, status=status.HTTP_404_NOT_FOUND)

            serializer = ServiceFeeGenerationScheduleSerializer(schedule, data=request.data, context={'request': request})
            
            if serializer.is_valid():
                serializer.save()
                return Response({
                    'success': True,
                    'message': 'Schedule updated successfully',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': 'Validation error',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error updating schedule: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, pk):
        """
        Partially update a schedule
        """
        # Edit permission for partial update
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            schedule = self.get_object(pk)
            if not schedule:
                return Response({
                    'success': False,
                    'message': 'Schedule not found'
                }, status=status.HTTP_404_NOT_FOUND)

            serializer = ServiceFeeGenerationScheduleSerializer(schedule, data=request.data, partial=True, context={'request': request})
            
            if serializer.is_valid():
                serializer.save()
                return Response({
                    'success': True,
                    'message': 'Schedule updated successfully',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': 'Validation error',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error updating schedule: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        """
        Delete a schedule
        """
        # Edit permission for deleting schedule
        self.required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
        try:
            schedule = self.get_object(pk)
            if not schedule:
                return Response({
                    'success': False,
                    'message': 'Schedule not found'
                }, status=status.HTTP_404_NOT_FOUND)

            schedule.delete()
            return Response({
                'success': True,
                'message': 'Schedule deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({'success': False, 'message': str(e)}, status=500)


class UnitLedgerView(APIView):
    """
    Comprehensive API for unit financial data.
    - If unit_id is provided: Returns detailed ledger (vouchers), bills, and summary.
    - If unit_id is NOT provided: Returns a summary list of all units with outstanding balances.
    Serves: UnitReceivables, UnitLedger, and UnitPaymentHistory pages.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get(self, request):
        self.required_permission_id = [PERMISSION_VIEW_BILLING_MANAGEMENT, PERMISSION_VIEW_UNIT_PAYMENT_HISTORY]
        unit_id = request.query_params.get('unit_id')
        
        try:
            return self.get_unit_detail(request, unit_id)
        except Exception as e:
            import traceback
            print(f"Error in UnitLedgerView: {str(e)}")
            print(traceback.format_exc())
            return Response({'success': False, 'message': str(e)}, status=500)

    def get_unit_detail(self, request, unit_id):
        """Returns detailed ledger for a single unit or all units if unit_id is empty."""
        from django.db import connection
        import json

        # Pagination parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 1000))
        offset = (page - 1) * page_size

        # Get additional search/filter parameters
        tower_id = request.query_params.get('tower_id')
        search = request.query_params.get('search')

        # Construct unit CTE filter (relevant_units)
        unit_filters = []
        unit_params = []
        if unit_id:
            unit_filters.append("u.id = %s")
            unit_params.append(unit_id)
        if tower_id and tower_id != 'All Towers':
            tids = [tid.strip() for tid in str(tower_id).split(',') if tid.strip()]
            if tids:
                placeholders = ', '.join(['%s'] * len(tids))
                unit_filters.append(f"t.id IN ({placeholders})")
                unit_params.extend(tids)
        if search:
            unit_filters.append("(u.unit_name LIKE %s OR u.primary_name LIKE %s OR u.primary_number LIKE %s OR t.tower_name LIKE %s)")
            search_param = f"%{search}%"
            unit_params.extend([search_param] * 4)

        unit_filter = "WHERE " + " AND ".join(unit_filters) if unit_filters else ""

        # Construct VOD filter (used in 2 UNION ALL arms of voucher_data)
        vod_filter = "vod.unit_id = %s" if unit_id else "1=1"
        vod_params = [unit_id] if unit_id else []

        # Final query parameters mapping to 1 unit_filter + 2 vod_filters
        params = unit_params + (vod_params * 2)

        # 1. Fetch Vouchers (Transaction History)
        vouchers_sql = f"""
            WITH relevant_units AS (
                SELECT 
                    u.id AS unit_id,
                    u.unit_name AS unit_display,
                    u.unit_name,
                    u.primary_name as resident_name,
                    u.primary_number AS primary_contact,
                    u.primary_number,
                    t.tower_name 
                FROM towers_unit u 
                JOIN towers_floor f ON u.floor_id = f.id
                JOIN towers_tower t ON f.tower_id = t.id
                {unit_filter}
            ),
            voucher_data AS (
                -- Vouchers from Payments and Adjustments (Receipts, Advance Usage, Waivers)
                SELECT 
                    null as service_status,
                    null as remaining_amount,
                    null as due_date,
                    null as service_period_month,
                    null as service_period_year,
                    vod.debitAmount AS debit,
                    vod.creditAmount AS credit,
                    vod.description AS narration,
                    vod.account_id,
                    vod.account_holder_id,
                    vod.account_holder_type,
                    vod.unit_id,
                    vod.voucherEntry_id,
                    vod.id AS voucher_detail_id,
                    v.id AS voucher_id,
                    v.referenceNumber,
                    v.voucherType_id,
                    v.entryDate AS voucherDate,
                    v.narration AS voucher_narration,
                    v.totalDebit AS total_amount,
                    v.totalDebit AS total_debit,
                    v.totalCredit AS total_credit,
                    v.entryDate
                FROM accounts_voucherentry v
                JOIN accounts_voucherentrydetails vod ON v.id = vod.voucherEntry_id
                JOIN accounts_vouchertype vt ON v.voucherType_id = vt.id
                WHERE {vod_filter} 
                AND vt.name IN ('ServiceFeePayment', 'AdvancePayment', 'ServiceFeeAdjustment')

                UNION ALL

                -- Vouchers directly linked to Bills (Revenue/Receivable)
                -- We exclude Payment/Adjustment types here to ensure branches are mutually exclusive
                SELECT 
                    sfp.service_status,
                    sfp.remaining_amount,
                    sfp.due_date,
                    sfp.service_period_month,
                    sfp.service_period_year,
                    vod.debitAmount AS debit,
                    vod.creditAmount AS credit,
                    vod.description AS narration,
                    vod.account_id,
                    vod.account_holder_id,
                    vod.account_holder_type,
                    vod.unit_id,
                    vod.voucherEntry_id,
                    vod.id AS voucher_detail_id,
                    v.id AS voucher_id,
                    v.referenceNumber,
                    v.voucherType_id,
                    v.entryDate AS voucherDate,
                    v.narration AS voucher_narration,
                    v.totalDebit AS total_amount,
                    v.totalDebit AS total_debit,
                    v.totalCredit AS total_credit,
                    v.entryDate
                FROM service_fee_management_servicefeegenerate sfp
                JOIN accounts_voucherentry v ON sfp.bill_number COLLATE utf8mb4_unicode_ci = v.referenceNumber COLLATE utf8mb4_unicode_ci
                JOIN accounts_voucherentrydetails vod ON v.id = vod.voucherEntry_id
                JOIN accounts_vouchertype vt ON v.voucherType_id = vt.id
                WHERE {vod_filter}
                AND vt.name NOT IN ('ServiceFeePayment', 'AdvancePayment', 'ServiceFeeAdjustment')
            )
            SELECT DISTINCT
                vd.*,
                ru.unit_display,
                ru.tower_name,
                ru.resident_name,
                vt.name AS type,
                vt.displayName AS display_name,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'account_name', a.accountName, 
                            'account_code', a.accountCode, 
                            'debit', vod2.debitAmount, 
                            'credit', vod2.creditAmount,
                            'description', vod2.description,
                            'type', a.accountType,
                            'unit_id', vod2.unit_id,
                            'account_holder_id', vod2.account_holder_id,
                            'account_holder_type', vod2.account_holder_type
                        )
                    )
                    FROM accounts_voucherentrydetails vod2 
                    JOIN accounts_account a ON vod2.account_id = a.id 
                    WHERE vod2.voucherEntry_id = vd.voucher_id
                    AND vod2.unit_id IS NOT NULL
                ) AS details
            FROM voucher_data vd
            JOIN relevant_units ru ON vd.unit_id = ru.unit_id
            LEFT JOIN accounts_vouchertype vt ON vd.voucherType_id = vt.id
            ORDER BY vd.entryDate ASC, vd.voucher_id ASC, vd.voucher_detail_id ASC
        """

        with connection.cursor() as cursor:
            # Execute Vouchers Query with dynamic parameters
            cursor.execute(vouchers_sql, params)
            voucher_columns = [col[0] for col in cursor.description]
            vouchers = [dict(zip(voucher_columns, row)) for row in cursor.fetchall()]

        # Process Vouchers (JSON parsing) and calculate summary
        total_dr = 0
        total_cr = 0
        unpaid_bills_count = 0
        seen_bills = set()

        for v in vouchers:
            if isinstance(v.get('details'), str):
                v['details'] = json.loads(v['details'])
            elif v.get('details') is None:
                v['details'] = []
            
            # Calculate metrics
            dr = float(v.get('debit') or 0)
            cr = float(v.get('credit') or 0)
            total_dr += dr
            total_cr += cr

            # Unpaid bills logic
            st = v.get('service_status')
            ref = v.get('referenceNumber')
            if st in ['due', 'partial', 'overdue'] and ref and ref.startswith('BILL-') and ref not in seen_bills:
                unpaid_bills_count += 1
                seen_bills.add(ref)

        total_outstanding = total_dr - total_cr

        return Response({
            'success': True,
            'results': vouchers,
            'summary': {
                'total_dr': total_dr,
                'total_cr': total_cr,
                'total_outstanding': total_outstanding,
                'unpaid_bills_count': unpaid_bills_count
            },
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': len(vouchers)
            }
        }, status=200)




class PaymentHistoryView(APIView):
    """
    Enhanced Payment History View mimicking columns of BillingDetailedListView
    but filtered by specific month/year for the Payment History tab.
    Supports broad filtering by tower, unit, status, and payment method.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_UNIT_PAYMENT_HISTORY]

    def get(self, request):
        try:
            # Helper function to parse comma-separated values or lists
            def parse_filter_values(value):
                if not value:
                    return []
                if isinstance(value, list):
                    return [str(v).strip() for v in value if str(v).strip()]
                if isinstance(value, str):
                    return [v.strip() for v in value.split(',') if v.strip()]
                return [str(value)]

            # Get parameters
            service_period_month = request.query_params.get('service_period_month')
            service_period_year = request.query_params.get('service_period_year')
            
            # Support multiple param names for tower_id (frontend) and tower_ids (legacy)
            tower_ids_param = (
                request.query_params.getlist('tower_id') or 
                request.query_params.getlist('tower_ids') or 
                request.query_params.get('tower_id') or 
                request.query_params.get('tower_ids')
            )
            tower_values = parse_filter_values(tower_ids_param)

            # Support unit (legacy), unit_id (legacy), unit_ids, and unit_id_list (new frontend)
            unit_ids_param = (
                request.query_params.getlist('unit_id_list') or 
                request.query_params.getlist('unit_ids') or 
                request.query_params.get('unit') or 
                request.query_params.get('unit_id') or
                request.query_params.get('unit_ids') or
                request.query_params.get('unit_id_list')
            )
            unit_values = parse_filter_values(unit_ids_param)
            
            # Payment Method Filter
            method_ids_param = (
                request.query_params.getlist('method') or 
                request.query_params.getlist('payment_method_ids') or 
                request.query_params.get('method') or 
                request.query_params.get('payment_method_ids')
            )
            method_values = parse_filter_values(method_ids_param)

            # Dates, Search, Amounts
            payment_date_start = request.query_params.get('payment_date_start')
            payment_date_end = request.query_params.get('payment_date_end')
            search = request.query_params.get('search')
            min_amount = request.query_params.get('min_amount')
            max_amount = request.query_params.get('max_amount')
            advance_filter = request.query_params.get('advance_filter')
            status_filter = request.query_params.getlist('status')
            status_values = parse_filter_values(status_filter)
            
            receipt_id_param = request.query_params.get('receipt_id') or request.query_params.get('receiptNo')
            receipt_values = parse_filter_values(receipt_id_param)
            
            # Building filters for both UNION parts
            # Part 1: Bills (sfp)
            # Part 2: Pure Advance Payments (spd)
            
            where_p1 = ["1=1"]
            params_p1 = []
            
            where_p2 = [
                "spd.advance_payment_id IS NOT NULL",
                "spd.payment_type = 'advance_payment'"  # Consistent: use 'advance_payment' for all advance payments
            ]
            params_p2 = []

            # 0. Receipt ID Filter
            if receipt_values:
                placeholders = ','.join(['%s'] * len(receipt_values))
                where_p1.append(f"spd.receipt_id IN ({placeholders})")
                params_p1.extend(receipt_values)
                where_p2.append(f"spd.receipt_id IN ({placeholders})")
                params_p2.extend(receipt_values)

            # IMPORTANT: Part 2 (Pure Advances) is now enabled to show overpayments and standalone advances
            # where_p2.append("1=0")  # Removed: Advance payments should be visible in history

            # Only show records that have actual payment details recorded
            # Include both regular bill payments AND auto-applied advance (payment_type='advance_payment' with servicefeepaymentid set)
            where_p1.append("sfp.total_paid > 0")

            # 1. Month/Year (Only applies to Bills) - OPTIONAL
            # If not specified, show all payment records (both bills and pure advances)
            if service_period_month and service_period_year:
                # Part 1: Filter bills by service period
                where_p1.append("sfp.service_period_month = %s")
                params_p1.append(int(service_period_month))
                where_p1.append("sfp.service_period_year = %s")
                params_p1.append(int(service_period_year))
                
                # Part 2: Show advances created in the same month/year (by payment date, not service period)
                # This ensures overpayment advances appear with their related bill payments
                where_p2.append("MONTH(spd.payment_date) = %s")
                params_p2.append(int(service_period_month))
                where_p2.append("YEAR(spd.payment_date) = %s")
                params_p2.append(int(service_period_year))
            elif service_period_month:
                where_p1.append("sfp.service_period_month = %s")
                params_p1.append(int(service_period_month))
                # Don't filter Part 2 by month alone (too broad without year)
                if "1=0" not in where_p2: where_p2.append("1=0")
            elif service_period_year:
                where_p1.append("sfp.service_period_year = %s")
                params_p1.append(int(service_period_year))
                # Part 2: Show advances created in the same year
                where_p2.append("YEAR(spd.payment_date) = %s")
                params_p2.append(int(service_period_year))

            # 2. Tower
            if tower_values:
                t_ids = [int(x) for x in tower_values if str(x).isdigit()]
                if t_ids:
                    placeholders = ','.join(['%s'] * len(t_ids))
                    where_p1.append(f"t.id IN ({placeholders})")
                    params_p1.extend(t_ids)
                    where_p2.append(f"t.id IN ({placeholders})")
                    params_p2.extend(t_ids)

            # 3. Unit
            if unit_values:
                u_ids = [int(x) for x in unit_values if str(x).isdigit()]
                if u_ids:
                    placeholders = ','.join(['%s'] * len(u_ids))
                    where_p1.append(f"u.id IN ({placeholders})")
                    params_p1.extend(u_ids)
                    where_p2.append(f"u.id IN ({placeholders})")
                    params_p2.extend(u_ids)

            # 4. Status
            if status_values:
                placeholders = ','.join(['%s'] * len(status_values))
                where_p1.append(f"sfp.payment_status IN ({placeholders})")
                params_p1.extend(status_values)
                # Pure advances are effectively 'completed'
                if 'completed' not in status_values:
                    if "1=0" not in where_p2: where_p2.append("1=0")

            # 5. Payment Method
            if method_values:
                m_ids = [int(x) for x in method_values if str(x).isdigit()]
                if m_ids:
                    placeholders = ','.join(['%s'] * len(m_ids))
                    where_p1.append(f"spd.payment_method_id IN ({placeholders})")
                    params_p1.extend(m_ids)
                    where_p2.append(f"spd.payment_method_id IN ({placeholders})")
                    params_p2.extend(m_ids)

            # 6. Amount Filter
            # For bills (Part 1): Use subquery to filter by total bill amount, then show all transactions
            # For advances (Part 2): Filter by advance amount (spd.total_paid)
            if min_amount or max_amount:
                # Build amount filter for bills
                amount_conditions = []
                amount_params = []
                
                if min_amount:
                    amount_conditions.append("sfp2.amount >= %s")
                    amount_params.append(float(min_amount))
                if max_amount:
                    amount_conditions.append("sfp2.amount <= %s")
                    amount_params.append(float(max_amount))
                
                amount_filter = " AND ".join(amount_conditions)
                
                # Add subquery filter for Part 1 (bills)
                where_p1.append(f"""
                    sfp.id IN (
                        SELECT sfp2.id 
                        FROM service_fee_management_servicefeegenerate sfp2 
                        WHERE {amount_filter}
                    )
                """)
                params_p1.extend(amount_params)
                
                # For Part 2 (pure advances), filter by transaction amount
                if min_amount:
                    where_p2.append("spd.total_paid >= %s")
                    params_p2.append(float(min_amount))
                if max_amount:
                    where_p2.append("spd.total_paid <= %s")
                    params_p2.append(float(max_amount))

            # 7. Advance Filter
            if advance_filter == 'with_advance':
                where_p1.append("EXISTS (SELECT 1 FROM service_fee_payment_details sfpd3 WHERE sfpd3.servicefeepaymentid_id = sfp.id AND sfpd3.payment_type = 'advance_payment')")
                # Pure advances are advances
            elif advance_filter == 'without_advance':
                where_p1.append("NOT EXISTS (SELECT 1 FROM service_fee_payment_details sfpd4 WHERE sfpd4.servicefeepaymentid_id = sfp.id AND sfpd4.payment_type = 'advance_payment')")
                if "1=0" not in where_p2: where_p2.append("1=0")

            # 8. Payment Date Range
            if payment_date_start:
                where_p1.append("spd.payment_date >= %s")
                params_p1.append(payment_date_start)
                where_p2.append("spd.payment_date >= %s")
                params_p2.append(payment_date_start)
            if payment_date_end:
                where_p1.append("spd.payment_date <= %s")
                params_p1.append(payment_date_end)
                where_p2.append("spd.payment_date <= %s")
                params_p2.append(payment_date_end)

            # 9. Search (Broad search including Unit, Owner, Receipt IDs)
            if search:
                p = f'%{search}%'
                where_p1.append("""
                    (u.unit_name LIKE %s OR u.primary_name LIKE %s OR u.secondary_name LIKE %s OR 
                     t.tower_name LIKE %s OR u.primary_email LIKE %s OR u.secondary_email LIKE %s OR
                     sfp.owner_name LIKE %s OR sfp.owner_email LIKE %s OR
                     spd.receipt_id LIKE %s OR spd.transaction_id LIKE %s)
                """)
                params_p1.extend([p] * 10)
                where_p2.append("""
                    (u.unit_name LIKE %s OR u.primary_name LIKE %s OR u.secondary_name LIKE %s OR 
                     t.tower_name LIKE %s OR u.primary_email LIKE %s OR u.secondary_email LIKE %s OR
                     m_owner.full_name LIKE %s OR m_owner.general_email LIKE %s OR
                     spd.receipt_id LIKE %s OR spd.transaction_id LIKE %s)
                """)
                params_p2.extend([p] * 10)

            where_clause_p1 = " AND ".join(where_p1)
            where_clause_p2 = " AND ".join(where_p2)
            
            # SQL logic matches BillingDetailedListView columns
            # UNION: Regular bill payments + Pure advance payments
            sql = f"""
                SELECT * FROM (
                    -- Part 1: Bill Payments (One row per transaction)
                    SELECT 
                        DATE_FORMAT(
                            CONCAT(
                                LPAD(sfp.service_period_year, 4, '0'), '-',
                                LPAD(sfp.service_period_month, 2, '0'), '-01'
                            ), 
                            '%%Y-%%m-01'
                        ) AS service_month,
                        sfp.service_period_month,
                        sfp.service_period_year,
                        DATE_FORMAT(
                            CONCAT(
                                LPAD(sfp.service_period_year, 4, '0'), '-',
                                LPAD(sfp.service_period_month, 2, '0'), '-01'
                            ), 
                            '%%M %%Y'
                        ) AS month_name,
                        
                        CAST(sfp.amount AS CHAR) AS original_amount,
                        CAST(sfp.amount AS CHAR) AS service_fee_amount,
                        CAST(sfp.amount AS CHAR) AS bill_amount, -- Added for consistency with receipt PDF
                        CAST(sfp.amount AS CHAR) AS total_amount,
                        CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                        CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                        CAST(spd.total_paid AS CHAR) AS paid_amount,
                        CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,
                        CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                        CAST(sfp.gross_penalty_amount AS CHAR) AS gross_penalty_amount,
                        CASE WHEN spd.payment_type = 'advance_payment' THEN CAST(spd.total_paid AS CHAR) ELSE '0' END AS advance_amount,
                        
                        sfp.due_date,
                        spd.created_at, -- Use transaction creation time
                        DATE_FORMAT(spd.created_at, '%%b %%d, %%Y') AS invoiceDate,
                        sfp.payment_status,
                        sfp.service_status,
                        
                        u.id AS unit_id,
                        u.unit_name,
                        u.unit_name AS unit_display,
                        t.id AS tower_id,
                        t.tower_name,
                        
                        sfp.service_fee_id,
                        sfp.id AS payment_id, -- Original bill ID
                        sfp.bill_number,
                        
                        sfp.owner_id,
                        sfp.owner_name,
                        sfp.owner_email,
                        sfp.owner_phone,
                        
                        sfp.owner_name AS resident_name,
                        sfp.owner_name AS primary_name,
                        sfp.owner_email AS resident_email,
                        sfp.owner_email AS primary_email,
                        sfp.owner_phone AS resident_number,
                        sfp.owner_phone AS primary_number,
                        
                        sfp.account_holder_type,
                        sfp.account_holder_id,
                        
                        /*COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items,
                        CAST(COALESCE(item_agg.penalty_amount, 0) AS CHAR) AS penalty_amount,*/
                        COALESCE(m.full_name, 'System') AS created_by_name,
                        
                        -- Wrap single transaction in array for frontend compatibility
                        JSON_ARRAY(
                            JSON_OBJECT(
                                'id', spd.id,
                                'billing_id', spd.billing_id,
                                'transaction_id', spd.transaction_id,
                                'receipt_id', spd.receipt_id,
                                'payment_date', DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'payment_method', COALESCE(pm.method_name, spd.other_method_name, 'N/A'),
                                'amount_paid', CAST(spd.total_paid AS CHAR),
                                'reference_number', spd.reference_number,
                                'payment_type', spd.payment_type,
                                'notes', spd.notes,
                                'received_by_id', spd.received_by_id,
                                'received_by_name', COALESCE(m_rec.full_name, spd.received_by_name, 'System'),
                                'to_account_name', spd.to_account_name,
                                'to_account_number', spd.to_account_number,
                                'voucher_id', spd.voucher_id,
                                'payment_account_code', spd.payment_account_code,
                                'payment_account_name', spd.payment_account_name,
                                'service_period_month', sfp.service_period_month,
                                'service_period_year', sfp.service_period_year,
                                'penalty_amount', CAST(sfp.penalty_amount AS CHAR),
                                'waived_amount', CAST(sfp.waived_amount AS CHAR),
                                'gross_penalty_amount', CAST(sfp.gross_penalty_amount AS CHAR),
                                'service_status', sfp.service_status,
                                'amount', sfp.amount,
                                'month_name', DATE_FORMAT(
                                    CONCAT(
                                        LPAD(sfp.service_period_year, 4, '0'), '-',
                                        LPAD(sfp.service_period_month, 2, '0'), '-01'
                                    ), 
                                    '%%M %%Y'
                                )
                            )
                        ) AS payment_details

                    FROM service_fee_payment_details spd
                    INNER JOIN service_fee_management_servicefeegenerate sfp ON sfp.id = spd.servicefeepaymentid_id
                    INNER JOIN towers_unit u ON u.id = sfp.unit_id
                    INNER JOIN towers_floor f ON u.floor_id = f.id
                    INNER JOIN towers_tower t ON f.tower_id = t.id
                    LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
                    LEFT JOIN user_member m ON spd.created_by_id = m.id
                    LEFT JOIN user_member m_rec ON spd.received_by_id = m_rec.id
                    
                   /* LEFT JOIN (
                        SELECT 
                            sfi.service_fee_payment_id,
                            JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'id', sfi.id,
                                    'item_type', sfi.item_type,
                                    'item_name', sfi.item_name,
                                    'amount', CAST(sfi.amount AS CHAR),
                                    'description', sfi.description,
                                    'bill_category_id', sfi.bill_category_id,
                                    'bill_category_name', sfi.item_name,
                                    'bill_upload_id', bud.bill_upload_id,
                                    'upload_month', bud.upload_month,
                                    'upload_year', bud.upload_year,
                                    'previous_reading', CAST(bud.previous_reading AS CHAR),
                                    'current_reading', CAST(bud.current_reading AS CHAR),
                                    'consumption', CAST(bud.consumption AS CHAR),
                                    'unit_of_measurement', bud.unit_of_measurement,
                                    'price_per_unit', CAST(bud.price_per_unit AS CHAR),
                                    'bill_detail_amount', CAST(bud.amount AS CHAR),
                                    'penalty_tier_id', sfi.penalty_tier_id,
                                    'tier_name', lpt.tier_name,
                                    'tier_percentage', lpt.penalty_percentage,
                                    'tier_days_overdue', lpt.days_overdue
                                )
                            ) as item_details,
                            SUM(CASE WHEN sfi.item_type = 'penalty' THEN sfi.amount ELSE 0 END) as penalty_amount
                        FROM service_fee_management_servicefeeitem sfi
                        LEFT JOIN service_fee_management_servicefeepaymentlatepenaltytier lpt 
                            ON sfi.penalty_tier_id = lpt.id AND lpt.status = 'active'
                        LEFT JOIN bill_upload_details bud 
                            ON sfi.bill_upload_detail_id = bud.id
                        GROUP BY sfi.service_fee_payment_id
                    ) item_agg ON item_agg.service_fee_payment_id = sfp.id*/
                    
                    WHERE {where_clause_p1}
                    
                    UNION ALL
                    
                    -- Part 2: Pure Advance Payments (no bill)
                    SELECT 
                        NULL AS service_month,
                        NULL AS service_period_month,
                        NULL AS service_period_year,
                        'Advance Payment' AS month_name,
                        
                        '0' AS original_amount,
                        '0' AS service_fee_amount,
                        '0' AS bill_amount, -- Added for consistency
                        CAST(spd.total_paid AS CHAR) AS total_amount,
                        '0' AS due_amount,
                        '0' AS remaining_amount,
                        CAST(spd.total_paid AS CHAR) AS paid_amount,
                        '0' AS penalty_amount,
                        '0' AS waived_amount,
                        '0' AS gross_penalty_amount,
                        CAST(spd.total_paid AS CHAR) AS advance_amount,
                        
                        NULL AS due_date,
                        spd.created_at,
                        DATE_FORMAT(spd.created_at, '%%b %%d, %%Y') AS invoiceDate,
                        'completed' AS payment_status,
                        'advance' AS service_status,
                        
                        u.id AS unit_id,
                        u.unit_name,
                        u.unit_name AS unit_display,
                        t.id AS tower_id,
                        t.tower_name,
                        
                        NULL AS service_fee_id,
                        NULL AS payment_id,
                        NULL AS bill_number, 
                        
                        adv.account_holder_id AS owner_id,
                        COALESCE(m_owner.full_name, u.primary_name) AS owner_name,
                        COALESCE(m_owner.general_email, u.primary_email) AS owner_email,
                        COALESCE(m_owner.general_contact, u.primary_number) AS owner_phone,
                        
                        COALESCE(m_owner.full_name, u.primary_name) AS resident_name,
                        COALESCE(m_owner.full_name, u.primary_name) AS primary_name,
                        COALESCE(m_owner.general_email, u.primary_email) AS resident_email,
                        COALESCE(m_owner.general_email, u.primary_email) AS primary_email,
                        COALESCE(m_owner.general_contact, u.primary_number) AS resident_number,
                        COALESCE(m_owner.general_contact, u.primary_number) AS primary_number,
                        
                        adv.account_holder_type,
                        adv.account_holder_id,
                        
                       /* JSON_ARRAY() AS service_fee_items,
                        '0' AS penalty_amount,*/
                        COALESCE(m.full_name, 'System') AS created_by_name,
                        
                        JSON_ARRAY(
                            JSON_OBJECT(
                                'id', spd.id,
                                'billing_id', spd.billing_id,
                                'transaction_id', spd.transaction_id,
                                'receipt_id', spd.receipt_id,
                                'payment_date', DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'payment_method', COALESCE(pm.method_name, spd.other_method_name, 'N/A'),
                                'amount_paid', CAST(spd.total_paid AS CHAR),
                                'reference_number', spd.reference_number,
                                'payment_type', spd.payment_type,
                                'notes', spd.notes,
                                'received_by_id', spd.received_by_id,
                                'received_by_name', COALESCE(m_rec.full_name, spd.received_by_name, 'System'),
                                'to_account_name', spd.to_account_name,
                                'to_account_number', spd.to_account_number,
                                'voucher_id', spd.voucher_id,
                                'payment_account_code', spd.payment_account_code,
                                'payment_account_name', spd.payment_account_name,
                                'service_period_month', NULL,
                                'service_period_year', NULL,
                                'penalty_amount', '0',
                                'waived_amount', '0',
                                'gross_penalty_amount', '0'
                            )
                        ) AS payment_details

                    FROM service_fee_payment_details spd
                    INNER JOIN service_fee_advance_payments adv ON spd.advance_payment_id = adv.id
                    INNER JOIN towers_unit u ON adv.unit_id = u.id
                    INNER JOIN towers_floor f ON u.floor_id = f.id
                    INNER JOIN towers_tower t ON f.tower_id = t.id
                    LEFT JOIN towers_owner o ON adv.account_holder_id = o.id AND adv.account_holder_type = 'owner'
                    LEFT JOIN user_member m_owner ON o.member_id = m_owner.id
                    LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
                    LEFT JOIN user_member m ON spd.created_by_id = m.id
                    LEFT JOIN user_member m_rec ON spd.received_by_id = m_rec.id
                    
                    WHERE {where_clause_p2}
                ) combined_results
                ORDER BY created_at DESC
            """
            
            with connection.cursor() as cursor:
                cursor.execute(sql, params_p1 + params_p2)
                columns = [col[0] for col in cursor.description]
                raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]

            # Consolidate payments with the same receipt_id into single receipts
            # This ensures bill + advance payments in the same transaction appear as one receipt
            consolidated_payments = {}
            
            for payment in raw_data:
                # Parse payment_details to get receipt_id
                payment_details = []
                try:
                    payment_details = (
                        json.loads(payment['payment_details']) 
                        if isinstance(payment['payment_details'], str)
                        else (payment['payment_details'] or [])
                    )
                except (json.JSONDecodeError, TypeError):
                    payment_details = []
                
                # Get receipt_id from payment_details or fallback to transaction_id
                receipt_id = None
                if payment_details and len(payment_details) > 0:
                    receipt_id = payment_details[0].get('receipt_id')
                
                if not receipt_id:
                    # Fallback: use transaction_id from payment_details or from main record
                    if payment_details and len(payment_details) > 0:
                        receipt_id = payment_details[0].get('transaction_id')
                    if not receipt_id:
                        receipt_id = payment.get('transaction_id') or f"TXN-{payment.get('payment_id', payment.get('id', 'unknown'))}"
                
                # Use receipt_id as the consolidation key
                if receipt_id not in consolidated_payments:
                    # Initialize consolidated payment with first payment's data
                    consolidated_payments[receipt_id] = {
                        **payment,
                        'payment_details': payment_details.copy(),
                        'advance_amount': Decimal('0.00'),
                        'bill_amount': Decimal('0.00'),
                        'total_paid_amount': Decimal('0.00'),
                    }
                
                # Add to consolidated payment
                consolidated = consolidated_payments[receipt_id]
                
                # Parse amounts from current payment record
                paid_amount = Decimal(str(payment.get('paid_amount', '0') or '0'))
                advance_amount_from_record = Decimal(str(payment.get('advance_amount', '0') or '0'))
                
                # If this record has advance_amount set, use it; otherwise calculate from paid_amount
                if advance_amount_from_record > 0:
                    bill_amount_from_record = paid_amount - advance_amount_from_record
                else:
                    # Check if this is a pure advance payment (no service_period_month)
                    if not payment.get('service_period_month') and not payment.get('service_period_year'):
                        # Pure advance payment
                        bill_amount_from_record = Decimal('0.00')
                        advance_amount_from_record = paid_amount
                    else:
                        # Bill payment - no advance in this record
                        bill_amount_from_record = paid_amount
                        advance_amount_from_record = Decimal('0.00')
                
                # Update totals
                consolidated['total_paid_amount'] += paid_amount
                consolidated['advance_amount'] += advance_amount_from_record
                consolidated['bill_amount'] += bill_amount_from_record
                
                # Merge payment_details (avoid duplicates by billing_id)
                existing_billing_ids = {pd.get('billing_id') for pd in consolidated['payment_details'] if pd.get('billing_id')}
                for pd in payment_details:
                    billing_id = pd.get('billing_id')
                    if billing_id and billing_id not in existing_billing_ids:
                        consolidated['payment_details'].append(pd)
                        existing_billing_ids.add(billing_id)
                    elif not billing_id:
                        # If no billing_id, check by receipt_id to avoid duplicates
                        pd_receipt_id = pd.get('receipt_id')
                        existing_receipt_ids = {p.get('receipt_id') for p in consolidated['payment_details']}
                        if pd_receipt_id not in existing_receipt_ids:
                            consolidated['payment_details'].append(pd)
                
                # If this is a bill payment, keep/update the bill details
                if payment.get('service_period_month') and payment.get('service_period_year'):
                    # This is a bill payment - update bill-specific fields
                    consolidated['service_period_month'] = payment.get('service_period_month')
                    consolidated['service_period_year'] = payment.get('service_period_year')
                    consolidated['month_name'] = payment.get('month_name')
                    consolidated['service_month'] = payment.get('service_month')
                    consolidated['original_amount'] = payment.get('original_amount')
                    consolidated['service_fee_amount'] = payment.get('service_fee_amount')
                    consolidated['due_amount'] = payment.get('due_amount')
                    consolidated['remaining_amount'] = payment.get('remaining_amount')
                    consolidated['penalty_amount'] = payment.get('penalty_amount')
                    consolidated['waived_amount'] = payment.get('waived_amount')
                    consolidated['gross_penalty_amount'] = payment.get('gross_penalty_amount')
                    consolidated['payment_id'] = payment.get('payment_id')
                    consolidated['service_fee_id'] = payment.get('service_fee_id')
                    consolidated['bill_number'] = payment.get('bill_number')
                    consolidated['due_date'] = payment.get('due_date')
                    consolidated['payment_status'] = payment.get('payment_status')
                    consolidated['service_status'] = payment.get('service_status')
            
            # Convert consolidated payments back to list and update payment_details JSON
            final_payments = []
            for receipt_id, consolidated in consolidated_payments.items():
                # Convert payment_details list back to JSON string
                consolidated['payment_details'] = json.dumps(consolidated['payment_details'])
                # Convert Decimal amounts to strings for JSON serialization
                consolidated['paid_amount'] = str(consolidated['total_paid_amount'])
                consolidated['advance_amount'] = str(consolidated['advance_amount'])
                consolidated['total_amount'] = str(consolidated['total_paid_amount'])
                final_payments.append(consolidated)
            
            # Sort by created_at descending (newest first)
            final_payments.sort(key=lambda x: x.get('created_at', ''), reverse=True)

            # Return structure matching BillingDetailedListView
            
            # PDF Download Support
            if request.query_params.get('download') == 'pdf':
                if not final_payments:
                    return Response({'success': False, 'message': 'No payment record found to generate PDF.'}, status=404)
                
                # Use the requested receipt if possible
                payment_to_download = final_payments[0]
                
                try:
                    from service_fee_management.utils.email_utils import generate_payment_receipt_html, generate_payment_receipt_pdf
                    from django.http import HttpResponse
                    
                    html_content = generate_payment_receipt_html(payment_to_download)
                    pdf_content = generate_payment_receipt_pdf(html_content, payment_to_download)
                    
                    if pdf_content:
                        response = HttpResponse(pdf_content, content_type='application/pdf')
                        rec_id = payment_to_download.get('receipt_id') or payment_to_download.get('transaction_id', 'receipt')
                        response['Content-Disposition'] = f'attachment; filename="Payment_Receipt_{rec_id}.pdf"'
                        return response
                    else:
                        return Response({'success': False, 'message': 'Failed to generate PDF content.'}, status=500)
                except Exception as pdf_err:
                    return Response({'success': False, 'message': f'PDF generation error: {str(pdf_err)}'}, status=500)

            return Response({'success': True, 'data': {'payments': final_payments}}, status=200)
            
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({'success': False, 'message': str(e)}, status=500)
            
# NOTE: UnitLedgerView has been removed/commented out as it referenced non-existent 'fee_name' field
# and was causing SQL errors. The endpoint was already disabled in urls.py.


class ServiceFeeBillingTransactionDeleteView(APIView):
    """
    View to delete a specific payment transaction (ServiceFeeBilling record).
    Strictly enforces that the payment method must be 'Cash'.
    Updates the related ServiceFeePayment record by:
    - Adding the deleted amount back to remaining_amount
    - Updating payment_status and service_status based on the new remaining_amount
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def delete(self, request, billing_id):
        # Require delete payment permission
        self.required_permission_id = [PERMISSION_DELETE_RECORDED_PAYMENT]
        
        try:
            with transaction.atomic():
                billing = ServiceFeeBilling.objects.select_related(
                    'payment_method',
                    'servicefeepaymentid',
                    'servicefeepaymentid__service_fee'
                ).get(id=billing_id)
                
                # Check if it has a payment method (is a payment transaction)
                if not billing.payment_method:
                    return Response({
                        'success': False,
                        'message': 'This is a generated bill, not a payment transaction. Cannot delete via this endpoint.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Check if payment method is Cash
                if billing.payment_method.method_name.lower() != 'cash':
                    return Response({
                        'success': False,
                        'message': 'You cannot delete this payment as its method is not Cash.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Get the related ServiceFeePayment record
                service_fee_payment = billing.servicefeepaymentid
                
                if not service_fee_payment:
                    return Response({
                        'success': False,
                        'message': 'Related payment record not found.'
                    }, status=status.HTTP_404_NOT_FOUND)
                
                # Get the amount being deleted
                deleted_amount = float(billing.total_paid) if billing.total_paid else 0
                
                # Get the service fee amount to calculate statuses
                # User modification: using amount from payment record instead of service_fee.fee_amount
                service_fee_amount = service_fee_payment.amount
                
                if service_fee_amount is None:
                    return Response({
                        'success': False,
                        'message': 'Service fee amount not found for this payment.'
                    }, status=status.HTTP_404_NOT_FOUND)
                
                total_fee_amount = float(service_fee_amount)
                
                # Calculate new remaining amount
                current_remaining = float(service_fee_payment.remaining_amount) if service_fee_payment.remaining_amount else 0
                new_remaining_amount = current_remaining + deleted_amount
                
                # Update the ServiceFeePayment record
                service_fee_payment.remaining_amount = Decimal(str(new_remaining_amount))
                
                # Determine new payment_status and service_status
                if new_remaining_amount >= total_fee_amount:
                    service_fee_payment.payment_status = 'pending'
                    service_fee_payment.service_status = 'due'
                elif new_remaining_amount > 0:
                    service_fee_payment.payment_status = 'pending'
                    service_fee_payment.service_status = 'partial'
                else:
                    service_fee_payment.payment_status = 'completed'
                    service_fee_payment.service_status = 'paid'
                
                # Save the updated ServiceFeePayment
                service_fee_payment.save()
                
                # Delete the billing transaction
                billing.delete()
                
                # Create audit trail
                try:
                    create_audit_trail(
                        request=request,
                        action='Delete',
                        model_name='ServiceFeeBilling',
                        record_id=billing_id,
                        description=f'Deleted cash payment transaction (Amount: {deleted_amount}). Updated payment status to {service_fee_payment.payment_status} and service status to {service_fee_payment.service_status}.'
                    )
                except Exception as audit_error:
                    print(f"Audit trail error: {str(audit_error)}")
                
                return Response({
                    'success': True,
                    'message': 'Payment transaction deleted successfully.',
                    'billing_pk': billing_id
                }, status=status.HTTP_200_OK)
            
        except ServiceFeeBilling.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Payment transaction not found.'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            print(f"Error deleting payment transaction: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error deleting payment transaction: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MobileUpcomingBillingView(APIView):
    """
    API endpoint to fetch upcoming month's billing information for mobile app
    This ensures mobile app shows correct upcoming payment amount after web edits
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        """
        Get upcoming billing data for the next month
        Returns billing records that exist for next month (if generated by web)
        """
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_OVERVIEW]
        
        try:
            from django.utils import timezone
            from django.db import connection
            from datetime import datetime
            from dateutil.relativedelta import relativedelta
            
            # Get current user's member information
            current_member = None
            user_contacts = []
            
            if request.user.is_authenticated:
                try:
                    current_member = Member.objects.get(user=request.user)
                    if current_member.general_contact:
                        user_contacts.append(current_member.general_contact)
                    if current_member.login_contact:
                        user_contacts.append(current_member.login_contact)
                except Member.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': 'User not found',
                        'data': {'billings': []}
                    }, status=404)
            
            # Calculate next month
            current_date = datetime.now()
            next_month_date = current_date + relativedelta(months=1)
            next_month = next_month_date.month
            next_year = next_month_date.year
            
            print(f"🔍 [MobileUpcomingBilling] Fetching for next month: {next_month}/{next_year}")
            
            # Query for next month's billing records
            # Use raw SQL to join with ServiceFeeBilling table
            with connection.cursor() as cursor:
                sql = """
                    SELECT 
                        sfb.id AS billing_id,
                        sfb.billing_amount,
                        sfb.total_paid,
                        sfb.billing_amount - sfb.total_paid AS remaining_amount,
                        sfb.due_date,
                        sfp.service_period_month,
                        sfp.service_period_year,
                        sfp.service_status,
                        u.id AS unit_id,
                        u.unit_name,
                        t.tower_name,
                        t.id AS tower_id,
                        sfp.service_fee_id,
                        sf_config.fee_amount AS fee_amount,
                        sf_config.due_day AS due_day
                    FROM service_fee_payment_details sfb
                    INNER JOIN service_fee_management_servicefeegenerate sfp ON sfb.servicefeepaymentid_id = sfp.id
                    INNER JOIN towers_unit u ON sfp.unit_id = u.id
                    INNER JOIN towers_floor f ON u.floor_id = f.id
                    INNER JOIN towers_tower t ON f.tower_id = t.id
                    LEFT JOIN service_fee_management_servicefeegenerationconfig sf_config ON sfp.generation_config_id = sf_config.id
                    WHERE sfp.service_period_month = %s
                    AND sfp.service_period_year = %s
                """
                
                params = [next_month, next_year]
                
                # Add access control for community members
                if current_member and not current_member.is_org_member:
                    contact_conditions = []
                    for contact in user_contacts:
                        contact_conditions.append("(u.primary_number = %s OR u.secondary_number = %s)")
                        params.extend([contact, contact])
                    
                    if contact_conditions:
                        sql += f" AND ({' OR '.join(contact_conditions)})"
                    else:
                        # No contact info - deny access
                        return Response({
                            'success': True,
                            'message': 'No access to billing data',
                            'data': {'billings': []}
                        }, status=200)
                
                cursor.execute(sql, params)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Format the response
            billings = []
            for row in results:
                billings.append({
                    'billing_id': row['billing_id'],
                    'unit_id': row['unit_id'],
                    'unit_name': row['unit_name'],
                    'tower_name': row['tower_name'],
                    'tower_id': row['tower_id'],
                    'service_fee_id': row['service_fee_id'],
                    'billing_amount': str(row['billing_amount']),
                    'fee_amount': str(row['fee_amount']),
                    'total_paid': str(row['total_paid']),
                    'remaining_amount': str(row['remaining_amount']),
                    'due_date': row['due_date'].isoformat() if row['due_date'] else None,
                    'service_period_month': row['service_period_month'],
                    'service_period_year': row['service_period_year'],
                    'service_status': row['service_status'],
                    'due_day': row['due_day']
                })
            
                        
            # CRITICAL FIX: If no billing records exist for next month,
            # fetch current service fee settings for user's units
            # This ensures mobile app shows CURRENT fee amount even before bills are generated
            if len(billings) == 0:
                print(f"\u26a0\ufe0f [MobileUpcomingBilling] No billing records found for {next_month}/{next_year}")
                print(f"   Fetching current service fee settings for user's units...")
                            
                # Query to get user's units with their CURRENT service fee settings
                # CRITICAL UPDATE: Logic to handle Unit-Specific vs Tower-Wide fees
                # 1. If a fee is assigned to specific units (via service_fee_servicefee_units), it ONLY applies to those units.
                # 2. If a fee has NO specific units assigned, it applies to ALL units in the linked tower.
                sql_current_fees = """
                    SELECT DISTINCT
                        u.id AS unit_id,
                        u.unit_name,
                        t.tower_name,
                        t.id AS tower_id,
                        sf.id AS service_fee_id,
                        sf.fee_amount,
                        sf.due_day
                    FROM towers_unit u
                    INNER JOIN towers_floor f ON u.floor_id = f.id
                    INNER JOIN towers_tower t ON f.tower_id = t.id
                    INNER JOIN service_fee_servicefee_towers sft ON sft.tower_id = t.id
                    INNER JOIN service_fee_servicefee sf ON sf.id = sft.servicefee_id
                    WHERE sf.is_active = 1
                    AND (
                        -- Case 1: Service Fee is specifically assigned to this unit
                        EXISTS (
                            SELECT 1 
                            FROM service_fee_servicefee_units sfu 
                            WHERE sfu.servicefee_id = sf.id 
                            AND sfu.unit_id = u.id 
                            AND sfu.is_active = 1
                        )
                        OR
                        -- Case 2: Service Fee is assigned to the tower AND NOT to any specific units (applies to all)
                        NOT EXISTS (
                            SELECT 1 
                            FROM service_fee_servicefee_units sfu_any 
                            WHERE sfu_any.servicefee_id = sf.id 
                            AND sfu_any.is_active = 1
                        )
                    )
                """
                            
                params_current = []
                            
                # Add access control for community members
                if current_member and not current_member.is_org_member:
                    contact_conditions = []
                    for contact in user_contacts:
                        contact_conditions.append("(u.primary_number = %s OR u.secondary_number = %s)")
                        params_current.extend([contact, contact])
                                
                    if contact_conditions:
                        sql_current_fees += f" AND ({' OR '.join(contact_conditions)})"
                    else:
                        # No contact info - return empty
                        return Response({
                            'success': True,
                            'message': 'No upcoming billing data',
                            'data': {'billings': [], 'next_month': next_month, 'next_year': next_year}
                        }, status=200)
                            
                # Create a NEW cursor context for the fallback query
                with connection.cursor() as cursor_fallback:
                    cursor_fallback.execute(sql_current_fees, params_current)
                    columns_current = [col[0] for col in cursor_fallback.description]
                    results_current = [dict(zip(columns_current, row)) for row in cursor_fallback.fetchall()]
                            
                # Create billing records from current service fee settings
                for row in results_current:
                    # Calculate due date for next month
                    import calendar
                    last_day = calendar.monthrange(next_year, next_month)[1]
                    due_day = min(row['due_day'], last_day)
                    due_date = f"{next_year}-{next_month:02d}-{due_day:02d}"
                                
                    billings.append({
                        'billing_id': None,  # No billing record yet
                        'unit_id': row['unit_id'],
                        'unit_name': row['unit_name'],
                        'tower_name': row['tower_name'],
                        'tower_id': row['tower_id'],
                        'service_fee_id': row['service_fee_id'],
                        'billing_amount': str(row['fee_amount']),  # Use current fee
                        'fee_amount': str(row['fee_amount']),      # Use current fee
                        'total_paid': '0',
                        'remaining_amount': str(row['fee_amount']),
                        'due_date': due_date,
                        'service_period_month': next_month,
                        'service_period_year': next_year,
                        'service_status': 'due',
                        'due_day': row['due_day'],
                        'is_synthetic': True  # Flag to indicate this is from current settings, not a generated bill
                    })
                            
                print(f"\u2705 [MobileUpcomingBilling] Created {len(billings)} synthetic billings from current service fee settings")
                        
            print(f"\u2705 [MobileUpcomingBilling] Found {len(billings)} billing records for next month")
            
            return Response({
                'success': True,
                'message': f'Upcoming billing for {next_month}/{next_year}',
                'data': {
                    'billings': billings,
                    'next_month': next_month,
                    'next_year': next_year
                }
            }, status=200)
            
        except Exception as e:
            import traceback
            print(f"❌ [MobileUpcomingBilling] Error: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error fetching upcoming billing: {str(e)}',
                'data': {'billings': []}
            }, status=500)


class MobileAccessCheckView(APIView):
    """
    Mobile-specific endpoint to check if user has access to service fees.
    
    Logic:
    - User must be an Owner OR active Resident of a unit with service fee records
    - Returns hasAccess: true/false and ALL accessible units with basic info
    
    This is specifically for mobile app to determine whether to show:
    - NoAccessScreen (if hasAccess = false)
    - ServiceFeePaymentScreen (if hasAccess = true)
    
    Also returns units array so frontend can display unit info even when no payment records exist.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            current_user = request.user
            print(f"\n{'='*80}")
            print(f"[MOBILE ACCESS CHECK] Checking access for user: {current_user.id} ({current_user.email})")
            print(f"{'='*80}")

            # Get current member
            try:
                current_member = Member.objects.get(user=current_user)
            except Member.DoesNotExist:
                print(f"[MOBILE ACCESS CHECK] User is not a member")
                return Response({
                    'hasAccess': False,
                    'reason': 'User is not a member',
                    'message': 'You are not registered as a member',
                    'units': []
                }, status=200)

            print(f"[MOBILE ACCESS CHECK] Member ID: {current_member.id}")
            print(f"[MOBILE ACCESS CHECK] Member Name: {current_member.full_name}")

            # Check if user is an Owner OR active Resident of any unit with service fee records
            # New logic: Access based on Owner/Resident relationship, not contact matching
            sql = """
                SELECT DISTINCT
                    u.id,
                    u.unit_name,
                    t.tower_name,
                    t.id as tower_id,
                    u.primary_email,
                    u.secondary_email,
                    u.primary_number,
                    u.secondary_number,
                    u.primary_name,
                    u.secondary_name
                FROM towers_unit u
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                INNER JOIN service_fee_management_servicefeegenerate sfp ON sfp.unit_id = u.id
                WHERE (
                    -- User is an Owner of the unit
                    EXISTS (
                        SELECT 1 FROM towers_owner o 
                        WHERE o.unit_id = u.id AND o.member_id = %s
                    )
                    OR
                    -- User is an active Resident of the unit
                    EXISTS (
                        SELECT 1 FROM towers_resident r 
                        WHERE r.unit_id = u.id AND r.member_id = %s AND r.is_active = TRUE
                    )
                )
                ORDER BY t.tower_name, u.unit_name
            """
            
            sql_params = [current_member.id, current_member.id]
            
            print(f"[MOBILE ACCESS CHECK] Executing SQL query...")
            print(f"[MOBILE ACCESS CHECK] Checking Owner/Resident relationship for Member ID: {current_member.id}")
            
            with connection.cursor() as cursor:
                cursor.execute(sql, sql_params)
                results = cursor.fetchall()
            
            if results:
                # Build list of all accessible units
                accessible_units = []
                for row in results:
                    unit_id, unit_name, tower_name, tower_id, primary_email, secondary_email, primary_number, secondary_number, primary_name, secondary_name = row
                    accessible_units.append({
                        'id': unit_id,
                        'unit_id': unit_id,  # Same as id for compatibility
                        'unit_name': unit_name,
                        'unit_display': unit_name,
                        'tower_name': tower_name,
                        'tower_id': tower_id,
                        'primary_name': primary_name,
                        'secondary_name': secondary_name,
                        'primary_email': primary_email,
                        'secondary_email': secondary_email,
                        'primary_number': primary_number,
                        'secondary_number': secondary_number,
                        # Default values for payment-related fields
                        'service_status': 'no_records',
                        'due_amount': '0',
                        'fee_amount': '0',
                        'due_date': None,
                        'service_period_month': None,
                        'service_period_year': None
                    })
                
                print(f"[MOBILE ACCESS CHECK] ✅ ACCESS GRANTED")
                print(f"[MOBILE ACCESS CHECK] Found {len(accessible_units)} unit(s) with service fee records")
                for unit in accessible_units:
                    print(f"[MOBILE ACCESS CHECK]   - {unit['tower_name']}, {unit['unit_name']}")
                
                # Return first unit for backward compatibility, plus full units array
                first_unit = accessible_units[0]
                
                return Response({
                    'hasAccess': True,
                    'unit': {
                        'id': first_unit['id'],
                        'unit_name': first_unit['unit_name'],
                        'tower_name': first_unit['tower_name'],
                        'primary_name': first_unit['primary_name'],
                        'secondary_name': first_unit['secondary_name']
                    },
                    'units': accessible_units,  # All accessible units
                    'message': 'You have access to service fees'
                }, status=200)
            else:
                print(f"[MOBILE ACCESS CHECK] ❌ ACCESS DENIED")
                print(f"[MOBILE ACCESS CHECK] User is not an owner or resident of any unit with service fee records")
                
                return Response({
                    'hasAccess': False,
                    'reason': 'Not an owner or resident',
                    'message': 'You are not registered as an owner or resident of any unit with service fees',
                    'units': []
                }, status=200)

        except Exception as e:
            import traceback
            print(f"[MOBILE ACCESS CHECK] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'hasAccess': False,
                'reason': 'Server error',
                'message': f'Error checking access: {str(e)}',
                'units': []
            }, status=500)


class MobileUnitAdvanceBalanceView(APIView):
    """
    Mobile endpoint: return total advance balance for a unit.
    User must be Owner or active Resident of the unit (same access as check-access).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unit_id = request.query_params.get('unit_id')
        if not unit_id:
            return Response({
                'success': False,
                'message': 'unit_id is required',
                'total_advance': 0
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            unit_id = int(unit_id)
        except (ValueError, TypeError):
            return Response({
                'success': False,
                'message': 'Invalid unit_id',
                'total_advance': 0
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            current_member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response({
                'success': False,
                'message': 'User is not a member',
                'total_advance': 0
            }, status=200)

        # Verify user is Owner or active Resident of this unit
        from towers.models import Owner
        is_owner = Owner.objects.filter(unit_id=unit_id, member_id=current_member.id).exists()
        is_resident = Resident.objects.filter(unit_id=unit_id, member_id=current_member.id, is_active=True).exists()
        if not is_owner and not is_resident:
            return Response({
                'success': False,
                'message': 'Access denied to this unit',
                'total_advance': 0
            }, status=403)

        # Sum advance balance for this unit (all account holders)
        total = AdvancePayment.objects.filter(
            unit_id=unit_id,
            status__in=['available', 'partial']
        ).aggregate(total=Sum('remaining_amount'))['total'] or Decimal('0')
        total_advance = float(total)

        return Response({
            'success': True,
            'total_advance': total_advance,
            'unit_id': unit_id
        }, status=200)


# ==================== BILL UPLOAD VIEWS ====================

class BillUploadServiceFeeListView(APIView):
    """
    Get list of service fees filtered by towers for bill upload
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        """
        Get service fees by tower IDs
        Query params:
        - tower_ids: comma-separated tower IDs
        - category: filter by category (optional)
        """
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            tower_ids_param = request.GET.get('tower_ids', '')
            category = request.GET.get('category', '')
            
            if not tower_ids_param:
                return Response({
                    'success': False,
                    'message': 'Tower IDs are required'
                }, status=400)
            
            # Parse tower IDs
            try:
                tower_ids = [int(tid.strip()) for tid in tower_ids_param.split(',') if tid.strip()]
            except ValueError:
                return Response({
                    'success': False,
                    'message': 'Invalid tower IDs format'
                }, status=400)
            
            if not tower_ids:
                return Response({
                    'success': False,
                    'message': 'No valid tower IDs provided'
                }, status=400)
            
            # Query service fees that are associated with the selected towers
            from service_fee.models import ServiceFee
            from django.db.models import Q
            
            service_fees = ServiceFee.objects.filter(
                towers__id__in=tower_ids,
                is_active=True
            ).distinct().values(
                'id',
                'fee_amount',
                'frequency',
                'billing_cycle',
                'due_day',
                'service_fee_date',
                'towers__tower_name'
            )
            
            # Format response
            service_fee_list = []
            for sf in service_fees:
                tower_name = sf.get('towers__tower_name')
                service_fee_list.append({
                    'id': sf['id'],
                    'name': f"৳{sf['fee_amount']} - {sf['frequency']}",
                    'fee_amount': str(sf['fee_amount']),
                    'frequency': sf['frequency'],
                    'billing_cycle': sf['billing_cycle'],
                    'due_day': sf['due_day'],
                    'service_fee_date': sf['service_fee_date'],
                    'tower_name': tower_name
                })
            
            return Response({
                'success': True,
                'service_fees': service_fee_list,
                'count': len(service_fee_list)
            }, status=200)
            
        except Exception as e:
            import traceback
            print(f"[BILL UPLOAD SERVICE FEE LIST] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error fetching service fees: {str(e)}'
            }, status=500)
class BillUploadServiceFeeItemsView(APIView):
    """
    Highly optimized view for bill upload item management.
    GET: Fetches all units eligible for bill upload for a given period and category in O(1).
    POST: Batch upserts bill upload details in O(1).
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get(self, request):
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            # 1. Extract and Parse Parameters
            service_fee_ids_param = request.GET.get('service_fee_ids')
            tower_ids_param = request.GET.get('tower_ids')
            month = request.GET.get('month')
            year = request.GET.get('year')
            category_id = request.GET.get('category_id')
            
            try:
                category_id_int = int(category_id) if category_id else None
                month_int = int(month) if month else None
                year_int = int(year) if year else None
                
                sf_ids = [int(x) for x in service_fee_ids_param.split(',') if x.strip()] if service_fee_ids_param else []
                tw_ids = [int(x) for x in tower_ids_param.split(',') if x.strip()] if tower_ids_param else []
            except (ValueError, TypeError):
                return Response({'success': False, 'message': 'Invalid parameter format'}, status=400)
            
            if not month_int or not year_int:
                return Response({'success': False, 'message': 'Month and year are required'}, status=400)

            # 2. Dynamic Filters for Raw SQL
            sf_filter = f"AND p.sf_id IN ({','.join(map(str, sf_ids))})" if sf_ids else ""
            tower_filter = f"AND t.id IN ({','.join(map(str, tw_ids))})" if tw_ids else ""
            
            selected_category_name = None
            if category_id_int:
                from bill_categories.models import BillCategory
                selected_category_name = BillCategory.objects.filter(id=category_id_int).values_list('name', flat=True).first()

            # 3. O(1) Raw SQL Query
            # 3. O(1) Raw SQL Query
            sql = f"""
                WITH Pairs AS (
                    SELECT servicefee_id as sf_id, unit_id, is_active 
                    FROM service_fee_servicefee_units 
                    WHERE is_active = 1
                ),
                LatestDetails AS (
                    SELECT bud.unit_id, bud.current_reading as auto_prev_reading, bud.price_per_unit as auto_prev_price,
                        ROW_NUMBER() OVER(PARTITION BY bud.unit_id ORDER BY bud.upload_year DESC, bud.upload_month DESC, bud.id DESC) as rn
                    FROM bill_upload_details bud
                    JOIN bill_uploads bu ON bud.bill_upload_id = bu.id
                    WHERE (bud.upload_year < %s OR (bud.upload_year = %s AND bud.upload_month < %s))
                    AND (bu.bill_category_id = %s OR %s IS NULL)
                    AND bud.current_reading > 0
                )
                SELECT 
                    p.sf_id as service_fee_id,
                    sf.fee_amount as fee_amount,
                    sf.due_day as due_day,
                    t.id as tower_id,
                    t.tower_name as tower_name,
                    u.id as unit_id,
                    u.unit_name as unit_name,
                    u.unit_status as unit_status,
                    p.is_active as is_active,
                    bud.id as detail_id,
                    bud.amount as amount,
                    bud.unit_of_measurement as unit_of_measurement,
                    bud.price_per_unit as current_price_per_unit,
                    bud.previous_reading as current_previous_reading,
                    bud.current_reading as current_current_reading,
                    bud.consumption as current_consumption,
                    bc.id as category_id,
                    bc.name as category_name,
                    CASE WHEN sfp.id IS NOT NULL THEN 1 ELSE 0 END as is_generated,
                    ld.auto_prev_reading as auto_prev_reading,
                    ld.auto_prev_price as auto_prev_price
                FROM Pairs p
                JOIN service_fee_servicefee sf ON sf.id = p.sf_id
                JOIN towers_unit u ON u.id = p.unit_id
                JOIN towers_floor f ON u.floor_id = f.id
                JOIN towers_tower t ON f.tower_id = t.id
                LEFT JOIN bill_upload_details bud ON (
                    bud.service_fee_id = p.sf_id AND bud.unit_id = p.unit_id AND 
                    bud.upload_month = %s AND bud.upload_year = %s AND
                    EXISTS (SELECT 1 FROM bill_uploads _bu WHERE _bu.id = bud.bill_upload_id AND (_bu.bill_category_id = %s OR %s IS NULL))
                )
                LEFT JOIN bill_uploads bu ON bud.bill_upload_id = bu.id
                LEFT JOIN bill_category bc ON bu.bill_category_id = bc.id
                LEFT JOIN service_fee_management_servicefeegenerate sfp ON (
                    sfp.service_fee_id = p.sf_id AND sfp.unit_id = p.unit_id AND 
                    sfp.service_period_month = %s AND sfp.service_period_year = %s
                )
                LEFT JOIN LatestDetails ld ON (ld.unit_id = p.unit_id AND ld.rn = 1)
                WHERE sf.is_active = 1 AND u.unit_status IN ('available', 'occupied', 'unknown')
                {sf_filter} {tower_filter}
                ORDER BY t.tower_name ASC, u.unit_name ASC, p.sf_id ASC
            """
            # print(sql)
            query_params = [
                year_int, year_int, month_int, category_id_int, category_id_int, # CTE
                month_int, year_int, category_id_int, category_id_int,            # bud join
                month_int, year_int                                             # sfp join
            ]
            
            with connection.cursor() as cursor:
                cursor.execute(sql, query_params)
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                
            results = []
            for row in rows:
                item = dict(zip(columns, row))
                results.append({
                    'service_fee_id': item['service_fee_id'],
                    'fee_amount': float(item['fee_amount'] or 0),
                    'due_day': item['due_day'],
                    'tower_id': item['tower_id'],
                    'tower_name': item['tower_name'],
                    'unit_id': item['unit_id'],
                    'unit_name': item['unit_name'],
                    'unit_status': item['unit_status'],
                    'is_active': bool(item['is_active']),
                    'is_generated': bool(item['is_generated']),
                    'detail_id': item['detail_id'],
                    'amount': float(item['amount']) if item['amount'] is not None else None,
                    'unit_of_measurement': item['unit_of_measurement'],
                    'price_per_unit': float(item['current_price_per_unit'] if item['current_price_per_unit'] is not None else (item['auto_prev_price'] if item['auto_prev_price'] is not None else 0)),
                    'previous_reading': float(item['current_previous_reading'] if item['current_previous_reading'] is not None else (item['auto_prev_reading'] if item['auto_prev_reading'] is not None else 0)),
                    'current_reading': float(item['current_current_reading']) if item['current_current_reading'] is not None else None,
                    'consumption': float(item['current_consumption']) if item['current_consumption'] is not None else None,
                    'upload_month': month_int,
                    'upload_year': year_int,
                    'category_id': item['category_id'] or category_id_int,
                    'category_name': item['category_name'] or selected_category_name
                })

            return Response({'success': True, 'results': results}, status=200)
        
        except Exception as e:
            import traceback
            print("[BILL UPLOAD SERVICE FEE ITEMS GET] ERROR:", str(e))
            traceback.print_exc()
            return Response({'success': False, 'message': str(e)}, status=500)

    def post(self, request):
        """Batch upsert bill upload details in O(1)"""
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            from django.db import transaction
            from service_fee_management.models import BillUpload, BillUploadDetail, ServiceFeePayment
            from towers.models import Tower, Unit
            from service_fee.models import ServiceFee
            from bill_categories.models import BillCategory
            from decimal import Decimal
            from collections import defaultdict

            # 1. Extraction and Metadata
            details = request.data.get('details', [])
            if not details:
                return Response({'success': False, 'message': 'No details provided'}, status=400)

            # Extract common parameters
            first = details[0]
            cat_id = request.data.get('bill_category_id') or first.get('bill_category_id') or first.get('category_id')
            mo = int(request.data.get('month') or first.get('upload_month') or first.get('month'))
            yr = int(request.data.get('year') or first.get('upload_year') or first.get('year'))
            upload_method = request.data.get('upload_method', 'manual')
            file_name = request.data.get('file_name')
            
            # Get bill category
            try:
                bill_category = BillCategory.objects.get(id=cat_id) if cat_id else None
            except BillCategory.DoesNotExist:
                return Response({'success': False, 'message': 'Invalid bill category ID'}, status=400)

            # 2. Group details by (service_fee_id, tower_id)
            # Since each bill upload is for a specific service fee and tower combination
            grouped_details = defaultdict(list)
            for d in details:
                sf_id = d.get('service_fee_id')
                tw_id = d.get('tower_id')
                if not sf_id or not tw_id:
                    continue
                grouped_details[(sf_id, tw_id)].append(d)

            if not grouped_details:
                return Response({'success': False, 'message': 'No valid details with service_fee_id and tower_id'}, status=400)

            # Track overall counts
            total_created = 0
            total_updated = 0
            total_skipped = 0

            with transaction.atomic():
                # 3. Process each service_fee + tower combination separately
                for (sf_id, tw_id), group_details in grouped_details.items():
                    # Validate service fee and tower
                    try:
                        service_fee = ServiceFee.objects.get(id=sf_id)
                        tower = Tower.objects.get(id=tw_id)
                    except (ServiceFee.DoesNotExist, Tower.DoesNotExist):
                        total_skipped += len(group_details)
                        continue

                    # Find or create bill upload for this service_fee + tower + period + category
                    found_header_id = BillUploadDetail.objects.filter(
                        service_fee_id=sf_id, 
                        tower_id=tw_id, 
                        upload_month=mo, 
                        upload_year=yr,
                        bill_upload__bill_category_id=cat_id
                    ).values_list('bill_upload_id', flat=True).first()

                    if found_header_id:
                        bill_upload = BillUpload.objects.get(id=found_header_id)
                    else:
                        bill_upload = BillUpload.objects.create(
                            bill_category=bill_category,
                            category=bill_category.name if bill_category else 'Manual',
                            upload_method=upload_method,
                            file_name=file_name,
                            is_active=True
                        )

                    # Get unit IDs for this group
                    unit_ids = [d.get('unit_id') for d in group_details if d.get('unit_id')]
                    
                    # Check for generated bills
                    generated_unit_ids = set(ServiceFeePayment.objects.filter(
                        unit_id__in=unit_ids, 
                        service_fee_id=sf_id, 
                        service_period_month=mo, 
                        service_period_year=yr
                    ).values_list('unit_id', flat=True))

                    # Fetch existing details for this bill_upload
                    # Key is just unit_id since unique_together is [bill_upload, unit]
                    existing_details = {
                        detail.unit_id: detail 
                        for detail in BillUploadDetail.objects.filter(
                            bill_upload_id=bill_upload.id,
                            unit_id__in=unit_ids
                        )
                    }

                    to_create = []
                    to_update = []

                    for d in group_details:
                        uid = d.get('unit_id')
                        
                        if not uid or uid in generated_unit_ids:
                            total_skipped += 1
                            continue
                        
                        # Values
                        prev = Decimal(str(d.get('previous_reading') or 0))
                        curr = Decimal(str(d.get('current_reading') or 0))
                        price = Decimal(str(d.get('price_per_unit') or 0))
                        
                        # Manual or Auto-calculated consumption
                        if 'consumption' in d and d['consumption'] is not None:
                            cons = Decimal(str(d['consumption']))
                        else:
                            cons = curr - prev
                        
                        # Final amount
                        amt = Decimal(str(d.get('amount') or (cons * price)))

                        # Check if this unit exists in this bill_upload
                        if uid in existing_details:
                            # Update existing record
                            existing = existing_details[uid]
                            existing.service_fee_id = sf_id
                            existing.tower_id = tw_id
                            existing.upload_month = mo
                            existing.upload_year = yr
                            existing.unit_of_measurement = d.get('unit_of_measurement', '')
                            existing.price_per_unit = price
                            existing.previous_reading = prev
                            existing.current_reading = curr
                            existing.consumption = cons
                            existing.amount = amt
                            to_update.append(existing)
                            total_updated += 1
                        else:
                            # Create new record
                            to_create.append(BillUploadDetail(
                                bill_upload_id=bill_upload.id,
                                unit_id=uid,
                                service_fee_id=sf_id,
                                tower_id=tw_id,
                                upload_month=mo,
                                upload_year=yr,
                                unit_of_measurement=d.get('unit_of_measurement', ''),
                                price_per_unit=price,
                                previous_reading=prev,
                                current_reading=curr,
                                consumption=cons,
                                amount=amt
                            ))
                            total_created += 1

                    # Perform bulk operations for this group
                    if to_create:
                        BillUploadDetail.objects.bulk_create(to_create)
                    
                    if to_update:
                        BillUploadDetail.objects.bulk_update(
                            to_update,
                            fields=[
                                'service_fee_id', 'tower_id', 'upload_month', 'upload_year',
                                'unit_of_measurement', 'price_per_unit', 'previous_reading', 
                                'current_reading', 'consumption', 'amount'
                            ]
                        )

            return Response({
                'success': True, 
                'details_count': total_created,
                'details_updated': total_updated,
                'message': f'Successfully processed {total_created + total_updated} records',
                'skipped': total_skipped
            }, status=200)

        except Exception as e:
            import traceback
            print("[BILL UPLOAD SERVICE FEE ITEMS POST] ERROR:", str(e))
            traceback.print_exc()
            return Response({'success': False, 'message': str(e)}, status=500)



class BillUploadListCreateView(APIView):
    """
    List and create bill uploads
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        """Get list of bill uploads with filters"""
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            from .serializers import BillUploadSerializer
            
            # Get query parameters
            category = request.GET.get('category', '')
            tower_id = request.GET.get('tower_id', '')
            service_fee_id = request.GET.get('service_fee_id', '')
            month = request.GET.get('month', '')
            year = request.GET.get('year', '')
            
            # Build query on BillUpload; since service_fee/tower/month/year moved to details,
            # filter via related details where applicable.
            query = Q(is_active=True)

            if category:
                query &= Q(category=category)

            bill_uploads = BillUpload.objects.filter(query).select_related('created_by').prefetch_related('details__unit')

            # Apply detail-level filters
            if tower_id:
                bill_uploads = bill_uploads.filter(details__tower_id=tower_id)
            if service_fee_id:
                bill_uploads = bill_uploads.filter(details__service_fee_id=service_fee_id)
            if month:
                bill_uploads = bill_uploads.filter(details__upload_month=int(month))
            if year:
                bill_uploads = bill_uploads.filter(details__upload_year=int(year))
            
            serializer = BillUploadSerializer(bill_uploads, many=True)
            
            return Response({
                'success': True,
                'bill_uploads': serializer.data,
                'count': bill_uploads.count()
            }, status=200)
            
        except Exception as e:
            import traceback
            print(f"[BILL UPLOAD LIST] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error fetching bill uploads: {str(e)}'
            }, status=500)
    
    def post(self, request):
        """Create new bill upload"""
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            from .serializers import BillUploadCreateSerializer
            
            serializer = BillUploadCreateSerializer(
                data=request.data,
                context={'request': request}
            )
            
            if serializer.is_valid():
                bill_upload = serializer.save()
                
                # Return created bill upload
                from .serializers import BillUploadSerializer
                response_serializer = BillUploadSerializer(bill_upload)
                
                return Response({
                    'success': True,
                    'message': 'Bill upload created successfully',
                    'bill_upload': response_serializer.data
                }, status=201)
            
            return Response({
                'success': False,
                'message': 'Validation error',
                'errors': serializer.errors
            }, status=400)
            
        except Exception as e:
            import traceback
            print(f"[BILL UPLOAD CREATE] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error creating bill upload: {str(e)}'
            }, status=500)


class BillUploadDetailView(APIView):
    """
    Retrieve, update, or delete a bill upload
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request, upload_id):
        """Get single bill upload with details"""
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            from .models import BillUpload
            from .serializers import BillUploadSerializer
            
            bill_upload = BillUpload.objects.select_related(
                'tower', 'service_fee', 'created_by'
            ).prefetch_related('details__unit').get(
                id=upload_id,
                is_active=True
            )
            
            serializer = BillUploadSerializer(bill_upload)
            
            return Response({
                'success': True,
                'bill_upload': serializer.data
            }, status=200)
            
        except BillUpload.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Bill upload not found'
            }, status=404)
        except Exception as e:
            import traceback
            print(f"[BILL UPLOAD DETAIL] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error fetching bill upload: {str(e)}'
            }, status=500)
    
    def delete(self, request, upload_id):
        """Soft delete bill upload"""
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            from .models import BillUpload
            
            bill_upload = BillUpload.objects.get(id=upload_id, is_active=True)
            bill_upload.is_active = False
            bill_upload.updated_by = request.user if request.user.is_authenticated else None
            bill_upload.save()
            
            return Response({
                'success': True,
                'message': 'Bill upload deleted successfully'
            }, status=200)
            
        except BillUpload.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Bill upload not found'
            }, status=404)
        except Exception as e:
            import traceback
            print(f"[BILL UPLOAD DELETE] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error deleting bill upload: {str(e)}'
            }, status=500)



class PreviousReadingFetchView(APIView):
    """
    Fetch previous month's current reading to auto-populate current month's previous reading.
    This helps users avoid manual re-entry of readings.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get(self, request):
        """
        Get previous month's current reading for a unit.
        Query params: unit_id, month, year, bill_category_id (all required)
        """
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            unit_id = request.GET.get('unit_id')
            month = request.GET.get('month')
            year = request.GET.get('year')
            bill_category_id = request.GET.get('bill_category_id')
            
            if not all([unit_id, month, year, bill_category_id]):
                return Response({
                    'success': False,
                    'message': 'Missing required parameters: unit_id, month, year, bill_category_id'
                }, status=400)
            
            # Calculate previous month
            month = int(month)
            year = int(year)
            prev_month = month - 1
            prev_year = year
            
            if prev_month < 1:
                prev_month = 12
                prev_year -= 1
            
            # Query for previous month's bill upload detail
            from .models import BillUploadDetail
            
            prev_detail = BillUploadDetail.objects.filter(
                unit_id=unit_id,
                upload_month=prev_month,
                upload_year=prev_year,
                bill_category_id=bill_category_id
            ).first()
            
            if prev_detail and prev_detail.current_reading:
                return Response({
                    'success': True,
                    'previous_reading': float(prev_detail.current_reading),
                    'month': prev_month,
                    'year': prev_year
                }, status=200)
            else:
                return Response({
                    'success': True,
                    'previous_reading': None,
                    'message': f'No previous data found for {prev_month}/{prev_year}'
                }, status=200)
        
        except Exception as e:
            import traceback
            print(f"[PREVIOUS READING FETCH] ❌ ERROR: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Error fetching previous reading: {str(e)}'
            }, status=500)


class BillUploadCSVParserView(APIView):
    """
    Parse and validate CSV for Bill Upload.
    Returns parsed rows with validation status to populate the frontend grid.
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def post(self, request):
        self.required_permission_id = [PERMISSION_BILL_UPLOADS]
        try:
            file = request.FILES.get('file')
            if not file:
                return Response({'success': False, 'message': 'No file uploaded'}, status=400)

            # Check for duplicate file name
            from .models import BillUpload
            if BillUpload.objects.filter(file_name=file.name, is_active=True).exists():
                 return Response({'success': False, 'message': f"The file '{file.name}' has already been uploaded."}, status=400)

            # Get parameters (Context only)
            passed_month = request.data.get('month')
            passed_year = request.data.get('year')
            
            # Decode file
            decoded_file = file.read().decode('utf-8-sig').splitlines()
            reader = csv.DictReader(decoded_file)
            
            # Normalize headers (lowercase, strip)
            if reader.fieldnames:
                reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
                print(f"DEBUG: Normalized CSV Headers: {reader.fieldnames}")

            parsed_rows = []
            
            # 1. Pre-fetch ALL required DataBase maps to derive IDs from Names
            
            # Towers: Name -> ID
            from towers.models import Tower, Unit 
            towers_map = {t.tower_name.lower(): t.id for t in Tower.objects.all()}
            
            # Units: "tower:unit" -> Unit Object
            units_qs = Unit.objects.select_related('floor__tower').all()
            units_map = {}
            for u in units_qs:
                if u.floor and u.floor.tower:
                    key = f"{u.floor.tower.tower_name.lower()}:{u.unit_name.lower()}"
                    units_map[key] = u

            # Categories: Name -> ID
            from bill_categories.models import BillCategory
            categories_map = {c.name.lower(): c.id for c in BillCategory.objects.filter(is_active=True)}
            
            # Service Fees: Fetch ALL active fees to match against
            from service_fee.models import ServiceFee
            valid_service_fees = ServiceFee.objects.filter(is_active=True).prefetch_related('towers', 'units')

            # Build rapid lookup for Service Fee validity based on Amount/Configuration
            from decimal import Decimal, InvalidOperation
            tower_sf_details = {} 
            for sf in valid_service_fees:
                # Pre-calculate counts/IDs to avoid N+1 in the tower loop
                units_all = list(sf.units.all())
                units_count = len(units_all)
                explicit_unit_ids = set(u.id for u in units_all)
                # Store as Decimal for precision
                sf_fee_amount = Decimal(str(sf.fee_amount))
                sf_name = sf.name.lower() if hasattr(sf, 'name') else f"{sf.fee_amount} {sf.currency}".lower()
                
                for t in sf.towers.all():
                    if t.id not in tower_sf_details: 
                        tower_sf_details[t.id] = []
                    tower_sf_details[t.id].append({
                        'id': sf.id,
                        'name': sf_name,
                        'fee_amount': sf_fee_amount, 
                        'units_count': units_count, 
                        'explicit_unit_ids': explicit_unit_ids
                    })

            # Parse all rows first to gather Month/Year requirements for efficient pre-fetching
            all_parsed_data = []
            
            # Use sets to collect all periods encountered
            periods_to_check = set()
            if passed_month and passed_year:
                periods_to_check.add((int(passed_month), int(passed_year)))

            row_index = 0
            for row in reader:
                row_index += 1
                
                # 1. Validation for Required Text Columns
                # Tower, Unit, Category, ServiceFee are mandatory for any meaningful processing
                
                # Headers
                tower_name = row.get('tower name', '').strip()
                unit_name = row.get('unit name', '').strip()
                category_name = row.get('category name', '').strip()
                # Try multiple variations for Service Fee header
                service_fee_name = row.get('service fee name') or row.get('service fee') or ''
                service_fee_name = service_fee_name.strip()
                
                # Check for completely empty rows (common in Excel exports)
                if not any([tower_name, unit_name, category_name, service_fee_name]):
                    continue
                
                # Data Columns (May contain errors, but we grab raw strings first)
                uom = row.get('unit of measurement', '').strip()
                price = row.get('price per unit', '').strip()
                prev_reading = row.get('prev reading', '').strip()
                current_reading = row.get('current reading', '').strip()
                consumption = row.get('consumption', '').strip()
                amount_str = row.get('amount in bdt', '').strip() or '0'
                
                row_month_str = row.get('month', '').strip()
                row_year_str = row.get('year', '').strip()

                # Basic Header Checks (Critical Missing Data)
                basic_errors = []
                if not tower_name: basic_errors.append("Tower Name required")
                if not unit_name: basic_errors.append("Unit Name required")
                if not category_name: basic_errors.append("Category Name required")
                if not service_fee_name: basic_errors.append("Service Fee (Amount) required")
                
                effective_month = None
                effective_year = None
                
                # Only proceed with date parsing if basic headers are present (or we still process to show all errors)
                # But effective_month/year logic stays the same
                
                # Strict Month/Year Validation
                # If content exists in CSV, it MUST be valid. Only fallback if empty.
                
                # Month
                if row_month_str:
                    if row_month_str.isdigit():
                        effective_month = int(row_month_str)
                        if effective_month < 1 or effective_month > 12:
                            basic_errors.append(f"Invalid Month: {row_month_str}")
                            effective_month = None
                    else:
                        # Try parsing month name (Jan, January)
                        import calendar
                        month_map = {name.lower(): i for i, name in enumerate(calendar.month_name) if name}
                        month_map.update({name.lower(): i for i, name in enumerate(calendar.month_abbr) if name})
                        
                        val = row_month_str.lower()
                        if val in month_map:
                            effective_month = month_map[val]
                        else:
                            basic_errors.append(f"Invalid Month format: {row_month_str}")
                            effective_month = None
                elif passed_month:
                    effective_month = int(passed_month)
                
                # Year
                if row_year_str:
                    if row_year_str.isdigit():
                        effective_year = int(row_year_str)
                        if effective_year < 2000 or effective_year > 2100:
                             basic_errors.append(f"Invalid Year: {row_year_str}")
                             effective_year = None
                    else:
                        basic_errors.append(f"Invalid Year format: {row_year_str}")
                        effective_year = None
                elif passed_year:
                    effective_year = int(passed_year)

                if effective_month and effective_year:
                    periods_to_check.add((effective_month, effective_year))
                
                # Store potential early errors in the row dict to be merged later or checked immediately
                # (We will append basic_errors to error_msgs in the processing loop)

                all_parsed_data.append({
                    'row_idx': row_index,
                    'raw': row,
                    'tower_name': tower_name,
                    'unit_name': unit_name,
                    'category_name': category_name,
                    'service_fee_name': service_fee_name,
                    'month': effective_month,
                    'year': effective_year,
                    'uom': uom,
                    'price': price,
                    'prev_reading': prev_reading,
                    'current_reading': current_reading,
                    'consumption': consumption,
                    'amount_str': amount_str,
                    'basic_errors': basic_errors # Pass these down
                })

            # Pre-fetch existing details for ALL relevant periods
            existing_details_map = {} # key: (unit_id, service_fee_id, month, year) -> detail_id
            
            if periods_to_check:
                try:
                    from .models import BillUploadDetail
                    from django.db.models import Q
                    # Build Q objects for each period
                    period_q = Q()
                    for m, y in periods_to_check:
                        period_q |= Q(upload_month=m, upload_year=y)
                    
                    if valid_service_fees:
                        existing_qs = BillUploadDetail.objects.filter(
                            period_q,
                            service_fee__in=valid_service_fees
                        ).values('unit_id', 'service_fee_id', 'upload_month', 'upload_year', 'id')
                        
                        for ed in existing_qs:
                            existing_details_map[(ed['unit_id'], ed['service_fee_id'], ed['upload_month'], ed['upload_year'])] = ed['id']
                except Exception as e:
                    print(f"Error fetching existing details: {e}")

            # Track units to detect duplicates
            unit_entries_seen = {}  # key: (unit_id, month, year) -> count
            
            # Process Rows
            parsed_rows = []
            for item in all_parsed_data:
                error_msgs = []
                # Include basic header errors first
                if item.get('basic_errors'):
                    error_msgs.extend(item['basic_errors'])
                
                tower_name = item['tower_name']
                unit_name = item['unit_name']
                
                # Validation Details
                tower_id = towers_map.get(tower_name.lower())
                if not tower_id:
                     if tower_name: error_msgs.append(f"Tower '{tower_name}' not found")
                     # else already covered in basic_errors
                
                unit_id = None
                unit_obj = None
                if tower_name and unit_name:
                    key = f"{tower_name.lower()}:{unit_name.lower()}"
                    unit_obj = units_map.get(key)
                    if unit_obj:
                        unit_id = unit_obj.id
                    else:
                        error_msgs.append(f"Unit '{unit_name}' not found in Tower '{tower_name}'")
                # elif covered in basic_errors

                row_cat_id = None
                if item['category_name']:
                    found_cat = categories_map.get(item['category_name'].lower())
                    if found_cat:
                        row_cat_id = found_cat
                    else:
                        error_msgs.append(f"Category '{item['category_name']}' not found")
                # else covered in basic_errors

                # AMOUNT VALIDATION: MANDATORY and MUST BE NON-NEGATIVE and NON-ZERO
                try:
                     parsed_amount = float(item['amount_str'])
                     # Check for negative amount
                     if parsed_amount < 0:
                         error_msgs.append("Amount cannot be negative")
                         parsed_amount = 0
                     # Check for zero amount - reject it
                     elif parsed_amount == 0:
                         error_msgs.append("Amount must be greater than zero")
                except:
                     parsed_amount = 0
                     # Only add error if amount was explicitly provided but invalid
                     if item['amount_str'] and item['amount_str'] != '0':
                         error_msgs.append("Invalid Amount format")
                     else:
                         error_msgs.append("Amount is mandatory and must be greater than zero")
                
                # PRICE PER UNIT VALIDATION: MUST BE NON-NEGATIVE IF PROVIDED
                if item['price']:
                    try:
                        parsed_price = float(item['price'])
                        if parsed_price < 0:
                            error_msgs.append("Price per unit cannot be negative")
                    except:
                        error_msgs.append("Price per unit must be a valid number")
                
                # PREVIOUS READING VALIDATION: MUST BE NON-NEGATIVE IF PROVIDED
                if item['prev_reading']:
                    try:
                        parsed_prev = float(item['prev_reading'])
                        if parsed_prev < 0:
                            error_msgs.append("Previous reading cannot be negative")
                    except:
                        error_msgs.append("Previous reading must be a valid number")
                
                # CURRENT READING VALIDATION: MUST BE NON-NEGATIVE IF PROVIDED
                if item['current_reading']:
                    try:
                        parsed_curr = float(item['current_reading'])
                        if parsed_curr < 0:
                            error_msgs.append("Current reading cannot be negative")
                    except:
                        error_msgs.append("Current reading must be a valid number")
                
                # CONSUMPTION VALIDATION: MUST BE NON-NEGATIVE IF PROVIDED
                if item['consumption']:
                    try:
                        parsed_cons = float(item['consumption'])
                        if parsed_cons < 0:
                            error_msgs.append("Consumption cannot be negative")
                    except:
                        error_msgs.append("Consumption must be a valid number")
                
                if not item['month'] or not item['year']:
                     error_msgs.append("Month/Year required (in file or selected)")

                # Match Service Fee based on Amount, Tower, and Match with Unit
                matched_sf_id = None
                
                # We interpret 'service_fee_name' (from CSV "Service Fee" column) as the TARGET FEE AMOUNT
                target_fee_decimal = None
                try:
                    if item['service_fee_name']:
                        target_fee_decimal = Decimal(str(item['service_fee_name']).strip())
                except (InvalidOperation, ValueError, TypeError):
                    target_fee_decimal = None

                if unit_obj and tower_id:
                    candidates = tower_sf_details.get(tower_id, [])
                    
                    # Store potential matches by priority
                    strict_match = None
                    tower_wide_match = None
                    any_amount_match = None
                    
                    for cand in candidates:
                        cand_amount = cand['fee_amount']
                        
                        if target_fee_decimal is not None and target_fee_decimal == cand_amount:
                            any_amount_match = cand['id']
                            
                            # 1. Strict Unit Link (Highest Priority)
                            if unit_id in cand['explicit_unit_ids']:
                                strict_match = cand['id']
                                break
                            
                            # 2. Tower-Wide Fallback (Second Priority)
                            elif cand['units_count'] == 0:
                                if not tower_wide_match:
                                    tower_wide_match = cand['id']
                    
                    # Decision logic for matching
                    if strict_match:
                        matched_sf_id = strict_match
                    elif tower_wide_match:
                        matched_sf_id = tower_wide_match
                    elif any_amount_match:
                        # Lenient Match: If only one SF exists for this tower and amount, allow it
                        # even if the unit assignment is missing, to support flexible CSV uploads.
                        matched_sf_id = any_amount_match
                    
                    if not matched_sf_id:
                         # Only show match error if we actually had a target amount to check
                         if target_fee_decimal is not None:
                              error_msgs.append(f"No configured Service Fee found with Amount {target_fee_decimal} for this Tower/Unit")
                         elif "Service Fee (Amount) required" not in error_msgs:
                              error_msgs.append("Valid 'Service Fee' amount required for matching")
                
                # Check status
                upload_status = 'new'
                if matched_sf_id and unit_id and item['month'] and item['year']:
                    key = (unit_id, matched_sf_id, item['month'], item['year'])
                    if key in existing_details_map:
                        upload_status = 'update'
                
                # DUPLICATE UNIT DETECTION in current file
                # Track each unique unit entry per upload period to catch duplicates within the same file
                if unit_id and item['month'] and item['year']:
                    dup_key = (unit_id, item['month'], item['year'])
                    if dup_key in unit_entries_seen:
                        error_msgs.append(f"Duplicate: Unit already appears in this upload for {item['month']}/{item['year']}")
                    else:
                        unit_entries_seen[dup_key] = True

                parsed_rows.append({
                    'index': item['row_idx'],
                    'tower_name': tower_name,
                    'unit_name': unit_name,
                    'unit_id': unit_id,
                    'tower_id': tower_id,
                    'service_fee_id': matched_sf_id,
                    'bill_category_id': row_cat_id,
                    'category_name': item['category_name'],
                    'service_fee_name': item['service_fee_name'],
                    
                    'upload_month': item['month'],
                    'upload_year': item['year'],
                    'month': item['month'], # Alias for frontend
                    'year': item['year'],   # Alias for frontend
                    
                    'unit_of_measurement': item['uom'],
                    'price_per_unit': item['price'],
                    'previous_reading': item['prev_reading'],
                    'current_reading': item['current_reading'],
                    'consumption': item['consumption'],
                    'amount': parsed_amount,
                    'amountBDT': parsed_amount,
                    'errors': error_msgs,
                    'isValid': len(error_msgs) == 0,
                    'status': upload_status
                })

            return Response({
                'success': True,
                'rows': parsed_rows, 
                'total_rows': len(parsed_rows),
                'valid_rows': len([r for r in parsed_rows if r['isValid']])
            })
            
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({'success': False, 'message': str(e)}, status=500)


class UnitOutstandingSummaryView(APIView):
    """
    Highly optimized summary of outstanding service fees per unit.
    Calculates total outstanding amount and count of unpaid bills.
    Uses direct JOINs instead of CTEs for maximum performance.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get(self, request):
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_OVERVIEW]
        try:
            tower_ids = request.query_params.getlist('tower_id')
            search = request.query_params.get('search')
            unit_id = request.query_params.get('unit_id')
            
            # Base condition: Only show units with outstanding balance
            where_conditions = ["sfp.remaining_amount > 0"]
            sql_params = []

            # Filter by Tower(s)
            if tower_ids:
                parsed_tower_ids = []
                for tid in tower_ids:
                    if isinstance(tid, str) and ',' in tid:
                        parsed_tower_ids.extend([t.strip() for t in tid.split(',') if t.strip()])
                    else:
                        parsed_tower_ids.append(tid)
                
                if parsed_tower_ids:
                    placeholders = ','.join(['%s'] * len(parsed_tower_ids))
                    where_conditions.append(f"t.id IN ({placeholders})")
                    sql_params.extend(parsed_tower_ids)

            # Filter by Unit
            if unit_id:
                where_conditions.append("u.id = %s")
                sql_params.append(unit_id)

            # Search by Unit Name, Primary Name, or Tower Name
            if search:
                where_conditions.append("(u.unit_name LIKE %s OR u.primary_name LIKE %s OR t.tower_name LIKE %s)")
                search_param = f"%{search}%"
                sql_params.extend([search_param, search_param, search_param])

            where_clause = " WHERE " + " AND ".join(where_conditions)

            # Optimized SQL Query using direct JOINs (No CTEs)
            sql = f"""
                SELECT 
                    u.id AS unit_id,
                    u.unit_name,
                    u.primary_name AS resident_name,
                    t.tower_name,
                    t.id AS tower_id,
                    CAST(SUM(sfp.remaining_amount) AS CHAR) AS outstanding_amount,
                    COUNT(sfp.id) AS unpaid_bills_count
                FROM towers_unit u
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                INNER JOIN service_fee_management_servicefeegenerate sfp ON sfp.unit_id = u.id
                {where_clause}
                GROUP BY u.id, u.unit_name, u.primary_name, t.tower_name, t.id
                ORDER BY t.tower_name ASC, u.unit_name ASC
            """

            with connection.cursor() as cursor:
                cursor.execute(sql, sql_params)
                columns = [col[0] for col in cursor.description]
                data = [dict(zip(columns, row)) for row in cursor.fetchall()]

            # Aggregate statistics
            total_outstanding = sum(Decimal(item['outstanding_amount']) for item in data)
            total_unpaid_bills = sum(item['unpaid_bills_count'] for item in data)
            total_units = len(data)

            return Response({
                'success': True,
                'data': data,
                'summary': {
                    'total_outstanding': str(total_outstanding),
                    'total_unpaid_bills': total_unpaid_bills,
                    'total_units': total_units
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            print(f"[UnitOutstandingSummaryView] Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeUnitReceivablesView(APIView):
    """
    Service Fee Unit Receivables View
    Returns filtered and aggregated service fee data for "Unit Receivables" page.
    Prioritizes Account Holder Logic: Owner -> Resident -> Null.
    Strictly follows Unit Contact information for Account Holder matching if needed.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get(self, request):
        self.required_permission_id = [PERMISSION_VIEW_BILLING_MANAGEMENT]
        try:
            # 1. Parse Query Parameters (similar to ServiceFeeResidentListView but simplified for Receivables)
            # Detect source
            user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
            is_mobile_request = 'expo' in user_agent or 'react-native' in user_agent or request.query_params.get('source') == 'mobile'

            tower_ids = request.query_params.getlist('tower_id') or request.query_params.getlist('tower_ids')
            status_filter = request.query_params.getlist('status') or request.query_params.getlist('statuses')
            search = request.query_params.get('search')
            
            # Unit Receivables usually shows outstanding amounts, but filters may include 'paid' or 'partial'.
            # The page uses: statuses: ['due', 'partial', 'overdue', 'paid'], stats: true, include_payment_details: true

            # 2. Build SQL
            where_conditions = ["sfp.id IS NOT NULL"]
            sql_params = []

            # Tower Filter
            if tower_ids:
                # Handle comma separated strings if passed as single element
                flattened_ids = []
                for tid in tower_ids:
                    if ',' in tid:
                        flattened_ids.extend(tid.split(','))
                    else:
                        flattened_ids.append(tid)
                
                if flattened_ids:
                    placeholders = ','.join(['%s'] * len(flattened_ids))
                    where_conditions.append(f"t.id IN ({placeholders})")
                    sql_params.extend(flattened_ids)

            # Status Filter
            if status_filter:
                # Handle comma separated strings
                flattened_statuses = []
                for s in status_filter:
                    if ',' in s:
                        flattened_statuses.extend(s.split(','))
                    else:
                        flattened_statuses.append(s)
                
                if flattened_statuses:
                    placeholders = ','.join(['%s'] * len(flattened_statuses))
                    where_conditions.append(f"""
                        sfp.service_status IN ({placeholders})
                    """)
                    sql_params.extend(flattened_statuses)

            # Search Filter
            if search:
                where_conditions.append("""
                    (u.unit_name LIKE %s OR u.primary_name LIKE %s OR u.primary_number LIKE %s OR
                     u.primary_email LIKE %s OR t.tower_name LIKE %s OR sfp.bill_number LIKE %s)
                """)
                search_param = f"%{search}%"
                sql_params.extend([search_param] * 6)
            
            # Access Control (Copied from ResidentListView logic)
            if request.user.is_authenticated:
                try:
                    current_member = Member.objects.get(user=request.user)
                     # For community members on mobile: Check contact match
                    if is_mobile_request and current_member and not current_member.is_org_member:
                         # Collect emails and contacts
                        user_emails = [e for e in [current_member.general_email, current_member.login_email] if e]
                        user_contacts = [c for c in [current_member.general_contact, current_member.login_contact] if c]
                        
                        contact_conditions = []
                        for email in user_emails:
                            contact_conditions.append("u.primary_email = %s OR u.secondary_email = %s")
                            sql_params.extend([email, email])
                        for contact in user_contacts:
                            contact_conditions.append("u.primary_number = %s OR u.secondary_number = %s")
                            sql_params.extend([contact, contact])
                        
                        if contact_conditions:
                            where_conditions.append(f"({' OR '.join(contact_conditions)})")
                        else:
                            where_conditions.append("1=0")

                except Member.DoesNotExist:
                    pass

            where_clause = " AND ".join(where_conditions)

            # Main SQL Query
            # We return detailed rows because the frontend groups them.
            # We use 'sfp' (ServiceFeeGenerate) as the primary source for account holder info.
            # We join towers_unit to get unit details.
            
            sql = f"""
            WITH unit_info AS (
                SELECT 
                    u.id as unit_id,
                    u.unit_name,
                    u.primary_name,
                    u.primary_number,
                    u.primary_email,
                    u.secondary_email,
                    u.secondary_number,
                    t.tower_name,
                    t.tower_number as tower_id
                FROM towers_unit u
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
            ),
            item_agg AS (
                SELECT 
                    sfi.service_fee_payment_id,
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', sfi.id,
                            'item_type', sfi.item_type,
                            'item_name', sfi.item_name,
                            'amount', CAST(sfi.amount AS CHAR),
                            'description', sfi.description,
                             'bill_category_id', sfi.bill_category_id
                        )
                    ) as item_details
                FROM service_fee_management_servicefeeitem sfi
                GROUP BY sfi.service_fee_payment_id
            )
            SELECT 
                DATE_FORMAT(
                    CONCAT(
                        LPAD(sfp.service_period_year, 4, '0'), '-',
                        LPAD(sfp.service_period_month, 2, '0'), '-01'
                    ), 
                    '%%Y-%%m-01'
                ) AS service_month,
                u.unit_id AS unit_id,
                sfp.bill_number AS id,

                /* Account Holder Information (From ServiceFeeGenerate - The Source of Truth) */
                sfp.account_holder_type,
                sfp.account_holder_id,
                sfp.bill_number,
                
                /* Voucher Info */
                v.id AS voucher_id,
                v.voucherNumber AS voucher_number,

                /* Unit Info from CTE */
                u.unit_name,
                u.unit_name AS unit_display,
                u.tower_name,
                u.tower_id,
                
                /* Owner/Resident Details from Payment Record */
                sfp.owner_id,
                sfp.owner_name,
                sfp.owner_email,
                sfp.owner_phone,
                
                /* Aliases for frontend compatibility */
                sfp.owner_name AS resident_name,
                sfp.owner_name AS primary_name,
                sfp.owner_email AS resident_email,
                sfp.owner_email AS primary_email,
                sfp.owner_phone AS resident_number,
                sfp.owner_phone AS primary_number,

                /* Service Fee Details */
                sfp.service_fee_id,
                sfp.service_period_month,
                sfp.service_period_year,
                DATE_FORMAT(sfp.due_date, '%%Y-%%m-%%d') AS due_date,
                
                /* Amounts */
                CAST(sfp.base_service_amount AS CHAR) AS original_amount,
                CAST(sfp.base_service_amount AS CHAR) AS fee_amount,
                CAST(sfp.base_service_amount AS CHAR) AS service_fee_amount,
                CAST(sfp.amount AS CHAR) AS total_amount,
                CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                CAST(sfp.total_paid AS CHAR) AS paid_amount,
                CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,
                
                 /* Status - directly from DB (update_penalty_tiers cron is the single source of truth) */
                CASE 
                    WHEN sfp.remaining_amount <= 0 THEN 'paid'
                    WHEN (sfp.service_status = 'due' OR sfp.service_status IS NULL) AND sfp.due_date < CURDATE() THEN 'overdue'
                    ELSE sfp.service_status 
                END as service_status,

                /* Payment Details (Joined) */
                sfpd.id AS payment_detail_id,
                sfpd.billing_id,
                sfpd.receipt_id,
                DATE_FORMAT(sfpd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s') AS payment_date,
                CAST(sfpd.total_paid AS CHAR) AS detail_paid_amount,
                pm.method_name AS payment_method,
                sfpd.other_method_name,
                
                /* Items */
                COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items

            FROM service_fee_management_servicefeegenerate sfp
            INNER JOIN unit_info u ON sfp.unit_id = u.unit_id
            
            /* Left Join Voucher */
            LEFT JOIN accounts_voucherentry v ON sfp.bill_number = v.referenceNumber AND sfp.unit_id = v.unit_id
            
            /* Left Join Payment Details */
            LEFT JOIN service_fee_payment_details sfpd ON sfp.id = sfpd.servicefeepaymentid_id
            LEFT JOIN service_fee_payment_methods pm ON sfpd.payment_method_id = pm.id
            
            /* Join Aggregated Items CTE */
            LEFT JOIN item_agg ON item_agg.service_fee_payment_id = sfp.id

            WHERE {where_clause}
            ORDER BY sfp.service_period_year DESC, sfp.service_period_month DESC, u.unit_name ASC
            """

            with connection.cursor() as cursor:
                cursor.execute(sql, sql_params)
                columns = [col[0] for col in cursor.description]
                raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]

            response_data = {
                'payments': raw_data,
                'total_count': len(raw_data)
            }
            return Response({'success': True, 'data': response_data}, status=200)

        except Exception as e:
            import traceback
            print(f"Error in ServiceFeeUnitReceivablesView: {str(e)}")
            print(traceback.format_exc())
            return Response({'success': False, 'message': str(e)}, status=500)


class PaymentMethodListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = {
        'GET': [PERMISSION_VIEW_PAYMENT_METHODS, PERMISSION_VIEW_SERVICE_FEE_SETTINGS],
        'POST': [PERMISSION_ADD_PAYMENT_METHODS, PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
    }

    def get(self, request):
        try:
            from .serializers import PaymentMethodSerializerV2 as PaymentMethodSerializer
            
            # Allow filtering by is_active for frontend management
            is_active = request.query_params.get('is_active')
            queryset = PaymentMethod.objects.all().order_by('display_order', 'method_name')
            
            if is_active is not None:
                is_active = is_active.lower() == 'true'
                queryset = queryset.filter(is_active=is_active)
                
            serializer = PaymentMethodSerializer(queryset, many=True)
            return Response({'success': True, 'data': serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        try:
            from .serializers import PaymentMethodSerializerV2 as PaymentMethodSerializer
            serializer = PaymentMethodSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response({'success': True, 'data': serializer.data, 'message': 'Payment method created successfully'}, status=status.HTTP_201_CREATED)
            return Response({'success': False, 'message': 'Validation error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PaymentMethodDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = {
        'GET': [PERMISSION_VIEW_PAYMENT_METHODS, PERMISSION_VIEW_SERVICE_FEE_SETTINGS],
        'PUT': [PERMISSION_EDIT_PAYMENT_METHODS, PERMISSION_EDIT_SERVICE_FEE_SETTINGS],
        'DELETE': [PERMISSION_EDIT_PAYMENT_METHODS, PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
    }

    def get_object(self, pk):
        return get_object_or_404(PaymentMethod, pk=pk)

    def get(self, request, pk):
        try:
            from .serializers import PaymentMethodSerializerV2 as PaymentMethodSerializer
            payment_method = self.get_object(pk)
            serializer = PaymentMethodSerializer(payment_method)
            return Response({'success': True, 'data': serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, pk):
        try:
            from .serializers import PaymentMethodSerializerV2 as PaymentMethodSerializer
            payment_method = self.get_object(pk)
            serializer = PaymentMethodSerializer(payment_method, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response({'success': True, 'data': serializer.data, 'message': 'Payment method updated successfully'}, status=status.HTTP_200_OK)
            return Response({'success': False, 'message': 'Validation error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        try:
            payment_method = self.get_object(pk)
            # Toggle is_active instead of actual deletion as per user request
            payment_method.is_active = not payment_method.is_active
            payment_method.save()
            status_msg = "activated" if payment_method.is_active else "deactivated"
            return Response({'success': True, 'message': f'Payment method {status_msg} successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
