import os
import json
import logging
from datetime import datetime
from io import BytesIO
from django.core.mail import EmailMessage
from django.conf import settings
from django.db import connection
from decimal import Decimal

import threading
from concurrent.futures import ThreadPoolExecutor
try:
    from weasyprint import HTML as WeasyHTML
    HAS_WEASYPRINT = True
except Exception:
    WeasyHTML = None
    HAS_WEASYPRINT = False

logger = logging.getLogger(__name__)

def fetch_receipt_data_by_id(receipt_id):
    """
    Fetch consolidated receipt data by receipt_id or transaction_id using SQL.
    Matches the logic in PaymentHistoryView for 100% data parity.
    This allows standalone receipt PDF generation.
    """
    try:
        # Part 1: Bill Payments
        where_p1 = "spd.receipt_id = %s OR spd.transaction_id = %s"
        params_p1 = [str(receipt_id), str(receipt_id)]
        
        # Part 2: Pure Advance Payments
        where_p2 = "spd.receipt_id = %s OR spd.transaction_id = %s"
        params_p2 = [str(receipt_id), str(receipt_id)]

        sql = f"""
                SELECT * FROM (
                    -- Part 1: Bill Payments (One row per transaction)
                    SELECT 
                        CAST(DATE_FORMAT(
                            CONCAT(
                                LPAD(sfp.service_period_year, 4, '0'), '-',
                                LPAD(sfp.service_period_month, 2, '0'), '-01'
                            ), 
                            '%%Y-%%m-01'
                        ) AS CHAR) AS service_month,
                        sfp.service_period_month,
                        sfp.service_period_year,
                        CAST(DATE_FORMAT(
                            CONCAT(
                                LPAD(sfp.service_period_year, 4, '0'), '-',
                                LPAD(sfp.service_period_month, 2, '0'), '-01'
                            ), 
                            '%%M %%Y'
                        ) AS CHAR) AS month_name,
                        
                        CAST(sfp.amount AS CHAR) AS original_amount,
                        CAST(sfp.amount AS CHAR) AS service_fee_amount,
                        CAST(sfp.amount AS CHAR) AS bill_amount, -- Added for consistency with receipt PDF
                        CAST(sfp.amount AS CHAR) AS total_amount,
                        CAST(sfp.remaining_amount AS CHAR) AS due_amount,
                        CAST(sfp.remaining_amount AS CHAR) AS remaining_amount,
                        CAST(spd.receipt_id AS CHAR) AS receipt_id,
                        CAST(spd.transaction_id AS CHAR) AS transaction_id,
                        CAST(COALESCE(pm.method_name, spd.other_method_name, 'N/A') AS CHAR) as method_display,
                        CAST(DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s') AS CHAR) as payment_date,
                        CAST(spd.total_paid AS CHAR) AS paid_amount,
                        CAST(sfp.penalty_amount AS CHAR) AS penalty_amount,
                        CAST(sfp.waived_amount AS CHAR) AS waived_amount,
                        CAST(sfp.gross_penalty_amount AS CHAR) AS gross_penalty_amount,
                        CASE WHEN spd.payment_type = 'advance_payment' THEN CAST(spd.total_paid AS CHAR) ELSE '0' END AS advance_amount,
                        
                        sfp.due_date,
                        spd.created_at, -- Use transaction creation time
                        CAST(DATE_FORMAT(spd.created_at, '%%b %%d, %%Y') AS CHAR) AS invoiceDate,
                        CAST(sfp.payment_status AS CHAR) AS payment_status,
                        CAST(sfp.service_status AS CHAR) AS service_status,
                        
                        u.id AS unit_id,
                        CAST(u.unit_name AS CHAR) AS unit_name,
                        CAST(u.unit_name AS CHAR) AS unit_display,
                        t.id AS tower_id,
                        CAST(t.tower_name AS CHAR) AS tower_name,
                        
                        sfp.service_fee_id,
                        sfp.id AS payment_id, -- Original bill ID
                        CAST(sfp.bill_number AS CHAR) AS bill_number,
                        
                        sfp.owner_id,
                        CAST(sfp.owner_name AS CHAR) AS owner_name,
                        CAST(sfp.owner_email AS CHAR) AS owner_email,
                        CAST(sfp.owner_phone AS CHAR) AS owner_phone,
                        
                        CAST(sfp.owner_name AS CHAR) AS resident_name,
                        CAST(sfp.owner_name AS CHAR) AS primary_name,
                        CAST(sfp.owner_email AS CHAR) AS resident_email,
                        CAST(sfp.owner_email AS CHAR) AS primary_email,
                        CAST(sfp.owner_phone AS CHAR) AS resident_number,
                        CAST(sfp.owner_phone AS CHAR) AS primary_number,
                        
                        CAST(sfp.account_holder_type AS CHAR) AS account_holder_type,
                        sfp.account_holder_id,
                        
                        CAST(COALESCE(m.full_name, 'System') AS CHAR) AS created_by_name,
                        
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
                                'paid_amount', CAST(spd.total_paid AS CHAR),
                                'service_period_month', sfp.service_period_month,
                                'service_period_year', sfp.service_period_year,
                                'penalty_amount', CAST(sfp.penalty_amount AS CHAR),
                                'waived_amount', CAST(sfp.waived_amount AS CHAR),
                                'gross_penalty_amount', CAST(sfp.gross_penalty_amount AS CHAR),
                                'service_status', CAST(sfp.service_status AS CHAR),
                                'status', CAST(sfp.service_status AS CHAR),
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
                    
                    WHERE {where_p1}
                    
                    UNION ALL
                    
                    -- Part 2: Pure Advance Payments (no bill)
                    SELECT 
                        CAST(NULL AS CHAR) AS service_month,
                        CAST(NULL AS SIGNED) AS service_period_month,
                        CAST(NULL AS SIGNED) AS service_period_year,
                        CAST('Advance Payment' AS CHAR) AS month_name,
                        
                        CAST('0' AS CHAR) AS original_amount,
                        CAST('0' AS CHAR) AS service_fee_amount,
                        CAST('0' AS CHAR) AS bill_amount, -- Added for consistency
                        CAST(spd.total_paid AS CHAR) AS total_amount,
                        CAST('0' AS CHAR) AS due_amount,
                        CAST('0' AS CHAR) AS remaining_amount,
                        
                        CAST(spd.receipt_id AS CHAR) AS receipt_id,
                        CAST(spd.transaction_id AS CHAR) AS transaction_id,
                        CAST(COALESCE(pm.method_name, spd.other_method_name, 'N/A') AS CHAR) as method_display,
                        CAST(DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s') AS CHAR) as payment_date,
                        CAST(spd.total_paid AS CHAR) AS paid_amount,
                        
                        CAST('0' AS CHAR) AS penalty_amount,
                        CAST('0' AS CHAR) AS waived_amount,
                        CAST('0' AS CHAR) AS gross_penalty_amount,
                        CAST(spd.total_paid AS CHAR) AS advance_amount,
                        
                        CAST(NULL AS DATE) AS due_date,
                        spd.created_at,
                        CAST(DATE_FORMAT(spd.created_at, '%%b %%d, %%Y') AS CHAR) AS invoiceDate,
                        CAST('completed' AS CHAR) AS payment_status,
                        CAST('advance' AS CHAR) AS service_status,
                        
                        u.id AS unit_id,
                        CAST(u.unit_name AS CHAR) AS unit_name,
                        CAST(u.unit_name AS CHAR) AS unit_display,
                        t.id AS tower_id,
                        CAST(t.tower_name AS CHAR) AS tower_name,
                        
                        CAST(NULL AS SIGNED) AS service_fee_id,
                        CAST(NULL AS SIGNED) AS payment_id,
                        CAST(NULL AS CHAR) AS bill_number, 
                        
                        adv.account_holder_id AS owner_id,
                        CAST(COALESCE(m_owner.full_name, u.primary_name) AS CHAR) AS owner_name,
                        CAST(COALESCE(m_owner.general_email, u.primary_email) AS CHAR) AS owner_email,
                        CAST(COALESCE(m_owner.general_contact, u.primary_number) AS CHAR) AS owner_phone,
                        
                        CAST(COALESCE(m_owner.full_name, u.primary_name) AS CHAR) AS resident_name,
                        CAST(COALESCE(m_owner.full_name, u.primary_name) AS CHAR) AS primary_name,
                        CAST(COALESCE(m_owner.general_email, u.primary_email) AS CHAR) AS resident_email,
                        CAST(COALESCE(m_owner.general_email, u.primary_email) AS CHAR) AS primary_email,
                        CAST(COALESCE(m_owner.general_contact, u.primary_number) AS CHAR) AS resident_number,
                        CAST(COALESCE(m_owner.general_contact, u.primary_number) AS CHAR) AS primary_number,
                        
                        CAST(adv.account_holder_type AS CHAR) AS account_holder_type,
                        adv.account_holder_id,
                        
                        CAST(COALESCE(m.full_name, 'System') AS CHAR) AS created_by_name,
                        
                        JSON_ARRAY(
                            JSON_OBJECT(
                                'id', spd.id,
                                'billing_id', spd.billing_id,
                                'transaction_id', spd.transaction_id,
                                'receipt_id', spd.receipt_id,
                                'payment_date', DATE_FORMAT(spd.payment_date, '%%Y-%%m-%%d %%H:%%i:%%s'),
                                'payment_method', COALESCE(pm.method_name, spd.other_method_name, 'N/A'),
                                'paid_amount', CAST(spd.total_paid AS CHAR),
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
                                'service_period_month', CAST(NULL AS SIGNED),
                                'service_period_year', CAST(NULL AS SIGNED),
                                'month_name', CAST('Advance Payment' AS CHAR),
                                'status', CAST('advance' AS CHAR),
                                'service_status', CAST('advance' AS CHAR),
                                'penalty_amount', CAST('0' AS CHAR),
                                'waived_amount', CAST('0' AS CHAR),
                                'gross_penalty_amount', CAST('0' AS CHAR)
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
                    
                    WHERE {where_p2}
                ) combined_results
                ORDER BY created_at DESC
            """

        with connection.cursor() as cursor:
            cursor.execute(sql, params_p1 + params_p2)
            columns = [col[0] for col in cursor.description]
            raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]

        print("DEBUG_QUERY_RAW_DATA", json.dumps([ {k:str(v) for k,v in r.items()} for r in raw_data], indent=2))

        if not raw_data:
            return None

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

        if not consolidated_payments:
            return None

        # Take the first consolidated result
        final_receipt = list(consolidated_payments.values())[0]
        
        # Convert payment_details list back to JSON string
        raw_details = final_receipt['payment_details']
        final_receipt['payment_details'] = json.dumps(final_receipt['payment_details'])
        # Also maintain parsed_allocations natively so components don't have to JSON.parse
        final_receipt['parsed_allocations'] = raw_details
        
        # Convert Decimal amounts to strings for JSON serialization
        final_receipt['paid_amount'] = str(final_receipt['total_paid_amount'])
        final_receipt['advance_amount'] = str(final_receipt['advance_amount'])
        final_receipt['total_amount'] = str(final_receipt['total_paid_amount'])
        final_receipt['total_paid_amount'] = str(final_receipt['total_paid_amount'])

        print("consolidated_data", final_receipt)
        return final_receipt

    except Exception as e:
        logger.error(f"Error fetching receipt data: {e}", exc_info=True)
        return None

