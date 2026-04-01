"""
Bill Detail Email Utility
Sends bill detail emails (invoice) to unit owners with PDF attachment.
Supports bulk sending with ThreadPoolExecutor for performance.
Design matches frontend BillDetailView.jsx exactly.
"""
import os
import json
import logging
import threading
from io import BytesIO
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.mail import EmailMessage
from django.conf import settings
from django.db import connection, connections
try:
    from weasyprint import HTML as WeasyHTML
    HAS_WEASYPRINT = True
except Exception:
    WeasyHTML = None
    HAS_WEASYPRINT = False

logger = logging.getLogger(__name__)

# ─── Helpers ─────────────────────────────────────────────────────────

def _get_month_name(m):
    months = ['January','February','March','April','May','June',
              'July','August','September','October','November','December']
    try:
        return months[int(m) - 1]
    except:
        return 'Unknown'

def _fmt_date(val):
    if not val:
        return 'N/A'
    try:
        if isinstance(val, str):
            d = datetime.fromisoformat(val.replace('Z', '+00:00'))
        else:
            d = val
        months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"]
        return f"{months[d.month-1]} {d.day}, {d.year}"
    except:
        return str(val)


def _fmt_currency(amount, use_tk=True):
    """Format amount with Taka symbol (৳) for WeasyPrint PDF."""
    try:
        v = float(amount or 0)
        s = f"{int(v):,}" if v == int(v) else f"{v:,.2f}"
        return f"৳{s}" if use_tk else f"Tk {s}"
    except:
        return "৳0"

def safe_float(val):
    try:
        if val is None:
            return 0.0
        return float(val)
    except:
        return 0.0

def calculate_days_overdue(due_date_val, base_date=None):
    """
    Calculates number of days overdue, matching frontend calculateDaysOverdue logic.
    """
    if not due_date_val:
        return 0
    
    try:
        # Normalize due_date to date object
        if isinstance(due_date_val, str):
            if 'T' in due_date_val:
                dt = datetime.fromisoformat(due_date_val.replace('Z', '+00:00'))
                due_date = dt.date()
            else:
                due_date = date.fromisoformat(due_date_val)
        elif isinstance(due_date_val, datetime):
            due_date = due_date_val.date()
        else:
            due_date = due_date_val
            
        # Normalize base_date to date object
        if base_date is None:
            base_date = date.today()
        elif isinstance(base_date, str):
            if 'T' in base_date:
                dt = datetime.fromisoformat(base_date.replace('Z', '+00:00'))
                base_date = dt.date()
            else:
                base_date = date.fromisoformat(base_date)
        elif isinstance(base_date, datetime):
            base_date = base_date.date()
            
        diff = (base_date - due_date).days
        return max(0, diff)
    except Exception as e:
        logger.error(f"Error calculating days overdue: {e}")
        return 0


# ─── Fetch bill data using SAME query as BillingDetailedListView ─────

