"""
Utility function for generating service fees
Can be used by both API views and scheduled tasks
"""
import logging
import uuid
import random
from datetime import datetime, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from django.db import connection, transaction, DatabaseError
from django.db.models import Max
import re
from django.utils import timezone
from ..models import ServiceFeeGenerate, ServiceFeePayment, ServiceFeeBilling, ServiceFeePaymentLatePenaltyTier, ServiceFeeGenerationConfig
from service_fee.models import LatePenaltyTier
from .owner_helper import get_unit_owner_info_bulk, get_primary_contract_owner
from .item_helper import create_generation_items
from audit_trail.create_audit_trail import create_audit_trail

logger = logging.getLogger(__name__)







def generate_service_fees(
    year,
    month,
    unit_ids=None,
    tower_id=None,
    service_fee_ids=None,
    bill_category_ids=None,
    force_regenerate=False,
    created_by=None
):
    """
    Generate service fee records for active service fees and units with primary contract holders
    
    IMPORTANT BUSINESS RULES:
    - Only ONE bill per unit per service fee per period
    - Bill goes to the PRIMARY CONTRACT HOLDER (Owner or Resident)
    - Priority: Owner first, then Resident if no owner exists
    - Both owner AND resident can pay the same bill
    - All payments reduce the same bill amount
    - No separate bills for residents - they are "under" the owner
    
    Args:
        year: Service period year (e.g., 2025)
        month: Service period month (1-12)
        unit_ids: Optional comma-separated string of unit IDs (e.g., "1,2,3") or list
        tower_id: Optional tower ID to filter by
        service_fee_id: Optional service fee ID to filter by
        force_regenerate: If True, deletes existing records and regenerates
    
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'created_count': int,
            'regenerated_count': int,
            'skipped_count': int,
            'created_records': list,
            'regenerated_records': list,
            'skipped_records': list,
            'error': str (if failed)
        }
    """
    try:
        # Validate month and year
        try:
            year = int(year)
            month = int(month)
            if month < 1 or month > 12:
                raise ValueError("Month must be between 1 and 12")
        except (ValueError, TypeError) as e:
            return {
                'success': False,
                'error': f'Invalid year or month: {str(e)}',
                'created_count': 0,
                'regenerated_count': 0,
                'skipped_count': 0,
                'created_records': [],
                'regenerated_records': [],
                'skipped_records': []
            }
        
        # Note: Due date will be calculated per service fee based on due_day
        # We removed the hardcoded due_date calculation from here
        
        # Prepare lists for bulk operations and tracking
        payments_to_create = []
        payments_to_update = []
        payments_to_delete = []
        created_payments = []
        processed_payments = []
        created_records = []
        regenerated_records = []
        skipped_records = []
        
        # Audit trail tracking lists
        deleted_payments_for_audit = []
        updated_payments_for_audit = []
        created_payments_for_audit = []
        
        skipped_count = 0
        
        # Parse unit_ids early for validation
        unit_ids_list = []
        if unit_ids:
            if isinstance(unit_ids, str):
                unit_ids_list = [int(uid.strip()) for uid in unit_ids.split(',') if uid.strip().isdigit()]
            elif isinstance(unit_ids, (list, tuple)):
                unit_ids_list = [int(uid) for uid in unit_ids if str(uid).isdigit()]
        
        # Parse service_fee_ids early
        fee_ids_list = []
        if service_fee_ids:
            if isinstance(service_fee_ids, str):
                fee_ids_list = [int(fid.strip()) for fid in service_fee_ids.split(',') if fid.strip().isdigit()]
            elif isinstance(service_fee_ids, (list, tuple)):
                fee_ids_list = [int(fid) for fid in service_fee_ids if str(fid).isdigit()]

        # Build query to get active service fees and units with owners
        query = """
             SELECT DISTINCT
                sf.id AS service_fee_id,
                sf.fee_amount,
                sf.currency,
                sf.frequency,
                sf.due_day,
                u.id AS unit_id,
                u.unit_name,
                t.id AS tower_id,
                t.tower_name,
                f.id AS floor_id,
                f.floor_no,
                u.primary_name,
                u.primary_email,
                u.primary_number,
                m.full_name AS member_name,
                m.general_email AS member_email,
                m.general_contact AS member_phone,
                sfp.id AS payment_id,
                sfp.service_period_year,
                sfp.service_period_month,
                sfp.id,
                su.is_active,
                sf.late_payment_enabled,
                sf.billing_cycle,
                sf.accepts_cash,
                sf.accepts_mfs,
                sf.accepts_bank,
                sf.reminder_before_days,
                sf.reminder_after_days,
                
                /* Calculate Days Overdue */
                GREATEST(0, DATEDIFF(
                    CURRENT_DATE(), 
                    DATE(CONCAT(%s, '-', LPAD(%s, 2, '0'), '-', LPAD(COALESCE(sf.due_day, 5), 2, '0')))
                )) AS days_overdue,
                
                /* Find Matching Penalty Tier based on Days Overdue */
                COALESCE(lpt_matched.penalty_percentage, 0) AS penalty_percentage,
                COALESCE(lpt_matched.tier_id, NULL) AS matched_tier_id,
                
                /* Primary Contract Holder Logic - Prioritize Owner, then Resident (only ONE per unit) */
                CASE 
                    WHEN tow.id IS NOT NULL THEN 'owner'
                    WHEN tr.id IS NOT NULL THEN 'resident'
                    ELSE NULL
                END as account_holder_type,
                COALESCE(tow.id, tr.id) as account_holder_id,
                COALESCE(tow.member_id, tr.member_id) as account_holder_member_id,
                tow.id AS owner_record_id,
                
                /* Priority for deduplication (owner=1, resident=2) */
                CASE 
                    WHEN tow.id IS NOT NULL THEN 1
                    WHEN tr.id IS NOT NULL THEN 2
                    ELSE 3
                END as holder_priority,

                /* Calculate Penalty Amount using Matched Tier */
                ROUND(
                    CASE 
                        WHEN sf.late_payment_enabled = 1 
                         AND CURRENT_DATE() > DATE(CONCAT(%s, '-', LPAD(%s, 2, '0'), '-', LPAD(COALESCE(sf.due_day, 5), 2, '0'))) 
                         AND lpt_matched.penalty_percentage IS NOT NULL THEN 
                           CAST(sf.fee_amount AS DECIMAL(10,2)) * lpt_matched.penalty_percentage / 100
                        ELSE 0 
                    END
                , 0) AS gross_penalty_amount

                FROM service_fee_servicefee sf
                INNER JOIN service_fee_servicefee_towers sft ON sf.id = sft.servicefee_id
                INNER JOIN service_fee_servicefee_units su ON sf.id = su.servicefee_id
                INNER JOIN towers_unit u ON u.id = su.unit_id
                INNER JOIN towers_floor f ON u.floor_id = f.id
                INNER JOIN towers_tower t ON f.tower_id = t.id
                
                /* Joins for Optimal Account Holder - Strict Match on Unit Primary Contact Details */
                LEFT JOIN user_member m ON (
                    (u.primary_email IS NOT NULL AND u.primary_email <> '' AND m.general_email = u.primary_email) OR 
                    (u.primary_number IS NOT NULL AND u.primary_number <> '' AND m.general_contact = u.primary_number) OR 
                    (u.primary_name IS NOT NULL AND u.primary_name <> '' AND m.full_name = u.primary_name)
                )

                /* Owner JOIN - Primary contract holder (preferred) */
                LEFT JOIN (
                    SELECT unit_id, member_id, id
                    FROM (
                        SELECT unit_id, member_id, id, ROW_NUMBER() OVER(PARTITION BY unit_id ORDER BY ownership_percentage DESC, id DESC) as rn
                        FROM towers_owner
                    ) t WHERE rn = 1
                ) tow ON tow.unit_id = u.id AND tow.member_id = m.id

                /* Resident JOIN - Fallback if no owner exists */
                LEFT JOIN (
                    SELECT unit_id, member_id, id
                    FROM (
                        SELECT unit_id, member_id, id, ROW_NUMBER() OVER(PARTITION BY unit_id ORDER BY id DESC) as rn
                        FROM towers_resident
                        WHERE is_active = 1
                    ) t WHERE rn = 1
                ) tr ON tr.unit_id = u.id AND tr.member_id = m.id AND tow.id IS NULL

                /* Match Penalty Tier based on Days Overdue with Fallback */
                LEFT JOIN (
                    SELECT 
                        lpt.service_fee_id,
                        lpt.id AS tier_id,
                        lpt.penalty_percentage,
                        lpt.days_overdue,
                        lpt.order
                    FROM service_fee_latepenaltytier lpt
                    INNER JOIN (
                        SELECT 
                            service_fee_id,
                            MAX(days_overdue) AS max_applicable_days
                        FROM service_fee_latepenaltytier
                        WHERE days_overdue <= GREATEST(0, DATEDIFF(
                            CURRENT_DATE(), 
                            DATE(CONCAT(%s, '-', LPAD(%s, 2, '0'), '-', LPAD(COALESCE(
                                (SELECT due_day FROM service_fee_servicefee WHERE id = service_fee_latepenaltytier.service_fee_id LIMIT 1), 
                                5
                            ), 2, '0')))
                        ))
                        GROUP BY service_fee_id
                    ) max_tier ON lpt.service_fee_id = max_tier.service_fee_id 
                              AND lpt.days_overdue = max_tier.max_applicable_days
                    
                    UNION ALL
                    
                    /* Fallback: If no tier matches (days < minimum tier), use LOWEST tier */
                    SELECT 
                        lpt2.service_fee_id,
                        lpt2.id AS tier_id,
                        lpt2.penalty_percentage,
                        lpt2.days_overdue,
                        lpt2.order
                    FROM service_fee_latepenaltytier lpt2
                    INNER JOIN (
                        SELECT 
                            service_fee_id,
                            MIN(days_overdue) AS min_days
                        FROM service_fee_latepenaltytier
                        GROUP BY service_fee_id
                    ) lowest_tier ON lpt2.service_fee_id = lowest_tier.service_fee_id 
                                   AND lpt2.days_overdue = lowest_tier.min_days
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM service_fee_latepenaltytier lpt3
                        WHERE lpt3.service_fee_id = lpt2.service_fee_id
                          AND lpt3.days_overdue <= GREATEST(0, DATEDIFF(
                              CURRENT_DATE(), 
                              DATE(CONCAT(%s, '-', LPAD(%s, 2, '0'), '-', LPAD(COALESCE(
                                  (SELECT due_day FROM service_fee_servicefee WHERE id = lpt2.service_fee_id LIMIT 1), 
                                  5
                              ), 2, '0')))
                          ))
                    )
                    AND GREATEST(0, DATEDIFF(
                        CURRENT_DATE(), 
                        DATE(CONCAT(%s, '-', LPAD(%s, 2, '0'), '-', LPAD(COALESCE(
                            (SELECT due_day FROM service_fee_servicefee WHERE id = lpt2.service_fee_id LIMIT 1), 
                            5
                        ), 2, '0')))
                    )) > 0  /* Only apply fallback if actually overdue */
                    
                    LIMIT 1
                ) lpt_matched ON lpt_matched.service_fee_id = sf.id

                LEFT JOIN bill_upload_details bud
                    ON bud.service_fee_id = sf.id
                    AND bud.unit_id = u.id
                    AND bud.upload_year = %s
                    AND bud.upload_month = %s
                LEFT JOIN bill_uploads bu
                    ON bu.id = bud.bill_upload_id
                LEFT JOIN bill_category bc 
                   ON bc.id = bu.bill_category_id
                   
                LEFT JOIN service_fee_management_servicefeegenerate sfp 
                ON  sfp.unit_id = u.id
                    AND sfp.service_period_year = %s
                    AND sfp.service_period_month = %s
			
                WHERE
                sf.is_active = 1   
                AND u.unit_status<>'no_owner'
                AND su.is_active = 1
                /* Filter: Must have at least one Primary Contract Holder (Owner or Resident) */
                AND (tow.id IS NOT NULL OR tr.id IS NOT NULL)
        """
        
        # Params: [
        #   days_overdue_year, days_overdue_month,      # For DATEDIFF in days_overdue calculation
        #   penalty_calc_year, penalty_calc_month,      # For CASE in gross_penalty_amount
        #   tier_match_year, tier_match_month,          # For penalty tier matching subquery
        #   fallback_check_year, fallback_check_month,  # For fallback NOT EXISTS check
        #   fallback_apply_year, fallback_apply_month,  # For fallback overdue check
        #   bud_year, bud_month,                         # For bill_upload_details join
        #   sfp_year, sfp_month                          # For servicefeegenerate join
        # ]
        params = [year, month, year, month, year, month, year, month, year, month, year, month, year, month]
        
        # Only filter out existing payments if NOT force regenerating
        if not force_regenerate:
            query += " AND sfp.id IS NULL"
        
        # Service fee must be active (created) BEFORE OR ON the service period date
        query += """
            AND DATE(sf.service_fee_date) <= %s
        """
        from calendar import monthrange
        last_day = monthrange(year, month)[1]
        service_period_date = f"{year:04d}-{month:02d}-{last_day:02d}"
        params.append(service_period_date)

        # Parse bill_category_ids if provided as string before using in query
        if bill_category_ids and isinstance(bill_category_ids, str):
            bill_category_ids = [int(x.strip()) for x in bill_category_ids.split(',') if x.strip().isdigit()]

        # Handle multiple service_fee_ids
        if fee_ids_list:
            placeholders = ','.join(['%s'] * len(fee_ids_list))
            query += f" AND sf.id IN ({placeholders})"
            params.extend(fee_ids_list)

        # Handle multiple unit_ids
        if unit_ids_list:
            placeholders = ','.join(['%s'] * len(unit_ids_list))
            query += f" AND u.id IN ({placeholders})"
            params.extend(unit_ids_list)

        if tower_id:
            query += " AND t.id = %s"
            params.append(tower_id)

        # Order by priority to ensure owner comes before resident for same unit
        query += " ORDER BY u.id, sf.id, holder_priority, t.tower_name, f.floor_no, u.unit_name"
        # print(query)
        # print(params)
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            columns = [col[0] for col in cursor.description]
            raw_records = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Deduplicate: Keep only ONE record per (unit_id, service_fee_id) - prioritize owner over resident
        seen_keys = set()
        eligible_records = []
        for record in raw_records:
            key = (record['unit_id'], record['service_fee_id'])
            if key not in seen_keys:
                seen_keys.add(key)
                eligible_records.append(record)

        logger.info(f"[ServiceFeeGeneration] After deduplication: {len(eligible_records)} unique unit-fee combinations")

        # Validation: Identify requested units that are NOT eligible/found
        if unit_ids_list:
            found_unit_ids = set(rec['unit_id'] for rec in eligible_records)
            missing_ids = set(unit_ids_list) - found_unit_ids
            
            if missing_ids:
                from towers.models import Unit
                from service_fee.models import ServiceFee
                for uid in missing_ids:
                    try:
                        unit = Unit.objects.get(id=uid)
                        reason = "Unit ineligible for generation"
                        
                        if unit.unit_status == 'no_owner':
                            reason = f"Unit '{unit.unit_name}' is marked as 'No Owner'. Please assign an owner first."
                        elif not unit.primary_name or not unit.primary_email or not unit.primary_number:
                            reason = f"Unit '{unit.unit_name}' is missing mandatory contact information (Name, Email, or Phone)."
                        elif not unit.owner_set.exists() and not unit.resident_set.filter(is_active=1).exists():
                            reason = f"Unit '{unit.unit_name}' has no registered owner or active resident (Primary Contract required)."
                        else:
                            # Check if assignment to service fee exists
                            assignment_exists = False
                            if fee_ids_list:
                                fees = ServiceFee.objects.filter(id__in=fee_ids_list)
                                for fee in fees:
                                    if fee.units.filter(id=uid).exists():
                                        if not fee.is_active:
                                            reason = f"Service fee '{fee}' is inactive."
                                        else:
                                            # Check if already generated
                                            exists = ServiceFeePayment.objects.filter(
                                                unit_id=uid, service_fee_id=fee.id,
                                                service_period_year=year, service_period_month=month
                                            ).exists()
                                            if exists and not force_regenerate:
                                                reason = f"Bill already generated for {month}/{year}. Use force_regenerate to recreate."
                                            else:
                                                reason = f"Unit '{unit.unit_name}' does not meet starting date criteria for '{fee}'."
                                        assignment_exists = True
                                        break
                            
                            if not assignment_exists:
                                reason = f"Unit '{unit.unit_name}' is not assigned to the selected service fee(s)."

                        skipped_records.append({
                            'tower_name': getattr(unit.floor.tower, 'tower_name', 'Unknown'),
                            'unit_name': unit.unit_name,
                            'fee_label': 'N/A',
                            'reason': reason
                        })
                        skipped_count += 1
                        logger.info(f"[ServiceFeeGeneration] Missing Unit {uid}: {reason}")
                    except Unit.DoesNotExist:
                        skipped_records.append({
                            'tower_name': 'N/A',
                            'unit_name': f'ID: {uid}',
                            'fee_label': 'N/A',
                            'reason': 'Unit ID not found in database.'
                        })
                        skipped_count += 1

        # If absolutely no records and no specific skips were caught yet, do a quick check
        if not eligible_records and not skipped_records:
            diag_message = 'No active service fees found for the selected period and criteria.'
            return {
                'success': False,
                'error': diag_message,
                'message': diag_message,
                'created_count': 0,
                'regenerated_count': 0,
                'skipped_count': 0,
                'created_records': [],
                'regenerated_records': [],
                'skipped_records': []
            }
        
        logger.info(f"[ServiceFeeGeneration] Eligible records found: {len(eligible_records)}")
        
        # Get owner information for all units (bulk operation to avoid N+1)
        unit_ids_for_owner_lookup = list(set(rec['unit_id'] for rec in eligible_records))
        owner_info_map = get_unit_owner_info_bulk(unit_ids_for_owner_lookup)
        logger.info(f"[OwnerInfo] Retrieved owner info for {len(owner_info_map)} units")
        
        # Pre-fetch matching BillUploadDetail for all eligible units to avoid N+1 queries
        unit_bill_totals = {}
        if eligible_records:
            from ..models import BillUploadDetail
            relevant_units = [rec['unit_id'] for rec in eligible_records]
            relevant_fees = [rec['service_fee_id'] for rec in eligible_records]
            
            detail_qs = BillUploadDetail.objects.filter(
                unit_id__in=relevant_units,
                service_fee_id__in=relevant_fees,
                upload_month=month,
                upload_year=year,
                bill_upload__isnull=False,
                bill_upload__bill_category__isnull=False
            )
            
            if bill_category_ids:
                detail_qs = detail_qs.filter(bill_upload__bill_category_id__in=bill_category_ids)
                
            for detail in detail_qs:
                key = (detail.unit_id, detail.service_fee_id)
                unit_bill_totals[key] = unit_bill_totals.get(key, 0) + float(detail.amount)
        
        # Prepare bulk lists
        # Prepare remaining bulk lists
        # NEW: Track auto-applied advances for billing record creation
        auto_applied_advances_tracking = {} # (unit_id, month, year, sf_id) -> amount
        

        # Pre-fetch all penalty tiers for involved service fees
        fee_penalty_data = {}
        unique_fee_ids = set(record['service_fee_id'] for record in eligible_records)
        for fee_id in unique_fee_ids:
            tiers = LatePenaltyTier.objects.filter(service_fee_id=fee_id).order_by('order', 'days_overdue')
            fee_penalty_data[fee_id] = [
                {
                    'days_overdue': t.days_overdue, 
                    'penalty_percentage': t.penalty_percentage, 
                    'order': t.order,
                    'tier_name': t.tier_name if hasattr(t, 'tier_name') else f'{t.days_overdue} Day Tier',
                    'penalty_calculation_basis': t.penalty_calculation_basis if hasattr(t, 'penalty_calculation_basis') else 'base_amount'
                }
                for t in tiers
            ]

        # Prepare records for bulk creation or regeneration
        # Prepare for sequential bill_number generation
        bill_prefix = f"BILL-{year}-{month:02d}-"
        last_bill = ServiceFeePayment.objects.filter(bill_number__startswith=bill_prefix).aggregate(Max('bill_number'))['bill_number__max']
        current_bill_seq = 1
        if last_bill:
            match = re.search(r'-(\d+)$', last_bill)
            if match:
                try:
                    current_bill_seq = int(match.group(1)) + 1
                except:
                    current_bill_seq = 1
        
        # Track used numbers to avoid immediate collisions
        used_bill_numbers = set()

        for record in eligible_records:
            fee_label = f"{record['currency']} {record['fee_amount']} ({record['frequency']})"
            
            # Get owner info for this unit
            owner_info = owner_info_map.get(record['unit_id'])
            
            # If no owner, use account holder info (could be resident)
            if not owner_info and record.get('account_holder_id'):
                owner_info = {
                    'owner_id': record['owner_record_id'],
                    'member_id': record['account_holder_member_id'],
                    'owner_name': record.get('member_name') or record.get('primary_name') or 'Unknown',
                    'owner_email': record.get('member_email') or record.get('primary_email') or '',
                    'owner_phone': record.get('member_phone') or record.get('primary_number') or ''
                }
            
            if not owner_info:
                logger.warning(f"Skipping unit {record['unit_name']} - no primary contract holder available")
                skipped_records.append({
                    'tower_name': record['tower_name'],
                    'unit_name': record['unit_name'],
                    'fee_label': fee_label,
                    'reason': 'No primary contract holder (Owner or Resident) available for this unit.'
                })
                skipped_count += 1
                continue
            
            # Check for primary contact information (Name and Email)
            final_name = record.get('primary_name') or record.get('member_name')
            final_email = record.get('primary_email') or record.get('member_email')
            
            if not final_name or not final_email:
                logger.warning(f"Skipping unit {record['unit_name']} - missing primary contact name or email")
                skipped_records.append({
                    'tower_name': record['tower_name'],
                    'unit_name': record['unit_name'],
                    'fee_label': fee_label,
                    'reason': 'Primary contact information (Name and Email) is required to generate a bill.'
                })
                skipped_count += 1
                continue
            
            # Calculate due_date based on the service fee's due_day setting
            due_day = record['due_day'] if record['due_day'] else 5  # Default to 5th if not set
            try:
                from datetime import date as date_class
                due_date = date_class(year, month, due_day)
            except ValueError:
                # If due_day is invalid for this month (e.g., 31st in February), use last day of month
                from calendar import monthrange
                from datetime import date as date_class
                last_day = monthrange(year, month)[1]
                due_date = date_class(year, month, min(due_day, last_day))
            
            # Calculate final aggregated amount (Base Fee + Additional Bill Categories)
            base_amount = float(record['fee_amount'])
            additional_amount = round(unit_bill_totals.get((record['unit_id'], record['service_fee_id']), 0))
            final_total_amount = round(base_amount + additional_amount)
            
            auto_applied_advance_amount = Decimal('0.00')
            net_amount_after_advance = float(final_total_amount)

            # Determine initial service status (Paid, Overdue, or Due)
            current_date = timezone.now().date()
            is_newly_paid = (final_total_amount - float(auto_applied_advance_amount)) <= 0
            
            if is_newly_paid:
                calculated_status = 'paid'
            elif current_date > due_date:
                calculated_status = 'overdue'
            else:
                calculated_status = 'due'


            # Check for existing records AND whether they have payment details
            existing_payment = ServiceFeePayment.objects.filter(
                service_period_year=year,
                service_period_month=month,
                unit_id=record['unit_id'],
                service_fee_id=record['service_fee_id']
            ).select_related('unit', 'service_fee').first()

            if existing_payment:
                has_payment_details = existing_payment.billing_records.exists()
                
                # If force_regenerate is true, delete existing records and regenerate
                if force_regenerate:
                    # Decide whether to delete the payment
                    should_delete_payment = True
                    if bill_category_ids:
                         should_delete_payment = False

                    if should_delete_payment:
                        if has_payment_details:
                            existing_payment.billing_records.all().delete()
                        
                        payments_to_delete.append(existing_payment)
                        
                        # Calculate total bill amount including penalty
                        gross_penalty = Decimal(str(record.get('gross_penalty_amount', 0)))
                        total_bill_amount = Decimal(str(final_total_amount)) + gross_penalty
                        
                        # Generate sequential bill_number
                        while True:
                            bill_number = f"{bill_prefix}{str(current_bill_seq).zfill(5)}"
                            if bill_number not in used_bill_numbers:
                                # Final check against DB for complete safety
                                if not ServiceFeePayment.objects.filter(bill_number=bill_number).exists():
                                    used_bill_numbers.add(bill_number)
                                    current_bill_seq += 1
                                    break
                            current_bill_seq += 1

                        payments_to_create.append(
                            ServiceFeePayment(
                                bill_number=bill_number,
                                service_fee_id=record['service_fee_id'],
                                unit_id=record['unit_id'],
                                # Owner fields (NEW)
                                owner_id=owner_info['owner_id'],
                                owner_name=owner_info['owner_name'],
                                owner_email=owner_info['owner_email'],
                                owner_phone=owner_info['owner_phone'],
                                # Deprecated fields
                                resident_id=None,  # DEPRECATED: No longer used
                                account_holder_type=record['account_holder_type'],
                                account_holder_id=record['account_holder_id'],
                                # Service period and amounts
                                service_period_month=month,
                                service_period_year=year,
                                amount=total_bill_amount,  # Includes penalty
                                base_service_amount=base_amount,
                                additional_bill_charges=additional_amount,
                                remaining_amount=max(Decimal('0.00'), total_bill_amount - auto_applied_advance_amount),
                                currency=record['currency'],
                                payment_status='completed' if (total_bill_amount - auto_applied_advance_amount) <= 0 else 'pending',
                                service_status=calculated_status,
                                due_date=due_date,
                                late_penalty_enabled=record.get('late_payment_enabled', False),
                                # Payment tracking fields
                                total_paid=auto_applied_advance_amount,
                                penalty_amount=gross_penalty,  # Initial penalty (if any)
                                waived_amount=Decimal('0.00'),
                                gross_penalty_amount=gross_penalty,
                                created_by_id=created_by
                            )
                        )
                        
                        regenerated_records.append({
                            'tower_name': record['tower_name'],
                            'unit_name': record['unit_name'],
                            'fee_label': fee_label,
                            'fee_amount': str(net_amount_after_advance),
                            'currency': record['currency'],
                            'due_date': due_date.strftime('%Y-%m-%d'),
                            'month_year': f"{datetime(year, month, 1).strftime('%B %Y')}",
                            'status': 'Force Regenerated'
                        })
                        continue
                    else:
                        # Update amounts with advance calculation
                        total_bill_amount = Decimal(str(final_total_amount))
                        existing_payment.base_service_amount = base_amount
                        existing_payment.additional_bill_charges = additional_amount
                        existing_payment.amount = total_bill_amount
                        existing_payment.remaining_amount = max(Decimal('0.00'), total_bill_amount - auto_applied_advance_amount)
                        existing_payment.total_paid = auto_applied_advance_amount
                        existing_payment.currency = record['currency']
                        existing_payment.payment_status = 'completed' if (total_bill_amount - auto_applied_advance_amount) <= 0 else 'pending'
                        existing_payment.service_status = calculated_status
                        existing_payment.due_date = due_date
                        existing_payment.late_penalty_enabled = record.get('late_payment_enabled', False)
                        # Update owner info (primary source)
                        existing_payment.owner_id = owner_info['owner_id']
                        existing_payment.owner_name = owner_info['owner_name']
                        existing_payment.owner_email = owner_info['owner_email']
                        existing_payment.owner_phone = owner_info['owner_phone']
                        # Set account holder fields from record (Resident or Owner)
                        existing_payment.account_holder_type = record['account_holder_type']
                        existing_payment.account_holder_id = record['account_holder_id']
                        if created_by:
                            existing_payment.created_by_id = created_by
                            existing_payment.updated_by_id = created_by
                        existing_payment.resident_id = None  # DEPRECATED - no longer used
                        # Ensure bill_number exists
                        if not existing_payment.bill_number:
                            short_uuid = str(uuid.uuid4()).replace('-', '').upper()[:5]
                            existing_payment.bill_number = f"BILL-{year}-{month:02d}-{short_uuid}"

                        payments_to_update.append(existing_payment)
                        
                        regenerated_records.append({
                            'tower_name': record['tower_name'],
                            'unit_name': record['unit_name'],
                            'fee_label': fee_label,
                            'fee_amount': str(net_amount_after_advance),
                            'currency': record['currency'],
                            'due_date': due_date.strftime('%Y-%m-%d'),
                            'month_year': f"{datetime(year, month, 1).strftime('%B %Y')}",
                            'status': 'Regenerated (Partial)'
                        })
                        continue
                
                # If payment details exist, skip
                if has_payment_details:
                    skipped_records.append({
                        'tower_name': record['tower_name'],
                        'unit_name': record['unit_name'],
                        'fee_label': fee_label,
                        'reason': 'Already has payment transactions'
                    })
                    skipped_count += 1
                    continue
                
                # If payment details were deleted, regenerate
                existing_payment.base_service_amount = base_amount
                existing_payment.additional_bill_charges = additional_amount
                existing_payment.amount = final_total_amount
                existing_payment.remaining_amount = final_total_amount
                existing_payment.currency = record['currency']
                existing_payment.payment_status = 'pending'
                existing_payment.service_status = calculated_status
                existing_payment.due_date = due_date
                existing_payment.late_penalty_enabled = record.get('late_payment_enabled', False)
                # Update owner info (primary source)
                existing_payment.owner_id = owner_info['owner_id']
                existing_payment.owner_name = owner_info['owner_name']
                existing_payment.owner_email = owner_info['owner_email']
                existing_payment.owner_phone = owner_info['owner_phone']
                # Set account holder fields from record (Resident or Owner)
                existing_payment.account_holder_type = record['account_holder_type']
                existing_payment.account_holder_id = record['account_holder_id']
                if created_by:
                    existing_payment.created_by_id = created_by
                    existing_payment.updated_by_id = created_by
                existing_payment.resident_id = None  # DEPRECATED - no longer used
                
                # Ensure bill_number exists
                if not existing_payment.bill_number:
                    while True:
                        bill_number = f"{bill_prefix}{str(current_bill_seq).zfill(5)}"
                        if bill_number not in used_bill_numbers:
                            if not ServiceFeePayment.objects.filter(bill_number=bill_number).exists():
                                used_bill_numbers.add(bill_number)
                                existing_payment.bill_number = bill_number
                                current_bill_seq += 1
                                break
                        current_bill_seq += 1

                payments_to_update.append(existing_payment)
                
                regenerated_records.append({
                    'tower_name': record['tower_name'],
                    'unit_name': record['unit_name'],
                    'fee_label': fee_label,
                    'fee_amount': str(final_total_amount),
                    'currency': record['currency'],
                    'due_date': due_date.strftime('%Y-%m-%d'),
                    'month_year': f"{datetime(year, month, 1).strftime('%B %Y')}",
                    'status': 'Regenerated'
                })
                continue
            
            # Calculate total bill amount including penalty
            gross_penalty = Decimal(str(record.get('gross_penalty_amount', 0)))
            total_bill_amount = Decimal(str(final_total_amount)) + gross_penalty
            
            # Generate sequential bill_number
            while True:
                bill_number = f"{bill_prefix}{str(current_bill_seq).zfill(5)}"
                if bill_number not in used_bill_numbers:
                    # Final check against DB for complete safety
                    if not ServiceFeePayment.objects.filter(bill_number=bill_number).exists():
                        used_bill_numbers.add(bill_number)
                        current_bill_seq += 1
                        break
                current_bill_seq += 1

            # Add to bulk creation list (new record)
            payments_to_create.append(
                ServiceFeePayment(
                    bill_number=bill_number,
                    service_fee_id=record['service_fee_id'],
                    unit_id=record['unit_id'],
                    # Owner fields (NEW)
                    owner_id=owner_info['owner_id'],
                    owner_name=owner_info['owner_name'],
                    owner_email=owner_info['owner_email'],
                    owner_phone=owner_info['owner_phone'],
                    # Deprecated fields
                    resident_id=None,  # DEPRECATED: No longer used
                    account_holder_type=record['account_holder_type'],
                    account_holder_id=record['account_holder_id'],
                    # Service period and amounts
                    service_period_month=month,
                    service_period_year=year,
                    amount=total_bill_amount,  # Includes penalty
                    base_service_amount=base_amount,
                    additional_bill_charges=additional_amount,
                    remaining_amount=max(Decimal('0.00'), total_bill_amount - auto_applied_advance_amount),
                    currency=record['currency'],
                    payment_status='completed' if (total_bill_amount - auto_applied_advance_amount) <= 0 else 'pending',
                    service_status=calculated_status,
                    due_date=due_date,
                    late_penalty_enabled=record.get('late_payment_enabled', False),
                    # Payment tracking fields
                    total_paid=auto_applied_advance_amount,
                    penalty_amount=gross_penalty,  # Initial penalty (if any)
                    waived_amount=Decimal('0.00'),
                    gross_penalty_amount=gross_penalty,
                    created_by_id=created_by
                )
            )
            
            created_records.append({
                'tower_name': record['tower_name'],
                'unit_name': record['unit_name'],
                'fee_label': fee_label,
                'fee_amount': str(net_amount_after_advance),
                'currency': record['currency'],
                'due_date': due_date.strftime('%Y-%m-%d'),
                'month_year': f"{datetime(year, month, 1).strftime('%B %Y')}"
            })
        
        # Bulk operations within atomic transaction
        created_count = 0
        regenerated_count = 0
        deleted_count = 0
        
        try:
            with transaction.atomic():
                # Ensure generation configs exist before creating payments
                logger.info("[ServiceFeeGeneration] Ensuring generation configs...")
                generation_configs_map = {}
                unique_sf_ids_pre = set(record['service_fee_id'] for record in eligible_records)

                for sf_id_pre in unique_sf_ids_pre:
                    sample_record_pre = next((r for r in eligible_records if r['service_fee_id'] == sf_id_pre), None)
                    if sample_record_pre:
                        config_pre, created_pre = ServiceFeeGenerationConfig.objects.update_or_create(
                            service_fee_id=sf_id_pre,
                            year=year,
                            month=month,
                            defaults={
                                'fee_amount': sample_record_pre['fee_amount'],
                                'currency': sample_record_pre['currency'],
                                'frequency': sample_record_pre['frequency'],
                                'billing_cycle': sample_record_pre['billing_cycle'],
                                'due_day': sample_record_pre['due_day'],
                                'accepts_cash': sample_record_pre['accepts_cash'],
                                'accepts_mfs': sample_record_pre['accepts_mfs'],
                                'accepts_bank': sample_record_pre['accepts_bank'],
                                'reminder_before_days': sample_record_pre['reminder_before_days'],
                                'reminder_after_days': sample_record_pre['reminder_after_days']
                            }
                        )
                        generation_configs_map[sf_id_pre] = config_pre
                        logger.info(f"✅ {'Created' if created_pre else 'Updated'} ServiceFeeGenerationConfig ID={config_pre.id} for SF={sf_id_pre}, {year}-{month:02d}")
                
                # Step 0: "Two table update" for Units - Sync unit contact from matched account holder if unit fields are empty
                # This ensures u.primary_name/email/number match the actual member in charge.
                logger.info("[ServiceFeeGeneration] Running unit contact sync (two table update)...")
                unit_ids_to_sync = [rec['unit_id'] for rec in eligible_records]
                if unit_ids_to_sync:
                    # Sync only empty fields to avoid overwriting manual overrides, 
                    # OR overwrite if user wants exact match. Given "two table update" logic, 
                    # we'll prioritize Member data for consistency.
                    from towers.models import Unit
                    from django.db.models import Case, When, Value, F
                    
                    # Group eligible records by unit for sync
                    units_data = {rec['unit_id']: rec for rec in eligible_records}
                    
                    # Perform bulk update for unit contact fields
                    # Using a direct SQL update for efficiency or bulk_update
                    with connection.cursor() as cursor:
                        # Swapped priority matched member sync
                        cursor.execute("""
                            UPDATE towers_unit u
                            INNER JOIN (
                                SELECT 
                                    u_i.id as unit_id,
                                    m_i.full_name,
                                    m_i.general_email,
                                    m_i.general_contact
                                FROM towers_unit u_i
                                LEFT JOIN (
                                    SELECT unit_id, member_id, ROW_NUMBER() OVER(PARTITION BY unit_id ORDER BY ownership_percentage DESC, id DESC) as rn
                                    FROM towers_owner
                                ) tow_i ON tow_i.unit_id = u_i.id AND tow_i.rn = 1
                                LEFT JOIN (
                                    SELECT unit_id, member_id, ROW_NUMBER() OVER(PARTITION BY unit_id ORDER BY id DESC) as rn
                                    FROM towers_resident
                                    WHERE is_active = 1
                                ) tr_i ON tr_i.unit_id = u_i.id AND tr_i.rn = 1
                                INNER JOIN user_member m_i ON m_i.id = COALESCE(tow_i.member_id, tr_i.member_id)
                                WHERE u_i.id IN %s
                            ) info ON u.id = info.unit_id
                            SET 
                                u.primary_name = info.full_name,
                                u.primary_email = info.general_email,
                                u.primary_number = info.general_contact
                        """, [tuple(unit_ids_to_sync)])

                missing_configs = [sf_id for sf_id in unique_sf_ids_pre if sf_id not in generation_configs_map]
                if missing_configs:
                    raise ValueError(f"Generation configs missing for service fee IDs: {missing_configs}")

                # Step 1: Delete old payments if force_regenerate is enabled
                if payments_to_delete:
                    deleted_ids = [p.id for p in payments_to_delete]
                    # Store data for audit trail (will be created after transaction commits)
                    deleted_payments_for_audit = [
                        {
                            'id': payment.id,
                            'unit_id': payment.unit_id,
                            'service_fee_id': payment.service_fee_id,
                            'service_period_month': payment.service_period_month,
                            'service_period_year': payment.service_period_year,
                            'amount': str(payment.amount),
                            'remaining_amount': str(payment.remaining_amount),
                            'service_status': payment.service_status,
                            'payment_status': payment.payment_status,
                            'due_date': str(payment.due_date),
                            'created_at': str(payment.created_at)
                        }
                        for payment in payments_to_delete
                    ]
                    
                    ServiceFeePayment.objects.filter(id__in=deleted_ids).delete()
                    deleted_count = len(deleted_ids)
                else:
                    deleted_payments_for_audit = []
                
                # Step 2: Update regenerated payments (without deletion)
                if payments_to_update:
                    updated_payments_for_audit = []
                    # Pre-fetch old versions to avoid N+1 queries during audit collection
                    old_versions_map = {
                        p.id: p for p in ServiceFeePayment.objects.filter(
                            id__in=[p.id for p in payments_to_update]
                        )
                    }
                    
                    for payment in payments_to_update:
                        old_version = old_versions_map.get(payment.id)
                        if old_version:
                            updated_payments_for_audit.append({
                                'payment_id': payment.id,
                                'unit_id': payment.unit_id,
                                'service_period_month': payment.service_period_month,
                                'service_period_year': payment.service_period_year,
                                'old_data': {
                                    'amount': str(old_version.amount),
                                    'remaining_amount': str(old_version.remaining_amount),
                                    'total_paid': str(old_version.total_paid),
                                    'service_status': old_version.service_status,
                                    'payment_status': old_version.payment_status,
                                    'due_date': str(old_version.due_date),
                                    'account_holder_type': old_version.account_holder_type,
                                    'account_holder_id': old_version.account_holder_id
                                },
                                'new_data': {
                                    'id': payment.id,
                                    'unit_id': payment.unit_id,
                                    'service_fee_id': payment.service_fee_id,
                                    'service_period_month': payment.service_period_month,
                                    'service_period_year': payment.service_period_year,
                                    'amount': str(payment.amount),
                                    'remaining_amount': str(payment.remaining_amount),
                                    'total_paid': str(payment.total_paid),
                                    'service_status': payment.service_status,
                                    'payment_status': payment.payment_status,
                                    'due_date': str(payment.due_date),
                                    'account_holder_type': payment.account_holder_type,
                                    'account_holder_id': payment.account_holder_id
                                }
                            })
                    
                    ServiceFeePayment.objects.bulk_update(
                        payments_to_update,
                        ['bill_number', 'amount', 'remaining_amount', 'total_paid', 'currency', 'payment_status', 'service_status', 'due_date', 'late_penalty_enabled', 'account_holder_type', 'account_holder_id', 'resident', 'owner_id', 'owner_name', 'owner_email', 'owner_phone', 'created_by', 'updated_by'],
                        batch_size=500
                    )
                    regenerated_count += len(payments_to_update)
                else:
                    updated_payments_for_audit = []
                
                # Pre-populate processed_payments with updated entities for Tier Snapshotting later
                processed_payments = list(payments_to_update)
                
                # Step 3: Create new payments
                if payments_to_create:
                    # Set generation_config on new payments from pre-created configs
                    for payment_obj in payments_to_create:
                        gen_config = generation_configs_map.get(payment_obj.service_fee_id)
                        if not gen_config:
                            raise ValueError(f"Missing generation config for service fee {payment_obj.service_fee_id}")
                        payment_obj.generation_config = gen_config
                    
                    created_payments = ServiceFeePayment.objects.bulk_create(
                        payments_to_create,
                        batch_size=500
                    )
                    created_count = len(created_payments)
                    
                    # If force_regenerate, count as regenerated instead of created
                    if force_regenerate and deleted_count > 0:
                        regenerated_count += created_count
                        created_count = 0
                    
                    # Add IDs to records (pre-fetch them since bulk_create might not return IDs)
                    relevant_unit_ids = [rec['unit_id'] for rec in eligible_records]
                    relevant_service_fee_ids = [rec['service_fee_id'] for rec in eligible_records]
                    
                    # Query payments within same transaction to get the newly created ones
                    newly_created_payments = list(ServiceFeePayment.objects.filter(
                        service_period_year=year,
                        service_period_month=month,
                        unit_id__in=relevant_unit_ids,
                        service_fee_id__in=relevant_service_fee_ids
                    ).exclude(id__in=[p.id for p in payments_to_update]).prefetch_related('billing_records'))
                    
                    processed_payments.extend(newly_created_payments)
                    
                    # Store data for audit trail (now that we have IDs)
                    created_payments_for_audit = [
                        {
                            'payment_id': payment.id,
                            'unit_id': payment.unit_id,
                            'service_fee_id': payment.service_fee_id,
                            'service_period_month': payment.service_period_month,
                            'service_period_year': payment.service_period_year,
                            'amount': str(payment.amount),
                            'new_data': {
                                'id': payment.id,
                                'unit_id': payment.unit_id,
                                'service_fee_id': payment.service_fee_id,
                                'service_period_month': payment.service_period_month,
                                'service_period_year': payment.service_period_year,
                                'amount': str(payment.amount),
                                'remaining_amount': str(payment.remaining_amount),
                                'total_paid': str(payment.total_paid),
                                'currency': payment.currency,
                                'service_status': payment.service_status,
                                'payment_status': payment.payment_status,
                                'due_date': str(payment.due_date),
                                'base_service_amount': str(payment.base_service_amount),
                                'additional_bill_charges': str(payment.additional_bill_charges),
                                'account_holder_type': payment.account_holder_type,
                                'account_holder_id': payment.account_holder_id
                            }
                        }
                        for payment in newly_created_payments
                        if payment.id in [p.id for p in created_payments if p.id] or not (created_payments and created_payments[0].id)
                    ]
                    # Note: On MySQL, bulk_create often doesn't return IDs. 
                    # If ids are missing, we treat all fetched processed_payments as candidates 
                    # for the 'created' audit trail if they weren't in the 'updated' list.
                
                # Step 4: Snapshot Penalty Tiers and link generation configs
                print(f"[ServiceFeeGeneration] Step 4: Found {len(processed_payments)} payments for tier snapshot")
                
                if processed_payments:
                    # Snapshot Penalty Tiers
                    snapshot_tiers_to_create = []
                    payment_ids_for_snapshot = [p.id for p in processed_payments]
                    
                    # Clear existing penalty tier snapshots for these payments
                    deleted_tiers = ServiceFeePaymentLatePenaltyTier.objects.filter(
                        payment_id__in=payment_ids_for_snapshot
                    ).delete()
                    print(f"[ServiceFeeGeneration] Deleted {deleted_tiers[0]} existing penalty tier snapshots")
                    
                    # Use pre-created generation configs
                    generation_configs = generation_configs_map
                    
                    # Link payments to their generation config and snapshot penalty tiers
                    payments_to_update_config = []
                    for p in processed_payments:
                        # Link to generation config
                        gen_config = generation_configs.get(p.service_fee_id)
                        if not gen_config:
                            raise ValueError(f"Missing generation config for service fee {p.service_fee_id} during post-processing")
                        if p.generation_config_id != gen_config.id:
                            p.generation_config = gen_config
                            payments_to_update_config.append(p)
                        
                        # Snapshot Penalty Tiers (save ALL tiers at generation time)
                        # ONLY if late_payment_enabled is True for this payment
                        print(f"\n[PenaltyTier Debug] Payment {p.id} (Unit {p.unit_id}):")
                        print(f"   Service Fee ID: {p.service_fee_id}")
                        print(f"   Late Payment Enabled: {p.late_penalty_enabled}")
                        
                        # Check if late payment penalties are enabled for this service fee
                        if p.late_penalty_enabled:
                            penalty_tiers = fee_penalty_data.get(p.service_fee_id, [])
                            
                            print(f"   Penalty tiers configured: {len(penalty_tiers)}")
                            if penalty_tiers:
                                print(f"   Tier details: {penalty_tiers}")
                            else:
                                print(f"   ⚠️  NO PENALTY TIERS FOUND for this service fee!")
                            
                            # Calculate if payment is already overdue at generation time
                            from datetime import date as date_class
                            today = date_class.today()
                            due_date = p.due_date
                            
                            print(f"   Due date: {due_date}")
                            print(f"   Today: {today}")
                            print(f"   Is overdue: {today > due_date}")
                            
                            # Calculate days overdue (do NOT add 1 - timedelta.days gives exact difference)
                            if today > due_date:
                                # Example: Due Jan 1, Today Jan 18 = 17 days overdue
                                days_overdue = (today - due_date).days
                                
                                print(f"   Days overdue: {days_overdue}")
                                
                                # Threshold-based tier activation logic:
                                # Sort tiers in DESCENDING order of days_overdue
                                # Pick the first tier where days_overdue >= tier.days_overdue
                                
                                active_tier_days = None
                                
                                # Sort tiers descending (highest days first)
                                sorted_tiers = sorted(penalty_tiers, key=lambda x: x['days_overdue'], reverse=True)
                                
                                print(f"   Sorted tiers (descending): {[t['days_overdue'] for t in sorted_tiers]}")
                                
                                for t in sorted_tiers:
                                    print(f"   Checking tier: {t['days_overdue']} days")
                                    if days_overdue >= t['days_overdue']:
                                        active_tier_days = t['days_overdue']
                                        print(f"      ✅ MATCHED tier ({days_overdue} >= {t['days_overdue']})")
                                        break
                                    else:
                                        print(f"      ❌ Skipped tier ({days_overdue} < {t['days_overdue']})")
                                
                                print(f"   FINAL ACTIVE TIER: {active_tier_days}")
                                print(f"[PenaltyTier] Payment {p.id}: Due={due_date}, Today={today}, Days Overdue={days_overdue}, Active Tier={active_tier_days}")
                            else:
                                # Not yet overdue - all tiers inactive
                                days_overdue = 0
                                active_tier_days = None
                                print(f"[PenaltyTier] Payment {p.id}: Due={due_date}, Today={today}, Not overdue yet")
                            
                            for t in penalty_tiers:
                                tier_status = 'active' if t['days_overdue'] == active_tier_days else 'inactive'
                                snapshot_tiers_to_create.append(
                                    ServiceFeePaymentLatePenaltyTier(
                                        payment=p,
                                        days_overdue=t['days_overdue'],
                                        penalty_percentage=t['penalty_percentage'],
                                        order=t['order'],
                                        status=tier_status,
                                        tier_name=t.get('tier_name', f'{t["days_overdue"]} Day Tier'),
                                        penalty_calculation_basis=t.get('penalty_calculation_basis', 'base_amount')
                                    )
                                )
                                print(f"[PenaltyTier] Creating tier: {t['days_overdue']} days = {tier_status}")
                        else:
                            print(f"   ⚠️  Late payment penalties are DISABLED for this service fee - skipping tier snapshot")
                    
                    # Bulk update payments with generation_config FK
                    if payments_to_update_config:
                        updated_count = ServiceFeePayment.objects.bulk_update(
                            payments_to_update_config, 
                            ['generation_config'], 
                            batch_size=500
                        )
                        print(f"[ServiceFeeGeneration] Updated {len(payments_to_update_config)} payments with generation_config")
                    
                    if snapshot_tiers_to_create:
                        created_tiers = ServiceFeePaymentLatePenaltyTier.objects.bulk_create(
                            snapshot_tiers_to_create, 
                            batch_size=500
                        )
                        print(f"[ServiceFeeGeneration] Created {len(created_tiers)} penalty tier snapshots")
                        
                        # Verify tiers were created
                        tier_count = ServiceFeePaymentLatePenaltyTier.objects.filter(
                            payment_id__in=payment_ids_for_snapshot
                        ).count()
                        print(f"[ServiceFeeGeneration] Verification: {tier_count} tiers in database")
                        
                        if tier_count != len(created_tiers):
                            raise ValueError(f"Tier creation mismatch: created {len(created_tiers)} but found {tier_count} in DB")
        
                # Build penalty map from eligible_records
                penalty_map = {}
                if eligible_records:
                    for rec in eligible_records:
                        key = (rec['unit_id'], rec['service_fee_id'])
                        penalty_map[key] = float(rec.get('gross_penalty_amount', 0))

                # Step 5: Create generation-time service fee items (INDEPENDENT from ServiceFeeBillCategory)
                # Fetch fresh payments from DB (don't rely on transaction-scoped variables)
                processed_payments = ServiceFeePayment.objects.filter(
                    service_period_year=year,
                    service_period_month=month
                )
                
                # Apply same filters as generation
                unit_ids_list = []
                if unit_ids:
                    if isinstance(unit_ids, str):
                        unit_ids_list = [int(uid.strip()) for uid in unit_ids.split(',') if uid.strip().isdigit()]
                    elif isinstance(unit_ids, (list, tuple)):
                        unit_ids_list = [int(uid) for uid in unit_ids if str(uid).isdigit()]
                
                service_fee_ids_list = []
                if service_fee_ids:
                    if isinstance(service_fee_ids, str):
                        service_fee_ids_list = [int(fid.strip()) for fid in service_fee_ids.split(',') if fid.strip().isdigit()]
                    elif isinstance(service_fee_ids, (list, tuple)):
                        service_fee_ids_list = [int(fid) for fid in service_fee_ids if str(fid).isdigit()]
                
                if unit_ids_list:
                    processed_payments = processed_payments.filter(unit_id__in=unit_ids_list)
                if service_fee_ids_list:
                    processed_payments = processed_payments.filter(service_fee_id__in=service_fee_ids_list)

                print(f"[ServiceFeeGeneration] Step 5: Processing {processed_payments.count()} payments for item generation")
                
                if processed_payments:
                    print(f"[ServiceFeeGeneration] Creating generation-time items for {len(processed_payments)} payments...")
                    
                    try:
                        from ..models import BillUploadDetail
                        
                        for payment in processed_payments:
                            try:
                                # Get bill category breakdown DIRECTLY from BillUploadDetail
                                # This makes ServiceFeeItem independent from any intermediate tables
                                unit_bill_amounts = {}
                                detail_ids_map = {}  # Map category_id -> bill_upload_detail_id
                                
                                # Fetch bill upload details regardless of additional_bill_charges
                                # The additional_bill_charges field might not be populated correctly
                                details = BillUploadDetail.objects.filter(
                                    unit_id=payment.unit_id,
                                    service_fee_id=payment.service_fee_id,
                                    upload_month=payment.service_period_month,
                                    upload_year=payment.service_period_year,
                                    bill_upload__isnull=False,
                                    bill_upload__bill_category__isnull=False
                                ).select_related('bill_upload', 'bill_upload__bill_category')
                                
                                # Filter by bill_category_ids if provided
                                if bill_category_ids:
                                    details = details.filter(bill_upload__bill_category_id__in=bill_category_ids)
                                
                                for detail in details:
                                    category_id = detail.bill_upload.bill_category_id
                                    
                                    # Aggregate amounts per category
                                    if category_id not in unit_bill_amounts:
                                        unit_bill_amounts[category_id] = 0
                                        # Store bill_upload_detail_id for this category (first detail wins if multiple)
                                        detail_ids_map[category_id] = detail.id
                                    unit_bill_amounts[category_id] += float(detail.amount)
                                
                                # Calculate penalty from ACTIVE penalty tier snapshot
                                # DO NOT use eligible_records - it contains stale SQL query data
                                # Instead, query the ServiceFeePaymentLatePenaltyTier table for the active tier
                                penalty_percentage = 0
                                active_penalty_tier = None
                                active_tier_snapshot = None  # Must be initialized here (used in both branches)
                                
                                # Get active penalty tier snapshot for this payment
                                if payment.late_penalty_enabled:
                                    active_tier_snapshot = ServiceFeePaymentLatePenaltyTier.objects.filter(
                                        payment=payment,
                                        status='active'
                                    ).first()
                                    
                                    if active_tier_snapshot:
                                        penalty_percentage = float(active_tier_snapshot.penalty_percentage)
                                        active_penalty_tier = active_tier_snapshot
                                        print(f"[Penalty] Found active tier: {active_tier_snapshot.days_overdue} days = {penalty_percentage}%")
                                    else:
                                        print(f"[Penalty] No active tier found for payment {payment.id}")
                                
                                # Calculate penalty on base amount only
                                base_amount = float(payment.base_service_amount) if payment.base_service_amount else 0
                                
                                print(f"[Penalty] Payment {payment.id}: Base={base_amount}")
                                print(f"[Penalty] Penalty %={penalty_percentage}, Late enabled={payment.late_penalty_enabled}")
                                
                                # Check if generation is late (after due date)
                                due_day = payment.service_fee.due_day if payment.service_fee.due_day else 5
                                from datetime import date as date_class
                                due_date = date_class(payment.service_period_year, payment.service_period_month, due_day)
                                is_late = date_class.today() > due_date
                                
                                print(f"[Penalty] Due date={due_date}, Today={date_class.today()}, Is late={is_late}")
                                
                                if payment.late_penalty_enabled and is_late and penalty_percentage > 0:
                                    penalty_amount = round(base_amount * penalty_percentage / 100, 0)
                                    print(f"[Penalty] Calculated penalty: {base_amount} * {penalty_percentage}% = {penalty_amount}")
                                    
                                    # CRITICAL: Update payment.amount to include the recalculated penalty
                                    # This ensures voucher debit/credit balance is correct
                                    new_total_amount = base_amount + float(payment.additional_bill_charges or 0) + penalty_amount
                                    payment.amount = Decimal(str(new_total_amount))
                                    payment.penalty_amount = Decimal(str(penalty_amount))
                                    payment.gross_penalty_amount = Decimal(str(penalty_amount))
                                    payment.remaining_amount = Decimal(str(new_total_amount)) - Decimal(str(payment.total_paid or 0))
                                    if created_by:
                                        payment.updated_by_id = created_by
                                    payment.save(update_fields=['amount', 'penalty_amount', 'gross_penalty_amount', 'remaining_amount', 'updated_by'])
                                    print(f"[Penalty] Updated payment.amount: {payment.amount} (base={base_amount} + penalty={penalty_amount})")
                                else:
                                    # This is CRITICAL: We only clear if there is NO active tier (even with fallback)
                                    # If Step 4 found a fallback tier, it will be marked 'active' in the DB
                                    # and active_tier_snapshot will be found above.
                                    penalty_amount = 0
                                    new_total_amount = base_amount + float(payment.additional_bill_charges or 0)
                                    
                                    # Only clear if we are NOT actually overdue or no tiers exist at all
                                    if not is_late or not ServiceFeePaymentLatePenaltyTier.objects.filter(payment=payment).exists():
                                        if abs(float(payment.amount) - new_total_amount) > 0.01:
                                            print(f"[Penalty] ⚠️ Correcting mismatch: Removing penalty from total. {payment.amount} -> {new_total_amount}")
                                            payment.amount = Decimal(str(new_total_amount))
                                            payment.penalty_amount = Decimal('0')
                                            payment.gross_penalty_amount = Decimal('0')
                                            payment.remaining_amount = Decimal(str(new_total_amount)) - Decimal(str(payment.total_paid or 0))
                                            payment.save(update_fields=['amount', 'penalty_amount', 'gross_penalty_amount', 'remaining_amount'])
                                    
                                    print(f"[Penalty] No penalty applicable: late_enabled={payment.late_penalty_enabled}, is_late={is_late}, tier_matched={active_tier_snapshot is not None}")


                                # ALWAYS create generation items (even if no bill charges)
                                # This ensures base_fee item is created for every payment
                                try:
                                    create_generation_items(payment, unit_bill_amounts, penalty_amount, active_penalty_tier, detail_ids_map)
                                except Exception as item_error:
                                    logger.error(f"Error creating items for payment {payment.id}: {str(item_error)}")
                                    print(f"[ServiceFeeItem] ❌ Error creating items: {str(item_error)}")
                                    # Continue without failing - items can be created/updated later if needed
                                    pass
                            except Exception as payment_error:
                                logger.error(f"Error processing payment {payment.id} for item creation: {str(payment_error)}")
                                print(f"[ServiceFeePayment] ❌ Error: {str(payment_error)}")
                                # Continue to next payment
                                pass
                    except Exception as items_loop_error:
                        logger.error(f"Error in item creation loop: {str(items_loop_error)}")
                        print(f"[ServiceFeeGeneration] ❌ Error in item creation loop: {str(items_loop_error)}")
                        # Continue without failing

                # Final safety: verify generation configs persisted and linked
                try:
                    config_qs = ServiceFeeGenerationConfig.objects.filter(
                        service_fee_id__in=unique_sf_ids_pre,
                        year=year,
                        month=month
                    )
                    print(f"\n🔍 VERIFICATION: Checking generation configs...")
                    print(f"   Expected configs: {len(unique_sf_ids_pre)} for SF IDs: {list(unique_sf_ids_pre)}")
                    print(f"   Found in DB: {config_qs.count()} records")
                    print(f"   Table name: service_fee_management_servicefeegenerationconfig")
                    for cfg in config_qs:
                        print(f"     - Config ID={cfg.id}, SF={cfg.service_fee_id}, Period={cfg.year}-{cfg.month:02d}")
                    
                    if config_qs.count() != len(unique_sf_ids_pre):
                        logger.warning("Generation config verification warning: count mismatch")
                        print(f"   ⚠️  Generation config verification: count mismatch")
                    
                    unlinked = processed_payments.filter(generation_config__isnull=True)
                    print(f"   Payments linked to config: {processed_payments.filter(generation_config__isnull=False).count()}")
                    print(f"   Payments WITHOUT config: {unlinked.count()}")
                    if unlinked.exists():
                        logger.warning(f"Some payments missing generation_config link")
                        print(f"   ⚠️  Some payments missing generation_config link")
                except Exception as verify_error:
                    logger.warning(f"Generation config verification query failed: {str(verify_error)}")
                    print(f"   ⚠️  Verification query failed (non-critical): {str(verify_error)}")
        
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"Error during bulk operations: {str(e)}\n{error_details}")
            if isinstance(e, DatabaseError):
                raise
            return {
                'success': False,
                'error': f'Error during bulk operations: {str(e)}. {error_details[:500]}',
                'created_count': 0,
                'regenerated_count': 0,
                'skipped_count': 0,
                'created_records': [],
                'regenerated_records': [],
                'skipped_records': []
            }
        
        # ============================================================================
        # CREATE AUDIT TRAILS (AFTER transaction commits - now it's safe)
        # ============================================================================
        logger.info("[ServiceFeeGeneration] Creating audit trails for bulk operations...")
        
        # Create audit trails for deleted payments
        if deleted_payments_for_audit:
            logger.info(f"Creating audit trails for {len(deleted_payments_for_audit)} deleted payments...")
            for payment_data in deleted_payments_for_audit:
                try:
                    create_audit_trail(
                        member=None,  # System-generated
                        event_type='PAYMENT_DELETED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=payment_data['id'],
                        old_data=payment_data,
                        new_data=None,
                        description=f'Service fee payment deleted during regeneration - Unit: {payment_data["unit_id"]}, Period: {payment_data["service_period_month"]}/{payment_data["service_period_year"]}, Amount: ৳{payment_data["amount"]}'
                    )
                except Exception as audit_error:
                    logger.warning(f"Failed to create audit trail for deleted payment {payment_data['id']}: {str(audit_error)}")
                    if isinstance(audit_error, DatabaseError):
                        raise
        
        # Create audit trails for updated payments
        if updated_payments_for_audit:
            logger.info(f"Creating audit trails for {len(updated_payments_for_audit)} updated payments...")
            for payment_data in updated_payments_for_audit:
                try:
                    create_audit_trail(
                        member=None,  # System-generated
                        event_type='PAYMENT_UPDATED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=payment_data['payment_id'],
                        old_data=payment_data['old_data'],
                        new_data=payment_data['new_data'],
                        description=f'Service fee payment regenerated - Unit: {payment_data["unit_id"]}, Period: {payment_data["service_period_month"]}/{payment_data["service_period_year"]}, New Amount: ৳{payment_data["new_data"]["amount"]}'
                    )
                except Exception as audit_error:
                    logger.warning(f"Failed to create audit trail for updated payment {payment_data['payment_id']}: {str(audit_error)}")
                    if isinstance(audit_error, DatabaseError):
                        raise
        
        # Create audit trails for created payments
        if created_payments_for_audit:
            logger.info(f"Creating audit trails for {len(created_payments_for_audit)} created payments...")
            for payment_data in created_payments_for_audit:
                try:
                    create_audit_trail(
                        member=None,  # System-generated
                        event_type='PAYMENT_CREATED',
                        table_name='service_fee_management_servicefeegenerate',
                        row_id=payment_data['payment_id'],
                        old_data=None,
                        new_data=payment_data['new_data'],
                        description=f'Service fee payment generated - Unit: {payment_data["unit_id"]}, Period: {payment_data["service_period_month"]}/{payment_data["service_period_year"]}, Amount: ৳{payment_data["amount"]}, Status: {payment_data["new_data"]["service_status"]}'
                    )
                except Exception as audit_error:
                    logger.warning(f"Failed to create audit trail for created payment {payment_data['payment_id']}: {str(audit_error)}")
                    if isinstance(audit_error, DatabaseError):
                        raise
        
        logger.info("[ServiceFeeGeneration] Audit trail creation complete")
        
        # Prepare response message
        message_parts = []
        if created_count > 0:
            message_parts.append(f'{created_count} service fee(s) generated successfully')
        if regenerated_count > 0:
            message_parts.append(f'{regenerated_count} service fee(s) regenerated')
        if skipped_count > 0:
            # Add specific validation errors to message
            validation_errors = [rec for rec in skipped_records if 'owner' in rec.get('reason', '').lower()]
            if validation_errors:
                message_parts.append(f'{skipped_count} record(s) skipped - Missing primary contract owner assignment')
            else:
                message_parts.append(f'{skipped_count} record(s) skipped (already exist or error)')
        
        # ✅ Auto-apply advances for all newly created/updated payments
        # CRITICAL: Must run AFTER transaction commits, so use on_commit()
        # This ensures: bills exist in DB, user doesn't wait, advances applied in background
        try:
            from ..tasks import auto_payment_task
            import threading
            
            all_payment_ids = []
            
            # Method 1: Collect from created_payments list
            if created_payments:
                logger.info(f"[ServiceFeeGeneration] Created payments count: {len(created_payments)}")
                payment_ids_from_created = [p.id for p in created_payments if p.id is not None]
                all_payment_ids.extend(payment_ids_from_created)
                logger.info(f"[ServiceFeeGeneration] IDs from created_payments: {payment_ids_from_created}")
            
            # Method 2: Collect from payments_to_update list
            if payments_to_update:
                logger.info(f"[ServiceFeeGeneration] Updated payments count: {len(payments_to_update)}")
                payment_ids_from_updated = [p.id for p in payments_to_update if p.id is not None]
                all_payment_ids.extend(payment_ids_from_updated)
                logger.info(f"[ServiceFeeGeneration] IDs from payments_to_update: {payment_ids_from_updated}")
            
            # Method 3: Query for payments processed in this period (fallback)
            if not all_payment_ids:
                logger.info(f"[ServiceFeeGeneration] No payments in lists, querying for processed payments...")
                
                # Build query filters matching the request parameters
                query_filters = {
                    'generation_config__year': year,
                    'generation_config__month': month
                }
                
                # Filter by service_fee_ids if specified
                if service_fee_ids:
                    query_filters['generation_config__service_fee_id__in'] = service_fee_ids
                    logger.info(f"[ServiceFeeGeneration] Filtering by service_fee_ids: {service_fee_ids}")
                elif unique_sf_ids_pre:
                    # Fallback to unique_sf_ids_pre if service_fee_ids not specified
                    query_filters['generation_config__service_fee_id__in'] = list(unique_sf_ids_pre)
                
                # Filter by unit_ids if specified (prevents processing all units)
                if unit_ids_list:
                    query_filters['unit_id__in'] = unit_ids_list
                    logger.info(f"[ServiceFeeGeneration] Filtering by {len(unit_ids_list)} specific units: {unit_ids_list}")
                
                # Filter by tower_id if specified
                if tower_id:
                    query_filters['unit__floor__tower_id'] = tower_id
                    logger.info(f"[ServiceFeeGeneration] Filtering by tower_id: {tower_id}")
                
                processed_payments = ServiceFeePayment.objects.filter(
                    **query_filters
                ).values_list('id', flat=True)
                all_payment_ids.extend(processed_payments)
                logger.info(f"[ServiceFeeGeneration] IDs from database query (filtered by request params): {list(processed_payments)}")
            
            
            original_all_payment_ids = list(all_payment_ids)
            logger.info(f"[ServiceFeeGeneration] Total payment IDs collected: {len(original_all_payment_ids)}")
            
            # ✅ CRITICAL OPTIMIZATION: Filter to only process units with available advances
            # This prevents wasting resources on units that don't have any advance payments
            if all_payment_ids:
                from ..models import AdvancePayment
                
                # Get unit IDs for all collected payments
                payments_with_units = ServiceFeePayment.objects.filter(
                    id__in=all_payment_ids
                ).values_list('id', 'unit_id')
                
                payment_to_unit_map = dict(payments_with_units)
                unit_ids_to_check = list(payment_to_unit_map.values())
                
                logger.info(f"[ServiceFeeGeneration] Checking {len(unit_ids_to_check)} units for available advances...")
                
                # Find units that have available or partial advance payments (same as payment_processor / PayStation)
                # Use 'available' and 'partial' - AdvancePayment model has no 'pending'; web and PayStation both create with status='available'
                units_with_advances = AdvancePayment.objects.filter(
                    unit_id__in=unit_ids_to_check,
                    status__in=['available', 'partial']
                ).values_list('unit_id', flat=True).distinct()
                
                units_with_advances_set = set(units_with_advances)
                
                # Filter payment IDs to only include units with available advances
                filtered_payment_ids = [
                    payment_id for payment_id in all_payment_ids
                    if payment_to_unit_map.get(payment_id) in units_with_advances_set
                ]
                
                logger.info(f"[ServiceFeeGeneration] Units with available advances: {len(units_with_advances_set)}")
                logger.info(f"[ServiceFeeGeneration] Filtered payment IDs (with advances): {len(filtered_payment_ids)} out of {len(all_payment_ids)}")
                
                # Replace all_payment_ids with filtered list
                all_payment_ids = filtered_payment_ids

            # Process bills oldest-first so advance is applied to earliest period first (matches user expectation:
            # e.g. 40k advance → Jan gets 40k, Feb gets 0)
            if all_payment_ids:
                payment_periods = ServiceFeePayment.objects.filter(
                    id__in=all_payment_ids
                ).values_list('id', 'service_period_year', 'service_period_month')
                id_to_period = {pid: (y, m) for pid, y, m in payment_periods}
                all_payment_ids = sorted(
                    all_payment_ids,
                    key=lambda pid: id_to_period.get(pid, (9999, 99))
                )
            
            # Schedule background processing AFTER transaction commits
            # This guarantees bills are saved before we try to apply advances
            if all_payment_ids:
                def process_all_advances():
                    """Background worker that applies advances to all generated bills"""
                    print(f"\n{'='*80}")
                    print(f"[BACKGROUND THREAD STARTED] Processing {len(all_payment_ids)} payments")
                    print(f"{'='*80}\n")
                    try:
                        # Close any stale DB connections from parent thread
                        from django.db import connections
                        for conn in connections.all():
                            conn.close_if_unusable_or_obsolete()
                        
                        logger.info(f"[BackgroundAdvance] Starting advance processing for {len(all_payment_ids)} bills")
                        
                        receipt_ids_to_send = []
                        for payment_id in all_payment_ids:
                            if payment_id:
                                try:
                                    logger.info(f"[BackgroundAdvance] Processing payment ID: {payment_id}")
                                    print(f"[BackgroundAdvance] Processing payment ID: {payment_id}")
                                    res = auto_payment_task(int(payment_id))
                                    if res and res.get('success') and res.get('receipt_id'):
                                        receipt_ids_to_send.append(res.get('receipt_id'))
                                except Exception as exc:
                                    logger.error(f"[BackgroundAdvance] Failed for payment {payment_id}: {exc}", exc_info=True)
                                    print(f"[BackgroundAdvance] ERROR for payment {payment_id}: {exc}")
                        
                        logger.info(f"[BackgroundAdvance] ✅ Completed advance processing. Found {len(receipt_ids_to_send)} receipts.")
                        
                        # Trigger Bill Emails (Invoices) for ALL generated bills
                        if original_all_payment_ids:
                            try:
                                from .bill_email_utils import trigger_bill_emails_for_generated_bills
                                logger.info(f"[BackgroundEmail] Triggering bulk invoices for {len(original_all_payment_ids)} bills")
                                trigger_bill_emails_for_generated_bills(original_all_payment_ids)
                            except Exception as be:
                                logger.error(f"[BackgroundEmail] Failed to trigger bill emails: {be}")
                        
                        # Trigger Receipt Emails (for advance adjustments)
                        if receipt_ids_to_send:
                            try:
                                from .email_utils import trigger_bulk_payment_receipt_emails
                                logger.info(f"[BackgroundEmail] Triggering bulk receipts for {len(receipt_ids_to_send)} payments")
                                trigger_bulk_payment_receipt_emails(receipt_ids_to_send)
                            except Exception as re:
                                logger.error(f"[BackgroundEmail] Failed to trigger receipt emails: {re}")

                        logger.info(f"[BackgroundAdvance] ✅ COMPLETED - Processed {len(all_payment_ids)} bills")
                        print(f"\n[BackgroundAdvance] ✅ COMPLETED - Dispatched all emails\n")
                    except Exception as e:
                        logger.error(f"[BackgroundAdvance] Critical error: {e}", exc_info=True)
                        print(f"\n[BackgroundAdvance] ❌ CRITICAL ERROR: {e}\n")
                
                def start_background_thread():
                    """Starts the background thread - called after transaction commits"""
                    print(f"\n{'='*80}")
                    print(f"[TRANSACTION COMMITTED] Now starting background thread...")
                    print(f"{'='*80}\n")
                    background_thread = threading.Thread(target=process_all_advances, name="AdvancePaymentProcessor")
                    background_thread.daemon = False  # Non-daemon ensures completion
                    background_thread.start()
                    logger.info(f"[ServiceFeeGeneration] ✅ Background advance processor started for {len(all_payment_ids)} bills")
                    print(f"[ServiceFeeGeneration] ✅ Background thread started\n")
                
                # Schedule to run AFTER transaction commits
                print(f"\n[ServiceFeeGeneration] Registering on_commit callback for {len(all_payment_ids)} bills...")
                transaction.on_commit(start_background_thread)
                logger.info(f"[ServiceFeeGeneration] ✅ Scheduled background advance processing for {len(all_payment_ids)} bills (will start after commit)")
                print(f"[ServiceFeeGeneration] ✅ Callback registered (will execute after transaction commits)\n")
            else:
                logger.info("[ServiceFeeGeneration] No payment IDs to process")
        except Exception as task_error:
            # Log but don't fail - auto-payment is optional
            logger.warning(f"[ServiceFeeGeneration] Could not schedule background advance processing: {task_error}")
        
        # Create in-app notifications for admins (only if bills were created/regenerated)
        if created_count > 0 or regenerated_count > 0:
            try:
                from notifications.utils import create_service_fee_bills_generated_notification, create_community_member_bill_issued_notification
                
                # Determine tower name if filtering by tower
                tower_name = None
                if tower_id:
                    try:
                        from towers.models import Tower
                        tower = Tower.objects.filter(id=tower_id).first()
                        if tower:
                            tower_name = tower.tower_name
                    except Exception as e:
                        logger.warning(f"[ServiceFeeGeneration] Could not fetch tower name: {e}")
                
                # Total units count
                total_units = created_count + regenerated_count
                
                # Create admin notifications
                logger.info(f"[ServiceFeeGeneration] Creating admin bill generation notifications for {total_units} units...")
                create_service_fee_bills_generated_notification(
                    year=year,
                    month=month,
                    units_count=total_units,
                    tower_name=tower_name,
                    bill_generator_id=created_by
                )
                logger.info(f"[ServiceFeeGeneration] ✅ Admin bill generation notifications created successfully")
                
                # Create community member (owner) notifications for newly created bills
                if created_count > 0:
                    logger.info(f"[ServiceFeeGeneration] Creating community member bill issued notifications for {created_count} new bills...")
                    
                    # Extract specifically the payment IDs newly created in this execution
                    newly_created_payment_ids = [p.get('payment_id') for p in created_payments_for_audit if p.get('payment_id')]
                    
                    if newly_created_payment_ids:
                        newly_created_payments = ServiceFeePayment.objects.filter(
                            id__in=newly_created_payment_ids
                        ).select_related('owner', 'owner__member', 'unit', 'unit__floor__tower')
                    else:
                        newly_created_payments = []
                    
                    community_notif_count = 0
                    for payment in newly_created_payments:
                        try:
                            # Don't send push here - views.py will handle batch push sending
                            result = create_community_member_bill_issued_notification(payment, send_push=False)
                            if result:
                                community_notif_count += 1
                        except Exception as comm_notif_error:
                            logger.warning(f"Could not create community notification for payment {payment.id}: {comm_notif_error}")
                            continue
                    
                    logger.info(f"[ServiceFeeGeneration] ✅ Created {community_notif_count} community member bill issued notifications")
                
            except Exception as notif_error:
                # Log but don't fail - notifications are optional
                logger.warning(f"[ServiceFeeGeneration] Could not create bill generation notifications: {notif_error}")
                import traceback
                logger.warning(traceback.format_exc())
        
        # ── Note: Bill emails are now triggered inside the background thread process_all_advances ──
        # This ensures they happen after voucher creation and advance adjustments are complete.
        
        return {
            'success': True,
            'message': '. '.join(message_parts) if message_parts else 'No records processed',
            'created_count': created_count,
            'regenerated_count': regenerated_count,
            'skipped_count': skipped_count,
            'created_records': created_records[:10],  # Limit to first 10 for response size
            'regenerated_records': regenerated_records[:10],
            'skipped_records': skipped_records[:10],
            'total_created': created_count,
            'total_regenerated': regenerated_count,
            'total_skipped': skipped_count,
            'year': year,
            'month': month,
            'month_name': datetime(year, month, 1).strftime('%B %Y')
        }
        
    except Exception as e:
        import traceback
        logger.error(f"Error generating service fees: {str(e)}\n{traceback.format_exc()}")
        if isinstance(e, DatabaseError):
            raise
        return {
            'success': False,
            'error': f'Error generating service fees: {str(e)}. All changes have been rolled back.',
            'created_count': 0,
            'regenerated_count': 0,
            'skipped_count': 0,
            'created_records': [],
            'regenerated_records': [],
            'skipped_records': []
        }