def get_month_name(month_number):
    """Convert month number to month name"""
    months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    try:
        return months[int(month_number) - 1] if month_number else 'Unknown'
    except (IndexError, ValueError, TypeError):
        return 'Unknown'

def format_date(date_value):
    """Format date to DD-MMM-YYYY format"""
    if not date_value or str(date_value) in ['1970-01-01T00:00:00Z', '1970-01-01', 'None']:
        return 'N/A'
    try:
        if isinstance(date_value, str):
            date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        else:
            date_obj = date_value
        
        day = str(date_obj.day).zfill(2)
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month = month_names[date_obj.month - 1]
        year = date_obj.year
        return f"{day}-{month}-{year}"
    except Exception:
        return 'N/A'

def format_time_for_email(date_value):
    """Format time from date value"""
    if not date_value or str(date_value) in ['1970-01-01T00:00:00Z', '1970-01-01', 'None']:
        return 'N/A'
    try:
        if isinstance(date_value, str):
            date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        else:
            date_obj = date_value
        
        return date_obj.strftime('%I:%M:%S %p')
    except Exception:
        return 'N/A'

def format_date_for_email(date_value):
    """Format date to readable format (e.g., Monday, January 15, 2025)"""
    if not date_value or str(date_value) in ['1970-01-01T00:00:00Z', '1970-01-01', 'None']:
        return 'N/A'
    try:
        if isinstance(date_value, str):
            date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        else:
            date_obj = date_value
        
        return date_obj.strftime('%A, %B %d, %Y')
    except Exception:
        return 'N/A'