def fetch_bill_data_for_email(payment_ids):
    """
    Fetch bill data using the exact same SQL query as the BillingDetailedListView API.
    This ensures 100% data parity between frontend display and email PDF.
    
    Args:
        payment_ids: list of ServiceFeePayment IDs
        
    Returns:
        list of dicts (same structure as API response data.payments)
    """
    if not payment_ids:
        return []
    
    placeholders = ','.join(['%s'] * len(payment_ids))
    
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
            CAST(sfp.base_service_amount AS CHAR) AS base_service_amount,
            CAST(sfp.base_service_amount AS CHAR) AS original_amount,
            CAST(sfp.base_service_amount AS CHAR) AS service_fee_amount,
            CAST(sfp.additional_bill_charges AS CHAR) AS additional_bill_charges,
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
            COALESCE(NULLIF(sfp.owner_email, ''), NULLIF(u.primary_email, ''), NULLIF(u.secondary_email, '')) AS primary_email,
            sfp.owner_phone AS resident_number,
            sfp.owner_phone AS primary_number,
            
            /* Service status - directly from DB */
            sfp.service_status,

            sfp.account_holder_type,
            sfp.account_holder_id,
            
            /* Service fee items (includes bill categories, penalties, base fee) */
            COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items,
            
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
        
        /* Service fee items - single query for all items (base fee, bill categories, penalties) */
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

        WHERE sfp.id IN ({placeholders})
        ORDER BY sfp.service_period_year DESC, sfp.service_period_month DESC
    """
    
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, list(payment_ids))
            columns = [col[0] for col in cursor.description]
            raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        logger.info(f"[BillEmail] Fetched {len(raw_data)} bill records for email")
        return raw_data
    except Exception as e:
        logger.error(f"[BillEmail] Failed to fetch bill data: {e}", exc_info=True)
        return []


# ─── Currency formatting for PDF (xhtml2pdf can't render ৳) ─────────




# ─── Bill Detail HTML Generator ───────────────────────────────────────

def generate_bill_detail_html(bill_data):
    """
    Generate bill detail / invoice HTML matching the frontend BillDetailView.jsx design.
    """
    # Define local font paths for PDF generation
    # These must be absolute paths for the file:/// protocol to work in WeasyPrint/xhtml2pdf
    from django.conf import settings
    
    _font_file = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'NotoSansBengali-Regular.ttf')
    _en_font_file = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'NotoSans-Regular.ttf')
    
    # Format for CSS url() - must use forward slashes even on Windows
    font_path = _font_file.replace('\\', '/')
    en_font_path = _en_font_file.replace('\\', '/')
    
    bill_number = bill_data.get('bill_number', 'BILL-0000')
    month = bill_data.get('service_period_month')
    year = bill_data.get('service_period_year')
    period = f"{_get_month_name(month)} {year}" if month and year else 'N/A'
    
    resident_name = bill_data.get('owner_name') or bill_data.get('resident_name') or bill_data.get('primary_name') or 'N/A'
    unit_display = bill_data.get('unit_display') or bill_data.get('unit_name') or 'N/A'
    email = bill_data.get('owner_email') or bill_data.get('email') or 'N/A'
    holder_type = (bill_data.get('account_holder_type') or 'owner').upper()
    tower_name = bill_data.get('tower_name', '')
    
    invoice_date = bill_data.get('created_at') or bill_data.get('invoice_date') or datetime.now().isoformat()
    due_date = bill_data.get('due_date')
    
    status = (bill_data.get('service_status') or bill_data.get('status') or 'due').lower()
    # Use ● (filled circle) for paid/partial to match frontend IoCheckmarkCircle icon
    s_icon = '&#9679; ' if status in ('paid', 'partial') else ''
    status_label = f"{s_icon}{status.upper()}"
    status_colors = {
        'paid': ('#dcfce7', '#047857'),
        'partial': ('#dbeafe', '#1d4ed8'),
        'due': ('#fef9c3', '#a16207'),
        'overdue': ('#fee2e2', '#b91c1c'),
    }
    s_bg, s_fg = status_colors.get(status, ('#f3f4f6', '#374151'))
    
    base_fee = float(bill_data.get('base_service_amount') or bill_data.get('service_fee_amount') or 0)
    additional = float(bill_data.get('additional_bill_charges') or bill_data.get('additional_charges') or 0)
    penalty = float(bill_data.get('penalty_amount') or bill_data.get('gross_penalty_amount') or 0)
    waived = float(bill_data.get('waived_amount') or 0)
    total_due = base_fee + additional + penalty - waived
    paid = float(bill_data.get('total_paid') or bill_data.get('paid_amount') or 0)
    # Map frontend CSS colors inside status block
    if status == 'paid':
        s_bg, s_fg = '#dcfce7', '#047857'
        status_text = 'PAID'
    elif status == 'partial':
        s_bg, s_fg = '#dbeafe', '#1d4ed8'
        status_text = 'PARTIAL'
    elif status == 'overdue':
        s_bg, s_fg = '#fee2e2', '#b91c1c'
        status_text = 'OVERDUE'
    else:
        s_bg, s_fg = '#fef9c3', '#a16207'
        status_text = 'DUE'

    # Parse items
    items = bill_data.get('service_fee_items') or []
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except:
            items = []
    
    base_items = [i for i in items if (i.get('item_type','') or '').lower() in ('base_fee', 'bill_category')]
    penalty_items = [i for i in items if (i.get('item_type','') or '').lower() == 'penalty']
    
    # Base fee rows (identical matching frontend logic)
    item_rows_html = ""
    for item in base_items:
        amt = abs(safe_float(item.get('amount', 0)))
        name = item.get('item_name') or item.get('bill_category_name') or 'Service Fee'
        if (item.get('item_type','') or '').lower() == 'base_fee':
            name = 'Service Fee'
        desc = item.get('description', '')
        desc_html = f'<div style="font-size: 10px; color: #6b7280; margin-top: 1px;">{desc}</div>' if desc else ''
        item_rows_html += f'''
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 13px; color: #1f2937;">{name}</div>
              {desc_html}
            </div>
            <div style="text-align: right; margin-left:16px; font-weight: 700; font-size: 13px; color: #1f2937;">
              {_fmt_currency(amt)}
            </div>
          </div>
        '''

    # Penalty rows
    penalty_html = ""
    for item in penalty_items:
        amt = abs(safe_float(item.get('amount', 0)))
        pct = safe_float(item.get('tier_percentage') or 0)
        
        # Calculate ACTUAL days overdue instead of using tier threshold (which usually shows 1)
        # Match frontend logic: use payment date if paid, else today
        p_details = bill_data.get('payment_details') or []
        if isinstance(p_details, str):
            try: p_details = json.loads(p_details)
            except: p_details = []
        
        # Get latest payment date if fully paid
        base_date_for_overdue = datetime.now().date()
        if status == 'paid' and p_details:
             try:
                 # Find latest payment date
                 dates = []
                 for pd in p_details:
                     pd_date = pd.get('payment_date')
                     if pd_date:
                         if isinstance(pd_date, str):
                             dates.append(datetime.fromisoformat(pd_date.replace('Z', '+00:00')))
                         else:
                             dates.append(pd_date)
                 if dates:
                     base_date_for_overdue = max(dates).date()
             except: pass

        actual_days = calculate_days_overdue(due_date, base_date_for_overdue)
        is_overdue = actual_days > 0
        
        days_label = "day" if actual_days == 1 else "days"
        overdue_html = f'<div style="font-size: 13px; color: #b91c1c; font-weight: 600; margin-bottom: 8px;">Payment is {actual_days} {days_label} overdue</div>' if is_overdue else ''
        
        calc_html = ""
        if base_fee > 0 and pct > 0:
            calc_html = f'''
                  <div style="display: inline-block; background: #fff1f2; border-radius: 4px; padding: 4px 10px;">
                    <span style="font-size: 11px; font-weight: 800; color: #be123c; letter-spacing: -0.01em;">
                      {_fmt_currency(base_fee)} &times; {pct}% = {_fmt_currency(amt)}
                    </span>
                  </div>
            '''

        penalty_html += f'''
          <div style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1;">
                <div style="font-weight: 800; font-size: 14px; color: #7f1d1d; margin-bottom: 4px;">Late Payment Penalty ({pct}%)</div>
                {overdue_html}
                {calc_html}
              </div>
              <div style="text-align: right; margin-left: 16px; font-weight: 800; font-size: 14px; color: #7f1d1d;">
                {_fmt_currency(amt)}
              </div>
            </div>
          </div>
        '''

    penalty_note_html = ""
    if penalty_items:
        penalty_note_html = '''
        <div style="margin-top: 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px;">
          <p style="font-size: 11px; color: #92400e; margin: 0; line-height: 1.5; font-weight: 500;">
            <strong style="font-weight: 800;">Note:</strong> Late penalties are automatically calculated based on the number of days past the due date. Pay immediately to avoid additional charges.
          </p>
        </div>
        '''

    # Payment info (if paid or partially paid)
    payment_info_html = ""
    if status in ['paid']:
        payment_details = bill_data.get('payment_details') or []
        if isinstance(payment_details, str):
            try:
                payment_details = json.loads(payment_details)
            except:
                payment_details = []
        
        if payment_details:
            pd_rows = ""
            for pd in payment_details:
                amt_paid = safe_float(pd.get('amount_paid', 0))
                pd_rows += f'''
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
              <div style="flex: 1; padding-right: 10px;">
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Payment Method</p>
                <p style="font-size: 14px; font-weight: 800; color: #0f766e; margin: 0;">{pd.get('payment_method', 'N/A')}</p>
              </div>
              <div style="flex: 1; padding-right: 10px;">
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Transaction ID</p>
                <p style="font-size: 14px; font-weight: 800; color: #0f766e; font-family: monospace; margin: 0;">{pd.get('reference_number') or pd.get('transaction_id', 'N/A')}</p>
              </div>
              <div style="flex: 1; padding-right: 10px;">
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Payment Date</p>
                <p style="font-size: 14px; font-weight: 800; color: #1f2937; margin: 0;">{_fmt_date(pd.get('payment_date'))}</p>
              </div>
              <div style="flex: 1; text-align: right;">
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Amount Paid</p>
                <p style="font-size: 18px; font-weight: 900; color: #0d9488; margin: 0;">{_fmt_currency(amt_paid)}</p>
              </div>
            </div>
            
            <div style="padding-top: 15px; border-top: 1px solid #dcfce7; display: flex; align-items: center; gap: 8px; color: #059669;">
              <span style="font-size: 18px; font-weight: 900;">✔</span>
              <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.025em;">Payment Received - Thank You!</span>
            </div>
                '''
            payment_info_html = f'''
        <div style="margin-top: 25px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 16px; padding: 25px;">
          <h3 style="font-size: 16px; font-weight: 800; color: #065f46; margin-bottom: 20px; border-bottom: 1px solid #dcfce7; padding-bottom: 10px; letter-spacing: -0.025em;">Payment Information</h3>
          {pd_rows}
        </div>
            '''

    penalty_summary = ""
    if penalty > 0:
        penalty_summary = f'''
                    <div class="summary-row" style="border-top: 1px solid #f3f4f6; margin-top: 4px; padding-top: 4px;">
                      <span style="color: #dc2626;">Late Penalties</span>
                      <span style="color: #dc2626; font-weight: 800;">+{_fmt_currency(penalty)}</span>
                    </div>
        '''

    payment_instructions_html = ""
    if status != 'paid':
        payment_instructions_html = f'''
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-family: 'Inter', sans-serif;">
                  <h3 style="font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 12px;">Payment Instructions</h3>
                  
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="padding-bottom: 12px; border-bottom: 1px solid #f3f4f6;">
                      <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Bank Transfer</div>
                      <div style="font-size: 13px; color: #4b5563; line-height: 1.6; font-weight: 400;">
                        <div style="margin-bottom: 4px;">Account Name: Estate Link Management</div>
                        <div style="margin-bottom: 4px;">Account Number: 1234567890</div>
                        <div style="margin-bottom: 8px;">Bank: ABC Bank Ltd.</div>
                        <div style="color: #9ca3af; font-size: 12px; margin-top: 8px;">
                          Please include invoice #{bill_number} as reference
                        </div>
                      </div>
                    </div>

                    <div style="padding-bottom: 12px; border-bottom: 1px solid #f3f4f6;">
                      <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Mobile Financial Service (MFS)</div>
                      <div style="font-size: 13px; color: #4b5563; font-weight: 400;">
                        <div style="margin-bottom: 8px;">bKash/Nagad/Rocket: 01712-345678</div>
                        <div style="color: #9ca3af; font-size: 12px;">
                          Send payment and share transaction ID via email
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Cash Payment</div>
                      <div style="font-size: 13px; color: #4b5563; font-weight: 400;">
                        <div>Visit the management office during business hours</div>
                        <div style="color: #9ca3af; margin-top: 4px;">Mon-Fri: 9:00 AM - 5:00 PM</div>
                      </div>
                    </div>
                  </div>
                </div>
        '''

    return f'''<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice - {bill_number}</title>
    <style>
      @font-face {{
        font-family: 'BengaliFont';
        src: url('file:///{font_path}');
      }}
      @font-face {{
        font-family: 'NotoSans';
        src: url('file:///{en_font_path}');
      }}
      @page {{ margin: 0; size: A4; }}
      body {{ 
        font-family: 'NotoSans', 'BengaliFont', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        color: #1f2937; margin: 0; padding: 0; background: white; line-height: 1.4; font-size: 12px;
      }}
      .invoice-container {{ width: 100%; max-width: 1000px; margin: 0 auto; background: white; padding-bottom: 20mm; }}
      .header {{ 
        background: #0d9488; color: white; padding: 30px; 
        display: flex; justify-content: space-between; align-items: flex-start;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; margin-bottom: 20px;
      }}
      .company-info h1 {{ margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }}
      .company-info p {{ margin: 2px 0 0; opacity: 0.9; font-size: 13px; }}
      .invoice-card {{ 
        background: white; color: #0d9488; padding: 10px 18px; border-radius: 10px; 
        text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 8px;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }}
      .billing-section {{ padding: 0 30px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f3f4f6; padding-bottom: 15px; }}
      .label-small {{ font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
      .status-badge {{ 
        display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 10px; margin-top: 6px;
        text-transform: uppercase; letter-spacing: 0.05em; text-align: center; line-height: 1; vertical-align: baseline;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }}
      .content-area {{ padding: 0 30px 10px; margin-top: 15px; }}
      .breakdown-title {{ display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 15px 0 8px; }}
      .summary-section {{ margin-top: 15px; border-top: 2px solid #e5e7eb; padding-top: 12px; }}
      .summary-row {{ display: flex; justify-content: space-between; padding: 1px 0; font-size: 12px; }}
      .total-row {{ 
        display: flex; justify-content: space-between; align-items: center; 
        margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;
      }}
      .footer {{ margin-top: 15px; padding: 15px 30px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 10px; color: #6b7280; }}
      @media print {{
        body {{ background: white; }}
        .header {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
        .status-badge {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
        .invoice-card {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
      }}
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="header">
        <div>
          <h1>Estate Link</h1>
          <p>Property Management Services</p>
          <div style="margin-top: 12px; font-size: 11px; opacity: 0.9; line-height: 1.5;">
            123 Property Lane, Dhaka 1212, Bangladesh<br>
            Phone: +880 1234-567890 | Email: billing@estatelink.com
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <div class="invoice-card">
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; opacity: 0.7;">Invoice</div>
            <div style="font-size: 16px; font-weight: 800;">{bill_number}</div>
          </div>
          <div style="text-align: right; font-size: 11px; opacity: 0.9;">
            Invoice Date: {_fmt_date(invoice_date)}<br>
            Due Date: {_fmt_date(due_date)}
          </div>
        </div>
      </div>

      <div class="billing-section">
        <div>
          <div class="label-small">BILL TO</div>
          <div style="font-size: 15px; font-weight: 700; color: #111827;">
            {resident_name}
            <span style="font-size: 10px; font-weight: normal; color: #6b7280; margin-left: 5px; text-transform: uppercase; letter-spacing: 0.05em;">
              {holder_type}
            </span>
          </div>
          <div style="font-size: 13px; color: #374151; margin-top: 2px;">{unit_display}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 1px;">{email}</div>
        </div>
        <div style="text-align: right;">
          <div class="label-small">Billing Period</div>
          <div style="font-size: 16px; font-weight: 700; color: #111827;">{period}</div>
          <div class="status-badge" style="background: {s_bg}; color: {s_fg};">
            {status_text}
          </div>
        </div>
      </div>

      <div class="content-area">
        <div class="breakdown-title">
          Service Fee Breakdown
        </div>
        <div style="border-top: 1px solid #f3f4f6;">
          {item_rows_html}
          {penalty_html}
        </div>
        
        {penalty_note_html}

        <div class="summary-section">
          <div class="summary-row" style="font-weight: 600;">
            <span style="color: #6b7280; font-weight: 400;">Base Service Fee</span>
            <span style="color: #111827;">{_fmt_currency(base_fee)}</span>
          </div>
          <div class="summary-row" style="font-weight: 600;">
            <span style="color: #6b7280; font-weight: 400;">Additional Charges</span>
            <span style="color: #111827;">{_fmt_currency(additional)}</span>
          </div>
          {penalty_summary}
          
          <div class="summary-row" style="border-top: 1px solid #f3f4f6; margin-top: 8px; padding-top: 8px; font-weight: 700;">
            <span style="color: #374151;">Total Bill Amount</span>
            <span style="color: #111827;">{_fmt_currency(total_due)}</span>
          </div>

          <div class="summary-row" style="background: #f0fdfa; margin: 8px -10px; padding: 12px 20px; border-radius: 12px; border: 1px solid #ccfbf1; font-weight: 800; display: flex; align-items: center; justify-content: space-between; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <span style="color: #134e4a; font-size: 15px; letter-spacing: -0.01em;">Total Amount Due</span>
            <span style="color: #0d9488; font-size: 20px;">{_fmt_currency(total_due)}</span>
          </div>
        </div>

        {payment_info_html}
        {payment_instructions_html}
      </div>

      <div class="footer">
        <p style="margin-bottom: 6px;">Questions about this invoice? Contact us at <strong>billing@estatelink.com</strong> or call <strong>+880 1234-567890</strong></p>
        <p style="margin-bottom: 2px;">This is a computer-generated invoice. No signature required.</p>
        <p style="font-weight: 800; color: #374151;">Estate Link Property Management | Tax ID: 123456789 | Registration No: ABC-12345</p>
      </div>
    </div>
  </body>
</html>'''


# ─── Bill PDF Generator ──────────────────────────────────────────────


def generate_bill_detail_pdf(bill_data):
    """
    Generate PDF from bill data using Playwright (fallback to WeasyPrint).
    """
    from service_fee_management.utils.pdf_generation_playwright import generate_pdf_from_html
    html_content = generate_bill_detail_html(bill_data)
    return generate_pdf_from_html(html_content)


# ─── Single Bill Email Sender ────────────────────────────────────────

def send_bill_detail_email(bill_data, resident_email):
    """
    Send a single bill detail email with PDF attachment.
    
    Args:
        bill_data: dict with all bill fields
        recipient_email: email address to send to
        
    Returns:
        bool: True if sent successfully
    """
    logger.info(f"[BillEmail] Attempting to send email to {resident_email} for bill {bill_data.get('bill_number')}")
    print(f"[BillEmail] 📧 Attempting to send email to {resident_email} for bill {bill_data.get('bill_number')}")
    try:
        bill_number = bill_data.get('bill_number', 'BILL')
        month = bill_data.get('service_period_month')
        year = bill_data.get('service_period_year')
        period = f"{_get_month_name(month)} {year}" if month and year else 'Bill'
        
        subject = f"Service Fee Invoice - {period} | {bill_number} | Estate Link"
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@estatelink.com')
        
        resident_name = bill_data.get('owner_name') or bill_data.get('resident_name') or 'Resident'
        
        # Calculate total due correctly (Base + Additional + Penalty - Waived)
        base_fee = safe_float(bill_data.get('base_service_amount') or bill_data.get('service_fee_amount') or 0)
        additional = safe_float(bill_data.get('additional_bill_charges') or 0)
        penalty = safe_float(bill_data.get('penalty_amount') or 0)
        waived = safe_float(bill_data.get('waived_amount') or 0)
        
        # Ground truth: Priority is the total amount stored in the DB
        total_due = safe_float(bill_data.get('total_amount') or 0)
        
        # Fallback to sum only if total_amount is somehow missing
        if total_due <= 0:
            total_due = base_fee + additional + penalty - waived
        
        # Also get balance for helpfulness if there's a partial payment
        paid = safe_float(bill_data.get('total_paid') or 0)
        remaining = max(0, total_due - paid)
        
        due_date_str = _fmt_date(bill_data.get('due_date'))
        
        # Always show Total Amount Due per user request
        amount_label = "Total Amount Due"
        display_amount = total_due

        # Simple HTML email body (the PDF has the full invoice)
        email_body = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #374151; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 12px;">
            <div style="background: #0d9488; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 20px;">Estate Link</h2>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 12px;">Property Management Services</p>
            </div>
            
            <p>Dear <strong>{resident_name}</strong>,</p>
            
            <p>Your service fee invoice for <strong>{period}</strong> has been generated.</p>
            
            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <table width="100%" style="font-size: 14px;">
                <tr>
                  <td style="color: #6b7280;">Invoice Number:</td>
                  <td style="font-weight: 700; text-align: right;">{bill_number}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280;">{amount_label}:</td>
                  <td style="font-weight: 800; color: #0d9488; text-align: right; font-size: 18px;">{_fmt_currency(display_amount, use_tk=True)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280;">Due Date:</td>
                  <td style="font-weight: 700; text-align: right;">{due_date_str}</td>
                </tr>
              </table>
            </div>
            
            <p>Please find the <strong>detailed invoice PDF attached</strong> to this email.</p>
            
            <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="font-size: 11px; color: #9CA3AF; text-align: center;">
              This is an automated message from Estate Link. Please do not reply.<br>
              Questions? Contact billing@estatelink.com or call +880 1234-567890
            </p>
          </div>
        </body>
        </html>
        """
        
        email = EmailMessage(
            subject=subject,
            body=email_body,
            from_email=from_email,
            to=[resident_email],
        )
        email.content_subtype = "html"
        
        # Generate and attach PDF
        pdf_content = generate_bill_detail_pdf(bill_data)
        if pdf_content:
            filename = f"Invoice_{bill_number}.pdf"
            email.attach(filename, pdf_content, "application/pdf")
            logger.info(f"Bill PDF attached: {filename} ({len(pdf_content)} bytes)")
        
        email.send(fail_silently=False)
        logger.info(f"Bill email sent to {resident_email} for {bill_number}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send bill email to {resident_email}: {e}", exc_info=True)
        print(f"  ❌ [BillEmail] Error sending to {resident_email}: {e}")
        return False