def generate_all_missing_months(from_month=None, from_year=None, to_month=None, to_year=None, force_regenerate=False, created_by=None):
    """
    Generate service fees for ALL months in a date range.
    If not specified, generates from service start date to current month.
    
    Args:
        from_month: Start month (1-12), defaults to first month of service
        from_year: Start year, defaults to first year of service
        to_month: End month (1-12), defaults to current month
        to_year: End year, defaults to current year
        force_regenerate: If True, deletes existing records and regenerates
    
    Returns:
        dict with total_created, total_regenerated, total_skipped, results_by_month
    """
    try:
        from service_fee.models import ServiceFee
        
        # Get current date
        now = datetime.now()
        current_month = now.month
        current_year = now.year
        
        # If no range specified, use service start to current month
        if not from_month or not from_year:
            # Get earliest service fee date
            earliest_fee = ServiceFee.objects.filter(is_active=True).order_by('service_fee_date').first()
            if earliest_fee:
                from_month = earliest_fee.service_fee_date.month
                from_year = earliest_fee.service_fee_date.year
            else:
                from_month = current_month
                from_year = current_year
        
        if not to_month or not to_year:
            to_month = current_month
            to_year = current_year
        
        # Generate list of all months to process
        months_to_generate = []
        from datetime import date
        start_date = date(from_year, from_month, 1)
        end_date = date(to_year, to_month, 1)
        current_date = start_date
        
        while current_date <= end_date:
            months_to_generate.append((current_date.year, current_date.month))
            current_date += relativedelta(months=1)
        
        print(f"\n[BulkServiceFeeGeneration] Generating {len(months_to_generate)} months:")
        print(f"  From: {from_month}/{from_year} To: {to_month}/{to_year}")
        print(f"  Months: {[f'{m}/{y}' for y, m in months_to_generate]}")
        
        from django.db import transaction
        from service_fee_management.models import ServiceFeePayment
        from service_fee_management.utils.voucher_generator import create_vouchers_for_generated_bills

        # Wrap entire bulk generation in a single transaction for "all-or-nothing" behavior
        with transaction.atomic():
            for year, month in months_to_generate:
                print(f"\n  Generating {month}/{year}...")
                result = generate_service_fees(
                    year=year,
                    month=month,
                    unit_ids=None,
                    tower_id=None,
                    service_fee_ids=None,
                    force_regenerate=force_regenerate,
                    created_by=created_by
                )
                
                if not result['success']:
                    raise Exception(f"Failed to generate bills for {month}/{year}: {result.get('error', 'Unknown error')}")

                # After successful bill generation for this month, create vouchers
                newly_generated_payments = ServiceFeePayment.objects.filter(
                    service_period_year=year,
                    service_period_month=month
                ).select_related(
                    'unit', 'unit__floor', 'unit__floor__tower'
                ).prefetch_related(
                    'items', 'items__bill_category'
                )

                if newly_generated_payments.exists():
                    voucher_result = create_vouchers_for_generated_bills(
                        newly_generated_payments,
                        year,
                        month
                    )
                    if not voucher_result.get('success'):
                        errors = '\n'.join(voucher_result.get('errors', ['Unknown error']))
                        raise Exception(f"Voucher creation failed for {month}/{year}: {errors}")
                
                total_created += result.get('created_count', 0)
                total_regenerated += result.get('regenerated_count', 0)
                total_skipped += result.get('skipped_count', 0)
                results_by_month[f"{month}/{year}"] = result
                
                print(f"    ✅ Created: {result.get('created_count', 0)}, Regenerated: {result.get('regenerated_count', 0)}, Skipped: {result.get('skipped_count', 0)}")
        
        print(f"\n[BulkServiceFeeGeneration] ✅ COMPLETE")
        print(f"  Total Created: {total_created}")
        print(f"  Total Regenerated: {total_regenerated}")
        print(f"  Total Skipped: {total_skipped}")
        
        return {
            'success': True,
            'message': f'Generated service fees for {len(months_to_generate)} months',
            'total_created': total_created,
            'total_regenerated': total_regenerated,
            'total_skipped': total_skipped,
            'months_generated': len(months_to_generate),
            'results_by_month': results_by_month
        }
        
    except Exception as e:
        import traceback
        error_msg = f"Error in bulk generation: {str(e)}\n{traceback.format_exc()}"
        print(f"[BulkServiceFeeGeneration] ❌ {error_msg}")
        return {
            'success': False,
            'error': error_msg,
            'total_created': 0,
            'total_regenerated': 0,
            'total_skipped': 0,
            'months_generated': 0,
            'results_by_month': {}
        }