def format_currency_for_email(amount):
    """Format amount as currency"""
    try:
        if not amount:
            return '0.00'
        num_amount = float(str(amount))
        return f"{num_amount:,.2f}"
    except (ValueError, TypeError):
        return '0.00'

def generate_payment_receipt_html(payment_data):
    """Generate HTML content for payment receipt, matching the premium frontend design."""
    print("payment_data",payment_data)
    # Define local font paths for PDF generation
    from django.conf import settings
    
    _font_file = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'NotoSansBengali-Regular.ttf')
    _en_font_file = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'NotoSans-Regular.ttf')
    
    # Format for CSS url() - must use forward slashes even on Windows
    font_path = _font_file.replace('\\', '/')
    en_font_path = _en_font_file.replace('\\', '/')

    # Utility function
    def safe_float(val):
        try:
            return float(str(val)) if val is not None else 0.0
        except (ValueError, TypeError):
            return 0.0

    # 1. Gather all variables needed by the template
    transaction_id = payment_data.get('transaction_id') or 'N/A'
    
    # Receipt ID retrieval
    receipt_no = payment_data.get('receipt_id') or payment_data.get('receiptNo')
    
    # If not found at top level, check payment_details
    pd_list = payment_data.get('payment_details')
    if isinstance(pd_list, str):
        try:
            import json
            pd_list = json.loads(pd_list)
        except Exception:
            pd_list = []
    
    if not receipt_no and pd_list and len(pd_list) > 0:
        receipt_no = pd_list[0].get('receipt_id')
        if not transaction_id or transaction_id == 'N/A':
            transaction_id = pd_list[0].get('transaction_id', 'N/A')

    if not receipt_no or receipt_no == 'N/A':
        if transaction_id and transaction_id != 'N/A':
            receipt_no = f"REC-{transaction_id[-6:]}"
        else:
            receipt_no = "REC-0000"
            
    # Amount & Allocations
    total_amount_val = safe_float(payment_data.get('total_paid_amount') or payment_data.get('paid_amount') or payment_data.get('total_amount') or payment_data.get('amount') or 0)
    allocations = pd_list if pd_list else []
    
    # Advance Amount
    advance_amount_val = safe_float(payment_data.get('advance_amount') or 0)
    has_advance = advance_amount_val > 0
    
    # Channel Details
    channel_method = payment_data.get('payment_method_display') or payment_data.get('method_display') or 'N/A'
    channel_from = 'N/A'
    channel_to = 'N/A'
    channel_toName = ''
    
    if allocations and len(allocations) > 0:
        pd = allocations[0]
        if pd.get('payment_method'): channel_method = pd.get('payment_method')
        notes_str = pd.get('notes', '')
        if 'From:' in notes_str:
            parts = notes_str.split('From:')
            if len(parts) > 1:
                after_from = parts[1]
                channel_from = after_from.split(',')[0].split('-')[0].strip()
        if pd.get('to_account_number'): channel_to = pd.get('to_account_number')
        if pd.get('to_account_name'): channel_toName = pd.get('to_account_name')

    # Date formatting
    payment_date_val = payment_data.get('payment_date') or (allocations[0].get('payment_date') if allocations else None)
    payment_date_str = format_date(payment_date_val)

    # Resident Info
    tower_name_str = payment_data.get('tower_name', 'N/A')
    resident_name = payment_data.get('primary_name') or payment_data.get('resident_name') or 'N/A'
    phone = payment_data.get('phone') or payment_data.get('owner_phone') or payment_data.get('primary_number') or 'N/A'
    unit_display = payment_data.get('unit_display') or payment_data.get('unit_name') or 'N/A'
    email = payment_data.get('primary_email') or payment_data.get('resident_email') or payment_data.get('owner_email') or 'N/A'

    # Currency symbol
    TK = "৳"

    # Build Allocation Rows
    alloc_rows = ""
    if allocations:
        for alloc in allocations:
            month = alloc.get('service_period_month')
            year = alloc.get('service_period_year')
            month_name_text = alloc.get('month_name')
            if not month_name_text and month and year:
                month_name_text = f"{get_month_name(month)} {year}"
            if not month_name_text:
                month_name_text = 'N/A'

            # Determine paid amount vs bill total based on payload source.
            paid_amt_raw = alloc.get('paid_amount') or alloc.get('amount_paid') or alloc.get('total_paid') or alloc.get('paid')
            amount_val = safe_float(alloc.get('amount') or 0)
            
            if paid_amt_raw is not None:
                # SQL payload: 'amount' or 'bill_amount' is the total bill. paid_amt is paid_amt_raw.
                paid_amt = safe_float(paid_amt_raw)
                bill_amt = safe_float(alloc.get('bill_amount') or amount_val)
            else:
                # Direct payload: 'amount' is actually the paid amount.
                paid_amt = amount_val
                # Calculate bill_amt from original_amount (base) + penalties - waived
                base = safe_float(alloc.get('original_amount') or 0)
                pen = safe_float(alloc.get('gross_penalty_amount') or alloc.get('penalty_amount') or 0)
                waiv = safe_float(alloc.get('waived_amount') or 0)
                bill_amt = base + pen - waiv
            
            if paid_amt == 0 and len(allocations) == 1 and total_amount_val > 0:
                paid_amt = total_amount_val
            
            gross_penalty = safe_float(alloc.get('gross_penalty_amount') or alloc.get('penalty_amount') or 0)
            waived = safe_float(alloc.get('waived_amount') or 0)
            status_raw = str(alloc.get('service_status') or 'N/A')

            is_paid = status_raw.lower() == 'paid'
            badge_bg = '#D1FAE5' if is_paid else '#FEF3C7'
            badge_fg = '#047857' if is_paid else '#B45309'

            bill_amt_str = f"{bill_amt:,.0f}" if bill_amt == int(bill_amt) else f"{bill_amt:,.2f}"
            paid_amt_str = f"{paid_amt:,.0f}" if paid_amt == int(paid_amt) else f"{paid_amt:,.2f}"
            pen_str = f"{TK}{gross_penalty:,.0f}" if gross_penalty > 0 and gross_penalty == int(gross_penalty) else (f"{TK}{gross_penalty:,.2f}" if gross_penalty > 0 else "-")
            waived_str = f"{TK}{waived:,.0f}" if waived > 0 and waived == int(waived) else (f"{TK}{waived:,.2f}" if waived > 0 else "-")

            alloc_rows += f'''
                  <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 4px 0; font-weight: 700; font-size: 10px;">{month_name_text}</td>
                    <td style="padding: 4px 6px; text-align: right; font-size: 10px;">{TK}{bill_amt_str}</td>
                    <td style="padding: 4px 6px; text-align: right; font-size: 10px; color: #EF4444;">{pen_str}</td>
                    <td style="padding: 4px 6px; text-align: right; font-size: 10px; color: #10B981;">{waived_str}</td>
                    <td style="padding: 4px 6px; text-align: right; font-weight: 800; font-size: 10px; color: #3D9D9B;">{TK}{paid_amt_str}</td>
                    <td style="padding: 4px 0; text-align: center;">
                       <span style="display: inline-block; padding: 2px 8px; border-radius: 50px; font-size: 7px; font-weight: 800; text-transform: uppercase; background-color: {badge_bg}; color: {badge_fg}; text-align: center; min-width: 45px; line-height: 1;">
                          {status_raw.upper()}
                       </span>
                    </td>
                  </tr>
            '''
            print("alloc_rows",alloc_rows)
    else:
        # Fallback single row
        total_str = f"{total_amount_val:,.0f}" if total_amount_val == int(total_amount_val) else f"{total_amount_val:,.2f}"
        alloc_rows = f'''
                  <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 6px 0; font-weight: 700; font-size: 11px;">N/A</td>
                    <td style="padding: 6px 8px; text-align: right; font-size: 11px;">{TK}{total_str}</td>
                    <td style="padding: 6px 8px; text-align: right; font-size: 11px;">-</td>
                    <td style="padding: 6px 8px; text-align: right; font-size: 11px;">-</td>
                    <td style="padding: 6px 8px; text-align: right; font-weight: 800; font-size: 11px; color: #3D9D9B;">{TK}{total_str}</td>
                    <td style="padding: 10px 0; text-align: center; font-size: 12px; color: #64748B;">-</td>
                  </tr>
        '''

    # Summary calculations
    subtotal = total_amount_val - advance_amount_val
    subtotal_str = f"{subtotal:,.0f}" if subtotal == int(subtotal) else f"{subtotal:,.2f}"
    advance_str = f"{advance_amount_val:,.0f}" if advance_amount_val == int(advance_amount_val) else f"{advance_amount_val:,.2f}"
    final_total_str = f"{total_amount_val:,.0f}" if total_amount_val == int(total_amount_val) else f"{total_amount_val:,.2f}"

    notes = payment_data.get('notes') or f"Service fee payment for {tower_name_str} - {unit_display}."
    recorded_by = payment_data.get('created_by_name') or payment_data.get('received_by_name') or 'System'
    
    # Recorded At
    create_time = payment_data.get('created_at') or payment_date_val or datetime.now()
    try:
        if isinstance(create_time, str):
            dt_obj = datetime.fromisoformat(create_time.replace('Z', '+00:00'))
        else:
            dt_obj = create_time
        recorded_at_str = dt_obj.strftime('%d/%m/%Y, %I:%M:%S %p')
    except Exception:
        recorded_at_str = datetime.now().strftime('%d/%m/%Y, %I:%M:%S %p')


    # HTML Template
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Payment Receipt - {receipt_no}</title>
    <style>
        @font-face {{
            font-family: 'BengaliFont';
            src: url('file:///{font_path}');
        }}
        @font-face {{
            font-family: 'NotoSans';
            src: url('file:///{en_font_path}');
        }}
        @page {{ 
            size: a4 portrait; 
            margin: 0; 
        }}
        * {{ box-sizing: border-box; }}
        html, body {{
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #f3f4f6;
        }}
        body {{ 
            font-family: 'NotoSans', 'BengaliFont', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            color: #1F2937; 
            line-height: 1.4; 
            font-size: 11px;
        }}
        .outer-wrapper-table {{
            width: 100%;
            height: 100%;
            border-collapse: collapse;
        }}
        .receipt-container {{ 
            width: 210mm; 
            margin: 0 auto; 
            background: white; 
            padding: 5mm 10mm; 
            box-shadow: 0 0 20px rgba(0,0,0,0.01);
            text-align: left;
        }}
        
        @media print {{
            html, body {{ background-color: white !important; }}
            .receipt-container {{ 
                margin: 0 !important; 
                box-shadow: none !important;
                border: none !important;
                padding: 5mm 10mm !important;
            }}
        }}
        
        .header-section {{ text-align: center; margin-bottom: 8px; }}
        .company-name {{ font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 1px; }}
        .company-subtitle {{ font-size: 10px; color: #6B7280; font-weight: 500; margin-bottom: 6px; }}
        .status-badge {{ 
            background-color: #ECFDF5; color: #059669; padding: 3px 12px; border-radius: 50px; 
            font-weight: 700; font-size: 9px; letter-spacing: 0.04em; text-transform: uppercase; 
            display: inline-block; border: 1px solid #D1FAE5;
        }}
        .meta-info-bar {{ background-color: #F9FAFB; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; border: 1px solid #E5E7EB; }}
        .meta-label {{ font-size: 7px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }}
        .meta-value {{ font-size: 11px; font-weight: 700; color: #111827; }}
        .section-card {{ border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 15px; margin-bottom: 8px; }}
        .section-header {{ font-size: 11px; font-weight: 700; color: #111827; border-bottom: 1px solid #F3F4F6; padding-bottom: 4px; margin-bottom: 8px; }}
        .info-label {{ font-size: 8px; color: #6B7280; margin-bottom: 2px; }}
        .info-value {{ font-size: 10px; color: #111827; font-weight: 600; }}
        .payment-table {{ width: 100%; border-collapse: collapse; margin-bottom: 8px; }}
        .summary-area {{ background-color: #F8FAFC; border-radius: 8px; padding: 8px 12px; margin-top: 5px; border: 1px solid #F1F5F9; }}
        .total-label {{ font-size: 13px; font-weight: 800; color: #111827; }}
        .total-value {{ font-size: 18px; font-weight: 800; color: #0D9488; }}
        .notes-box {{ background-color: #EFF6FF; border-radius: 8px; padding: 8px 12px; color: #1E40AF; font-size: 10px; margin-bottom: 8px; border: 1px solid #DBEAFE; }}
        .notes-title {{ font-weight: 800; margin-bottom: 3px; text-transform: uppercase; font-size: 8px; letter-spacing: 0.04em; opacity: 0.7; }}
        .footer {{ text-align: center; border-top: 1px solid #E5E7EB; padding-top: 10px; font-size: 9px; color: #6B7280; }}
        .footer-bold {{ font-weight: 700; color: #374151; }}
    </style>
</head>
<body>
    <table class="outer-wrapper-table">
        <tr>
            <td align="center" valign="top">
                <div class="receipt-container">
                    <div class="header-section">
                        <div style="margin-bottom: 5px;">
                            <div style="width: 50px; height: 50px; background-color: #F0FDFA; border-radius: 100%; border: 1px solid #CCFBF1; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                                <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMEQ5NDg4Ij48cGF0aCBkPSJNMTkgMkg5Yy0xLjEwMyAwLTIgLjg5Ny0yIDJ2NS41ODZsLTQuNzA3IDQuNzA3QTEgMSAwIDAgMCAzIDE2djVhMSAxIDAgMCAwIDEgMWgxNmExIDEgMCAwIDAgMS0xVjRjMC0xLjEwMy0uODk3LTItMi0yem0tOCAxOEg1di01LjU4NmwzLTMgMyAzVjIwem04IDBoLTZ2LTRhLjk5OS45OTkgMCAwIDAgLjcwNy0xLjcwN0w5IDkuNTg2VjRoMTB2MTZ6Ii8+PHBhdGggZD0iTTExIDZoMnYyaC0yem00IDBoMnYyaC0yem0wIDQuMDMxaDJWMTJoLTJ6TTE1IDE0aDJ2MmgtMnptLTggMWgydjJIN3oiLz48L3N2Zz4=" style="width: 30px; height: 30px;" />
                            </div>
                        </div>
                        <div class="company-name">Estate Link</div>
                        <div class="company-subtitle">Property Management Services</div>
                        <div class="status-badge"><span style="font-size: 12px;">&#10003;</span> PAYMENT RECEIVED</div>
                    </div>

        <div class="meta-info-bar">
            <table width="100%">
                <tr>
                    <td width="33%">
                        <div class="meta-label">Receipt Number</div>
                        <div class="meta-value">{receipt_no}</div>
                    </td>
                    <td width="33%">
                        <div class="meta-label">Transaction ID</div>
                        <div class="meta-value">{transaction_id}</div>
                    </td>
                    <td width="33%" align="right">
                        <div class="meta-label">Payment Date</div>
                        <div class="meta-value">{payment_date_str}</div>
                    </td>
                </tr>
            </table>
            <div style="border-top: 1px solid #E5E7EB; margin: 8px 0;"></div>
            <table width="100%">
                <tr>
                    <td width="33%">
                        <div class="meta-label">Method</div>
                        <div class="meta-value">{channel_method}</div>
                    </td>
                    <td width="33%">
                        <div class="meta-label">From Account</div>
                        <div class="meta-value" style="font-family: monospace;">{channel_from}</div>
                    </td>
                    <td width="33%" align="right">
                        <div class="meta-label">To Account</div>
                        <div class="meta-value" style="font-family: monospace;">{channel_to}</div>
                        {f'<div style="font-size: 10px; color: #6B7280;">{channel_toName}</div>' if channel_toName else ''}
                    </td>
                </tr>
            </table>
        </div>

        <div class="section-card">
            <div class="section-header">Resident Information</div>
            <table width="100%">
                <tr>
                    <td width="50%" style="padding-bottom: 12px;">
                        <div class="info-label">Tower</div>
                        <div class="info-value">{tower_name_str}</div>
                    </td>
                    <td width="50%" style="padding-bottom: 12px;">
                        <div class="info-label">Unit Number</div>
                        <div class="info-value">{unit_display}</div>
                    </td>
                </tr>
                <tr>
                    <td width="50%" style="padding-bottom: 12px;">
                        <div class="info-label">Resident Name</div>
                        <div class="info-value">{resident_name}</div>
                    </td>
                    <td width="50%" style="padding-bottom: 12px;">
                        <div class="info-label">Email</div>
                        <div class="info-value">{email}</div>
                    </td>
                </tr>
                <tr>
                    <td width="50%">
                        <div class="info-label">Phone</div>
                        <div class="info-value">{phone}</div>
                    </td>
                    <td width="50%"></td>
                </tr>
            </table>
        </div>

        <div class="section-card">
            <div class="section-header">Payment Allocation</div>
            <table class="payment-table">
                <thead>
                    <tr style="background-color: #F8FAFC;">
                        <th style="padding: 8px 0; font-size: 9px; color: #94A3B8; text-transform: uppercase; text-align: left; border-bottom: 2px solid #E2E8F0;">Bill Month</th>
                        <th style="padding: 8px 6px; font-size: 9px; color: #94A3B8; text-transform: uppercase; text-align: right; border-bottom: 2px solid #E2E8F0;">Bill Amount</th>
                        <th style="padding: 8px 6px; font-size: 9px; color: #94A3B8; text-transform: uppercase; text-align: right; border-bottom: 2px solid #E2E8F0;">Penalty</th>
                        <th style="padding: 8px 6px; font-size: 9px; color: #94A3B8; text-transform: uppercase; text-align: right; border-bottom: 2px solid #E2E8F0;">Waived</th>
                        <th style="padding: 8px 6px; font-size: 9px; color: #94A3B8; text-transform: uppercase; text-align: right; border-bottom: 2px solid #E2E8F0;">Paid</th>
                        <th style="padding: 8px 0; font-size: 9px; color: #94A3B8; text-transform: uppercase; text-align: center; border-bottom: 2px solid #E2E8F0;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {alloc_rows}
                </tbody>
            </table>

            <div class="summary-area">
                <table width="100%">
                    <tr>
                        <td class="info-label" style="font-weight: 700;">Subtotal (Bills Payment)</td>
                        <td align="right" class="info-value" style="font-weight: 800;">{TK}{subtotal_str}</td>
                    </tr>
                    {f'''
                    <tr>
                        <td class="info-label" style="font-weight: 700; color: #7C3AED; padding-top: 5px;">Advance Payment (Future Bills)</td>
                        <td align="right" class="info-value" style="font-weight: 800; color: #7C3AED; padding-top: 5px;">{TK}{advance_str}</td>
                    </tr>
                    ''' if has_advance else ''}
                    <tr><td colspan="2" style="border-top: 2px dashed #E5E7EB; margin: 8px 0; padding-top: 8px;"></td></tr>
                    <tr>
                        <td class="total-label">Total Amount Paid</td>
                        <td align="right" class="total-value">{TK}{final_total_str}</td>
                    </tr>
                </table>
            </div>
        </div>


        <div class="notes-box">
            <div class="notes-title">Notes</div>
            <div style="line-height: 1.3;">{notes}</div>
        </div>

        <div class="footer">
            <table width="100%">
                <tr>
                    <td align="left">Recorded By: <span class="footer-bold">{recorded_by}</span></td>
                    <td align="right">Recorded At: <span class="footer-bold">{recorded_at_str}</span></td>
                </tr>
            </table>
        </div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>"""

    return html_content

def generate_payment_receipt_pdf(html_content, payment_data=None):
    """
    Generate a PDF from payment data using Playwright (fallback to WeasyPrint).
    """
    from service_fee_management.utils.pdf_generation_playwright import generate_pdf_from_html
    return generate_pdf_from_html(html_content)

def send_payment_receipt_email(payment_data, recipient_email):
    """Send payment receipt email to resident"""
    try:
        # Generate email content
        html_content = generate_payment_receipt_html(payment_data)
        
        # Robustly handle payment_details (might be list or JSON string)
        payment_details = payment_data.get('payment_details', [])
        if isinstance(payment_details, str):
            try:
                import json
                payment_details = json.loads(payment_details)
            except:
                payment_details = []
        
        # Email subject - handle multi-month payments
        if len(payment_details) > 0:
            # Multi-month payment
            months_display = payment_data.get('months', 'Multiple Months')
            subject = f"Payment Receipt - {months_display} | Estate Link"
        else:
            # Single month payment
            service_period = f"{get_month_name(payment_data.get('service_period_month'))} {payment_data.get('service_period_year')}"
            subject = f"Payment Receipt - {service_period} | Estate Link"
        
        # Sender email from settings
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@estatelink.com')
        
        # Plain text version (fallback)
        # Extract variables from payment_data
        transaction_id_plain = payment_data.get('transaction_id', 'N/A')
        tower_name_plain = payment_data.get('tower_name', 'N/A')
        unit_display_plain = payment_data.get('unit_display', payment_data.get('unit_name', 'N/A'))
        payment_date = payment_data.get('payment_date')
        
        if len(payment_details) > 0:
            # Multi-month payment
            months_display = payment_data.get('months', 'Multiple Months')
            payment_lines = '\n'.join([
                f"  - {get_month_name(p.get('service_period_month'))} {p.get('service_period_year')}: ৳ {p.get('amount', '0')}"
                for p in payment_details if isinstance(p, dict)
            ])
            plain_text = f"""
        Payment Receipt - Estate Link (Multiple Months)
        
        Transaction ID: {transaction_id_plain}
        Resident: {payment_data.get('resident_name', 'N/A')}
        Tower: {tower_name_plain}
        Unit: {unit_display_plain}
        Total Amount: ৳ {payment_data.get('total_amount', '0')}
        Payment Date: {format_date(payment_date)}
        Service Periods:
{payment_lines}
        
        Thank you for your payment!
        
        This is a computer-generated receipt.
        """
        else:
            # Single month payment
            service_period = f"{get_month_name(payment_data.get('service_period_month'))} {payment_data.get('service_period_year')}"
            plain_text = f"""
        Payment Receipt - Estate Link
        
        Transaction ID: {transaction_id_plain}
        Resident: {payment_data.get('resident_name', 'N/A')}
        Tower: {tower_name_plain}
        Unit: {unit_display_plain}
        Amount: ৳ {payment_data.get('amount', '0')}
        Payment Date: {format_date(payment_date)}
        Service Period: {service_period}
        Status: {payment_data.get('service_status', 'Unknown')}
        
        Thank you for your payment!
        
        This is a computer-generated receipt.
        """
        
        # Create a simple, polite email body
        simple_html_body = f"""
        <html>
        <body style="font-family: sans-serif; color: #374151; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px;">
                <h2 style="color: #111827; margin-bottom: 20px;">Payment Receipt</h2>
                <p>Dear {payment_data.get('resident_name', 'Resident')},</p>
                <p>We successfully received your payment of <b>৳ {payment_data.get('total_amount', payment_data.get('amount', '0'))}</b>.</p>
                <p>Please find the official <b>PDF receipt attached</b> to this email for your records.</p>
                <br/>
                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 20px 0;">
                <p style="font-size: 12px; color: #9CA3AF;">This is an automated message from Estate Link. Please do not reply.</p>
            </div>
        </body>
        </html>
        """
        
        # Prepare email
        email = EmailMessage(
            subject=subject,
            body=simple_html_body,
            from_email=from_email,
            to=[recipient_email],
        )
        email.content_subtype = "html"  # Make the body HTML
        
        # Generate and attach PDF
        try:
            pdf_content = generate_payment_receipt_pdf(html_content, payment_data=payment_data)
            if pdf_content:
                receipt_no = payment_data.get('receipt_id') or payment_data.get('receipt_no', 'Receipt')
                filename = f"Payment_Receipt_{receipt_no}.pdf"
                email.attach(filename, pdf_content, "application/pdf")
                logger.info(f"PDF receipt attached to email for {recipient_email}")
        except Exception as pdf_err:
            logger.error(f"Failed to generate/attach PDF: {str(pdf_err)}")
        
        # Send email
        email.send(fail_silently=False)

        
        logger.info(f"Payment receipt email sent successfully to {recipient_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send payment receipt email to {recipient_email}: {str(e)}")
        return False

def get_resident_email(payment_data):
    """Get resident email from payment data or database"""
    try:
        # Try to get email from payment data first
        resident_email = payment_data.get('resident_email')
        if resident_email:
            return resident_email
            
        # If not in payment data, query from database
        from user.models import Member
        member_id = payment_data.get('member_id')
        if member_id:
            try:
                member = Member.objects.get(id=member_id)
                email = member.general_email if member.general_email else None
                print(f"DEBUG: Found email from member_id: {email}")
                return email
            except Member.DoesNotExist:
                pass
                
        return None
    except Exception as e:
        logger.error(f"Error getting resident email: {str(e)}")
        return None

def trigger_bulk_payment_receipt_emails(receipt_ids):
    """
    Trigger bulk payment receipt emails in a background thread.
    Args:
        receipt_ids: List of receipt_id or transaction_id strings
    """
    if not receipt_ids:
        return
        
    def worker():
        try:
            from django.db import connections
            for conn in connections.all():
                conn.close_if_unusable_or_obsolete()
                
            unique_receipts = list(set([str(r) for r in receipt_ids if r]))
            logger.info(f"[ReceiptBulk] Starting bulk receipt emails for {len(unique_receipts)} receipts...")
            print(f"[ReceiptBulk] 📂 Dispatching {len(unique_receipts)} receipts...")
            
            # Fetch data for all receipts
            receipt_data_list = []
            for rid in unique_receipts:
                try:
                    receipt_data = fetch_receipt_data_by_id(rid)
                    if receipt_data:
                        receipt_data_list.append(receipt_data)
                except Exception as fetch_err:
                    logger.warning(f"[ReceiptBulk] Failed to fetch data for receipt {rid}: {fetch_err}")
            
            if not receipt_data_list:
                logger.info("[ReceiptBulk] No data found for any receipt ID")
                return
            
            with ThreadPoolExecutor(max_workers=5) as executor:
                for r_data in receipt_data_list:
                    email = r_data.get('owner_email') or r_data.get('primary_email')
                    if email:
                        executor.submit(send_payment_receipt_email, r_data, email)
                    else:
                        print(f"  ⚠️ [ReceiptBulk] No email found for receipt {r_data.get('receipt_id')}")
                        
            logger.info(f"[ReceiptBulk] ✅ Completed bulk receipt email dispatch")
            print(f"[ReceiptBulk] ✅ Bulk dispatch complete")
        except Exception as e:
            logger.error(f"[ReceiptBulk] Critical thread error: {e}", exc_info=True)

    t = threading.Thread(target=worker, name="BulkReceiptEmailThread")
    t.daemon = True
    t.start()