# ─── Bulk Bill Email Sender with Threading ───────────────────────────

def send_bulk_bill_emails(bill_list, max_workers=5):
    """
    Send bill emails to multiple owners in parallel using ThreadPoolExecutor.
    
    Args:
        bill_list: list of dicts, each with:
            - bill_data: dict with bill information
            - resident_email: email address
        max_workers: number of parallel threads (default 5)
        
    Returns:
        dict: { 'sent': int, 'failed': int, 'errors': list }
    """
    if not bill_list:
        logger.info("[BulkBillEmail] No bills to send")
        return {'sent': 0, 'failed': 0, 'errors': []}
    
    print(f"\n{'='*80}")
    print(f"[BulkBillEmail] Starting bulk send: {len(bill_list)} bills, {max_workers} workers")
    print(f"{'='*80}\n")
    
    sent = 0
    failed = 0
    errors = []
    
    def _send_one(item):
        """Worker function for each thread."""
        # Close stale DB connections
        for conn in connections.all():
            conn.close_if_unusable_or_obsolete()
        
        bd = item['bill_data']
        email = item['resident_email']
        bill_no = bd.get('bill_number', 'UNKNOWN')
        
        try:
            result = send_bill_detail_email(bd, email)
            if result:
                print(f"  ✅ Sent: {bill_no} → {email}")
                return True
            else:
                print(f"  ❌ Failed: {bill_no} → {email}")
                return False
        except Exception as e:
            print(f"  ❌ Error: {bill_no} → {email}: {e}")
            return str(e)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_send_one, item): item for item in bill_list}
        
        for future in as_completed(futures):
            item = futures[future]
            try:
                result = future.result()
                if result is True:
                    sent += 1
                else:
                    failed += 1
                    if isinstance(result, str):
                        errors.append({
                            'bill': item['bill_data'].get('bill_number'),
                            'email': item['resident_email'],
                            'error': result
                        })
            except Exception as e:
                failed += 1
                errors.append({
                    'bill': item['bill_data'].get('bill_number'),
                    'email': item['resident_email'],
                    'error': str(e)
                })
    
    print(f"\n{'='*80}")
    print(f"[BulkBillEmail] Complete: {sent} sent, {failed} failed")
    print(f"{'='*80}\n")
    
    logger.info(f"[BulkBillEmail] Complete: {sent} sent, {failed} failed out of {len(bill_list)}")
    return {'sent': sent, 'failed': failed, 'errors': errors}


# ─── Background Bill Email Trigger ───────────────────────────────────

def trigger_bill_emails_for_generated_bills(payment_ids):
    """
    Trigger bulk bill emails in a background thread for newly generated bills.
    Uses the same SQL query as BillingDetailedListView API for 100% data parity.
    Called after generate_service_fees() completes.
    
    Args:
        payment_ids: list of ServiceFeePayment IDs
    """
    if not payment_ids:
        return
    
    def _background_send():
        """Background worker that fetches bill data and sends emails."""
        try:
            # Close stale connections from parent thread
            for conn in connections.all():
                conn.close_if_unusable_or_obsolete()
            
            # Fetch bill data using same query as BillingDetailedListView API
            bills = fetch_bill_data_for_email(payment_ids)
            
            if not bills:
                logger.info("[BillEmail] No bill data found for email sending")
                print("[BillEmail] ⚠️ No bill data found for email sending")
                return
            
            print(f"[BillEmail] 📂 Processing {len(bills)} bills for email dispatch...")
            
            bill_list = []
            for bill_data in bills:
                # Get recipient email - prioritize owner email, fallback to unit emails
                email = bill_data.get('owner_email') or bill_data.get('primary_email')
                
                if not email or not str(email).strip():
                    logger.warning(f"No valid email for bill {bill_data.get('bill_number')}, skipping")
                    print(f"  ⚠️ [BillEmail] No valid email for bill {bill_data.get('bill_number')}")
                    continue
                
                email = str(email).strip()
                
                bill_list.append({
                    'bill_data': bill_data,
                    'resident_email': email,
                })
            
            if bill_list:
                send_bulk_bill_emails(bill_list, max_workers=5)
            else:
                logger.info("[BillEmail] No emails to send (no valid recipients)")
                
        except Exception as e:
            logger.error(f"[BillEmail] Background send failed: {e}", exc_info=True)
            print(f"[BillEmail] ❌ Background send failed: {e}")
    
    # Start in a background thread
    thread = threading.Thread(target=_background_send, name="BillEmailSender")
    thread.daemon = False
    thread.start()
    logger.info(f"[BillEmail] Background email thread started for {len(payment_ids)} bills")
    print(f"[BillEmail] 📧 Background email thread started for {len(payment_ids)} bills")
