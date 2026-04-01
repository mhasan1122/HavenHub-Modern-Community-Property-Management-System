"""
Optimized Django ORM Query Utilities for Service Fee Reminders
================================================================

This module provides efficient database queries for fetching service fee reminders
with all related data using Django ORM with proper select_related() and prefetch_related().

Tables involved:
- service_fee_reminders (Reminder)
- service_fee_reminder_timings (ReminderTiming)
- service_fee_reminder_specific_targets (ReminderSpecificTarget)
- service_fee_reminder_payment_statuses (ReminderPaymentStatus)
- service_fee_reminder_towers (ReminderTower)
- tower_unit (Unit) - for fetching audience email/unit info
"""

from django.db.models import Q, Prefetch
from django.utils import timezone
from datetime import datetime, timedelta
import logging
from django.db import connection

logger = logging.getLogger(__name__)


def get_active_reminders_with_relations(current_time_str=None, last_check_time=None):
    """
    Fetch all active scheduled reminders with optimized joins.
    Filters by current time to match send_times.
    
    Args:
        current_time_str (str): Current time in HH:MM format (e.g., '10:00')
                               If None, uses current time
    
    Returns:
        QuerySet: Optimized queryset with all related data prefetched
    """
    from service_fee_management.models import (
        Reminder, 
        ReminderTiming, 
        ReminderSpecificTarget,
        ReminderPaymentStatus,
        ReminderTower
    )
    
    now = timezone.now()

    # Build list of minute strings to check between last_check_time and now.
    # If last_check_time is provided (datetime or HH:MM string), produce every minute
    # from last_check_time + 1 minute up to now (inclusive). Otherwise fall back
    # to the single minute provided by current_time_str (or now if not provided).
    # 
    # UPDATED: Now checks if current time >= send_time (send reminders when current time equals or exceeds scheduled time)
    time_strs = []
    if last_check_time:
        # Normalize last_check_time to a timezone-aware datetime if possible
        if isinstance(last_check_time, str):
            # Interpret as HH:MM for today if string
            try:
                parsed = datetime.strptime(last_check_time, '%H:%M')
                last_dt = now.replace(hour=parsed.hour, minute=parsed.minute, second=0, microsecond=0)
            except Exception:
                last_dt = now
        else:
            last_dt = last_check_time

        # Ensure both datetimes are floored to minute
        last_dt = last_dt.replace(second=0, microsecond=0)
        cur_dt = now.replace(second=0, microsecond=0)

        t = last_dt + timedelta(minutes=1)
        while t <= cur_dt:
            time_strs.append(t.strftime('%H:%M'))
            t = t + timedelta(minutes=1)

        # If no minutes were generated (last_dt >= now), fall back to current minute
        if not time_strs:
            time_strs = [cur_dt.strftime('%H:%M')]
    else:
        if current_time_str is None:
            current_time_str = now.strftime('%H:%M')
        time_strs = [current_time_str]
    
    logger.info(f"[get_active_reminders] Checking reminders at {current_time_str}")
    
    # Build optimized queryset with prefetch_related for reverse foreign keys
    queryset = Reminder.objects.filter(
        reminder_type='Scheduled',
        status='Active'
    ).prefetch_related(
        # Prefetch timing rules (one-to-many)
        Prefetch(
            'timing_rules',
            queryset=ReminderTiming.objects.all().order_by('timing_type', 'day_offset')
        ),
        # Prefetch specific targets (one-to-many)
        Prefetch(
            'specific_targets',
            queryset=ReminderSpecificTarget.objects.all()
        ),
        # Prefetch payment statuses (one-to-many)
        Prefetch(
            'payment_statuses',
            queryset=ReminderPaymentStatus.objects.all()
        ),
        # Prefetch tower associations with actual tower data (one-to-many with FK)
        Prefetch(
            'reminder_towers',
            queryset=ReminderTower.objects.select_related('tower')
        )
    )
    
    # Filter reminders where current time >= ANY send_time (send reminders at or after scheduled time)
    # This catches reminders that should have been sent at or before current time
    if current_time_str is None:
        current_time_str = now.strftime('%H:%M')
    
    # Use DB-vendor specific JSON handling
    if connection.vendor == 'mysql':
        # Check if ANY time in send_times array is <= current_time_str
        # We'll check each element in the JSON array
        where_clause = """
            (send_times IS NULL OR 
             JSON_LENGTH(send_times) = 0 OR
             EXISTS (
                SELECT 1 FROM JSON_TABLE(
                    send_times,
                    '$[*]' COLUMNS(send_time VARCHAR(5) PATH '$')
                ) AS jt
                WHERE jt.send_time <= %s
             ))
        """
        queryset = queryset.extra(where=[where_clause], params=[current_time_str])
    else:
        # For Postgres: check if any element in array is <= current time
        q = Q(send_times__isnull=True) | Q(send_times=[])
        # Add OR condition for each time in send_times array
        for t in time_strs:
            q |= Q(send_times__contains=[t])
        queryset = queryset.filter(q)
    
    logger.info(f"[get_active_reminders] Found {queryset.count()} reminders with send_time <= {current_time_str}")
    
    return queryset


def get_reminders_by_timing(current_time_str=None, day_offset=None, last_check_time=None):
    """
    Fetch reminders filtered by specific timing criteria.
    
    Args:
        current_time_str (str): Time string in HH:MM format (e.g., '10:00')
        day_offset (int): Day offset for timing rules
    
    Returns:
        QuerySet: Filtered reminders with all relations
    """
    from service_fee_management.models import Reminder
    
    queryset = get_active_reminders_with_relations(current_time_str=current_time_str, last_check_time=last_check_time)
    # Filter by timing if provided
    if day_offset is not None:
        queryset = queryset.filter(timing_rules__day_offset=day_offset)
    
    # Filter by send time if provided
    # Additional filtering by time is handled already by get_active_reminders_with_relations
    
    return queryset.distinct()


def get_reminder_payments_setbased(current_time_str=None, last_check_time=None):
    """
    Set-based worklist that returns grouped payment QuerySets matching active reminders
    scheduled for `current_time_str`.

    Returns a list of dicts with keys:
      - payments_qs: QuerySet of ServiceFeePayment matching the group
      - reminder_ids: list of reminder IDs that share this timing/day_offset
      - timing_ids: list of timing rule IDs
      - timing_type: timing type string
      - day_offset: integer day offset

    This allows the caller to efficiently expand payments and pair with reminders
    without looping every reminder+payment in Python.
    """
    from service_fee_management.models import (
        Reminder, ReminderTiming, ReminderLog, ServiceFeePayment
    )
    from towers.models import Unit

    # Build list of minute strings to check (supports range from last_check_time to now)
    if last_check_time:
        now = timezone.now()
        if isinstance(last_check_time, str):
            try:
                parsed = datetime.strptime(last_check_time, '%H:%M')
                last_dt = now.replace(hour=parsed.hour, minute=parsed.minute, second=0, microsecond=0)
            except Exception:
                last_dt = now
        else:
            last_dt = last_check_time

        last_dt = last_dt.replace(second=0, microsecond=0)
        cur_dt = now.replace(second=0, microsecond=0)

        time_strs = []
        t = last_dt + timedelta(minutes=1)
        while t <= cur_dt:
            time_strs.append(t.strftime('%H:%M'))
            t = t + timedelta(minutes=1)
        if not time_strs:
            time_strs = [cur_dt.strftime('%H:%M')]
    else:
        if current_time_str is None:
            current_time_str = timezone.now().strftime('%H:%M')
        time_strs = [current_time_str]

    today = timezone.now().date()

    # Base reminders active at this time - check if current time >= send_time
    if current_time_str is None:
        current_time_str = timezone.now().strftime('%H:%M')
        
    if connection.vendor == 'mysql':
        # Check if ANY time in send_times array is <= current_time_str
        where_clause = """
            (send_times IS NULL OR 
             JSON_LENGTH(send_times) = 0 OR
             EXISTS (
                SELECT 1 FROM JSON_TABLE(
                    send_times,
                    '$[*]' COLUMNS(send_time VARCHAR(5) PATH '$')
                ) AS jt
                WHERE jt.send_time <= %s
             ))
        """
        base_reminders = Reminder.objects.extra(where=[where_clause], params=[current_time_str]).filter(
            reminder_type='Scheduled', 
            status='Active'
        )
    else:
        q = Q()
        for t in time_strs:
            q |= Q(send_times__contains=[t])
        q = q | Q(send_times__isnull=True) | Q(send_times=[])
        base_reminders = Reminder.objects.filter(reminder_type='Scheduled', status='Active').filter(q)

    results_qs_list = []

    def _build_for_timing(ttype):
        timings_qs = ReminderTiming.objects.filter(reminder__in=base_reminders, timing_type=ttype).select_related('reminder')
        offsets = list(timings_qs.values_list('day_offset', flat=True).distinct())

        for offset in offsets:
            timings_for_offset = timings_qs.filter(day_offset=offset)
            reminder_ids = list(timings_for_offset.values_list('reminder_id', flat=True).distinct())
            timing_ids = list(timings_for_offset.values_list('id', flat=True).distinct())

            if not reminder_ids:
                continue

            # compute target due date for this timing group
            if ttype == 'before_due':
                target_due = today + timedelta(days=offset)
            elif ttype == 'after_due':
                target_due = today - timedelta(days=offset)
            elif ttype == 'on_due':
                target_due = today
            else:
                continue

            payments = ServiceFeePayment.objects.filter(due_date=target_due).select_related('unit', 'unit__floor', 'unit__floor__tower', 'resident')

            # gather targeting filters from reminders in this group (set-based)
            reminders = Reminder.objects.filter(id__in=reminder_ids).prefetch_related('specific_targets', 'reminder_towers', 'payment_statuses')

            unit_q = Q()
            include_all_units = False
            for rem in reminders:
                aud = (rem.audience or '').strip()
                if aud in ('All Towers', 'All Residents'):
                    include_all_units = True
                    break
                if aud == 'Specific Tower':
                    tower_ids = [rt.tower_id for rt in rem.reminder_towers.all()]
                    if tower_ids:
                        unit_q |= Q(unit__floor__tower_id__in=tower_ids)
                if aud == 'Specific Units':
                    unit_ids = [st.target_id for st in rem.specific_targets.all() if st.target_type == 'unit']
                    if unit_ids:
                        unit_q |= Q(unit_id__in=unit_ids)
                if aud == 'Specific Resident':
                    resident_ids = [st.target_id for st in rem.specific_targets.all() if st.target_type == 'resident']
                    if resident_ids:
                        uids = ServiceFeePayment.objects.filter(resident_id__in=resident_ids).values_list('unit_id', flat=True).distinct()
                        unit_q |= Q(unit_id__in=list(uids))

            if not include_all_units:
                payments = payments.filter(unit_q)

            # Build list of send_times used by these reminders (they store send_times as JSON list)
            send_times_set = set()
            for rem in reminders:
                st = getattr(rem, 'send_times', None)
                if isinstance(st, (list, tuple)):
                    for v in st:
                        if v:
                            send_times_set.add(str(v))

            # If no explicit send_times on reminders, fall back to current_time_str
            if not send_times_set:
                send_times_set = {current_time_str}

            # Exclude units already logged for these reminders/timings at any of the reminder send_times
            logs_unit_ids = ReminderLog.objects.filter(
                reminder_id__in=reminder_ids,
                timing_rule_id__in=timing_ids,
                send_time__in=list(send_times_set)
            ).values_list('unit_id', flat=True).distinct()

            if logs_unit_ids:
                payments = payments.exclude(unit_id__in=list(logs_unit_ids))

            payments = payments.distinct()

            if payments.exists():
                results_qs_list.append({
                    'payments_qs': payments,
                    'reminder_ids': reminder_ids,
                    'timing_ids': timing_ids,
                    'timing_type': ttype,
                    'day_offset': offset
                })

    for tt in ('before_due', 'after_due', 'on_due'):
        _build_for_timing(tt)

    # Handle 'specific' timing type (day-of-month)
    specific_timings = ReminderTiming.objects.filter(reminder__in=base_reminders, timing_type='specific').select_related('reminder')
    specific_day = today.day
    specific_timings = specific_timings.filter(day_offset=specific_day)
    if specific_timings.exists():
        reminder_ids = list(specific_timings.values_list('reminder_id', flat=True).distinct())
        timing_ids = list(specific_timings.values_list('id', flat=True).distinct())

        # Build unit queryset across reminders
        unit_qs = Unit.objects.none()
        for rem in Reminder.objects.filter(id__in=reminder_ids).prefetch_related('specific_targets', 'reminder_towers'):
            aud = (rem.audience or '').strip()
            if aud in ('All Towers', 'All Residents'):
                unit_qs = Unit.objects.filter(Q(primary_email__isnull=False) | Q(secondary_email__isnull=False)).exclude(Q(primary_email='') & Q(secondary_email=''))
                break
            if aud == 'Specific Tower':
                tower_ids = [rt.tower_id for rt in rem.reminder_towers.all()]
                if tower_ids:
                    unit_qs = unit_qs | Unit.objects.filter(floor__tower_id__in=tower_ids)
            if aud == 'Specific Units':
                unit_ids = [st.target_id for st in rem.specific_targets.all() if st.target_type == 'unit']
                if unit_ids:
                    unit_qs = unit_qs | Unit.objects.filter(id__in=unit_ids)
            if aud == 'Specific Resident':
                resident_ids = [st.target_id for st in rem.specific_targets.all() if st.target_type == 'resident']
                if resident_ids:
                    uids = ServiceFeePayment.objects.filter(resident_id__in=resident_ids).values_list('unit_id', flat=True).distinct()
                    unit_qs = unit_qs | Unit.objects.filter(id__in=list(uids))

        if unit_qs.exists():
            # Collect send_times from reminders in this specific group
            send_times_set = set()
            for rem in Reminder.objects.filter(id__in=reminder_ids):
                st = getattr(rem, 'send_times', None)
                if isinstance(st, (list, tuple)):
                    for v in st:
                        if v:
                            send_times_set.add(str(v))

            if not send_times_set:
                send_times_set = {current_time_str}

            logs_unit_ids = ReminderLog.objects.filter(
                reminder_id__in=reminder_ids,
                timing_rule_id__in=timing_ids,
                send_time__in=list(send_times_set)
            ).values_list('unit_id', flat=True).distinct()

            if logs_unit_ids:
                unit_qs = unit_qs.exclude(id__in=list(logs_unit_ids))

            payments_for_specific_units = ServiceFeePayment.objects.filter(unit_id__in=unit_qs.values_list('id', flat=True)).distinct()
            if payments_for_specific_units.exists():
                results_qs_list.append({
                    'payments_qs': payments_for_specific_units,
                    'reminder_ids': reminder_ids,
                    'timing_ids': timing_ids,
                    'timing_type': 'specific',
                    'day_offset': specific_day
                })

    return results_qs_list


def get_reminder_audience_units(reminder):
    """
    Get all target units for a reminder based on its audience configuration.
    
    This function efficiently fetches units with email contact information
    based on the reminder's audience type (All Towers, Specific Units, etc.)
    
    Args:
        reminder: Reminder instance (should be prefetched with relations)
    
    Returns:
        QuerySet: Unit queryset with contact information
    """
    from towers.models import Unit
    
    # Base query - units with email contact (primary or secondary)
    base_query = Unit.objects.filter(
        Q(primary_email__isnull=False) | Q(secondary_email__isnull=False)
    ).exclude(
        Q(primary_email='') & Q(secondary_email='')
    ).select_related(
        'floor',
        'floor__tower'
    )
    
    # Get audience type from reminder
    audience = reminder.audience
    
    # Filter based on audience type
    if audience == 'All Towers' or audience == 'All Residents':
        # Return all units with contact info
        return base_query
    
    elif audience == 'Specific Tower':
        # Get tower IDs from prefetched reminder_towers
        tower_ids = [rt.tower_id for rt in reminder.reminder_towers.all()]
        if tower_ids:
            return base_query.filter(floor__tower_id__in=tower_ids)
        else:
            return Unit.objects.none()
    
    elif audience == 'Specific Units':
        # Get unit IDs from prefetched specific_targets
        unit_targets = [st for st in reminder.specific_targets.all() if st.target_type == 'unit']
        unit_ids = [ut.target_id for ut in unit_targets]
        if unit_ids:
            return base_query.filter(id__in=unit_ids)
        else:
            return Unit.objects.none()
    
    elif audience == 'Specific Resident':
        # Get resident IDs from prefetched specific_targets
        resident_targets = [st for st in reminder.specific_targets.all() if st.target_type == 'resident']
        resident_ids = [rt.target_id for rt in resident_targets]
        if resident_ids:
            # Find units associated with these residents
            # Assuming residents are linked via service fee payments
            from service_fee_management.models import ServiceFeePayment
            unit_ids = ServiceFeePayment.objects.filter(
                resident_id__in=resident_ids
            ).values_list('unit_id', flat=True).distinct()
            return base_query.filter(id__in=unit_ids)
        else:
            return Unit.objects.none()
    
    # Default: return all units
    return base_query


def get_reminder_target_billings(reminder, timing_rule=None, payment_status_filter=None):
    """
    Get target service fee billings/payments for a reminder based on timing_type.
    
    This combines:
    1. Reminder timing rules (calculates target due_date based on timing_type and day_offset)
    2. Audience filtering (who to send to)
    3. Payment status filtering (based on payment state) - REQUIRED (except for 'specific' type)
    4. Unit contact information (for email delivery)
    5. Calculated service_status (auto-marks overdue)
    
    TIMING_TYPE Logic:
    - 'specific': Sends on specific day of month (day_offset = day). Bypasses ServiceFeePayment, uses Unit data only.
                 Example: day_offset=10 sends on 10th of every month to all units
    - 'before_due': Matches payments where due_date = current_date + day_offset
                   Example: day_offset=3 means send 3 days before due date
    - 'after_due': Matches payments where due_date = current_date - day_offset
                  Example: day_offset=2 means send 2 days after due date
    - 'on_due': Matches payments where due_date = current_date (day_offset ignored)
    
    Args:
        reminder: Reminder instance (prefetched with relations)
        timing_rule: ReminderTiming instance to calculate target due_date
                    If None, returns empty queryset
        payment_status_filter: List of payment statuses to filter (e.g., ['due', 'overdue'])
                              This overrides reminder's payment_statuses if provided
    
    Returns:
        QuerySet: ServiceFeePayment queryset with relations (or Unit queryset for 'specific' type)
                 Returns empty queryset if no timing_rule provided
    """
    from service_fee_management.models import ServiceFeePayment
    from towers.models import Unit
    from datetime import timedelta
    
    current_date = timezone.now().date()
    
    # Check if timing_rule is provided
    if not timing_rule:
        logger.info(f"[Timing] No timing_rule provided - returning empty queryset")
        return ServiceFeePayment.objects.none()
    
    day_offset = timing_rule.day_offset or 0
    timing_type = timing_rule.timing_type
    
    # ✅ SPECIAL HANDLING for 'specific' timing type
    # Bypasses ServiceFeePayment entirely, works with Unit data only
    if timing_type == 'specific':
        # Send on SPECIFIC day of month (matches day_offset with current day)
        # Example: day_offset=10, current=Dec 10 → matches (sends on 10th of every month)
        current_day = current_date.day
        if current_day != day_offset:
            # Current day doesn't match - skip sending
            logger.info(f"[Timing] specific: current_day={current_day}, doesn't match day_offset={day_offset} - skipping")
            return ServiceFeePayment.objects.none()
        
        logger.info(f"[Timing] specific: current_day={current_day}, matches day_offset={day_offset} - sending to all units")
        
        # Get target units directly (no ServiceFeePayment needed)
        target_units = get_reminder_audience_units(reminder)
        
        # Return empty queryset if no target units
        if not target_units.exists():
            logger.info("[Timing] specific: No target units found")
            return ServiceFeePayment.objects.none()
        
        # For 'specific' type, return a minimal queryset just for unit data
        # We don't need actual payment records
        unit_ids = list(target_units.values_list('id', flat=True))
        logger.info(f"[Timing] specific: Found {len(unit_ids)} target units")
        
        # Return empty ServiceFeePayment queryset but we'll handle this in the caller
        # The caller (get_audience_list_with_email_and_unit_data) will need special handling
        return ServiceFeePayment.objects.filter(unit_id__in=unit_ids).distinct('unit_id') if unit_ids else ServiceFeePayment.objects.none()
    
    # ✅ For other timing types, payment_statuses are REQUIRED
    payment_statuses = [ps.status for ps in reminder.payment_statuses.all()]
    
    if not payment_statuses:
        logger.info("⚠️ No payment statuses configured - skipping ServiceFeePayment query")
        return ServiceFeePayment.objects.none()
    
    logger.info(f"✅ Payment statuses configured: {payment_statuses}")
    
    # Get current date for overdue calculation
    from django.db.models import Case, When, Value, CharField, Q
    
    # Calculate base query based on timing_type
    if timing_type == 'before_due':
        # Send X days BEFORE due date
        # Example: day_offset=3, current=Dec 9 → matches payments with due_date=Dec 12
        target_due_date = current_date + timedelta(days=day_offset)
        logger.info(f"[Timing] before_due: current={current_date}, offset={day_offset}, matching due_date={target_due_date}")
        base_query = ServiceFeePayment.objects.filter(due_date=target_due_date)
    
    elif timing_type == 'after_due':
        # Send X days AFTER due date
        # Example: day_offset=2, current=Dec 9 → matches payments with due_date=Dec 7
        target_due_date = current_date - timedelta(days=day_offset)
        logger.info(f"[Timing] after_due: current={current_date}, offset={day_offset}, matching due_date={target_due_date}")
        base_query = ServiceFeePayment.objects.filter(due_date=target_due_date)
    
    elif timing_type == 'on_due':
        # Send ON due date (today)
        logger.info(f"[Timing] on_due: current={current_date}, matching due_date={current_date}")
        base_query = ServiceFeePayment.objects.filter(due_date=current_date)
    
    else:
        # No valid timing_type - return empty queryset
        logger.warning(f"[Timing] Invalid timing_type '{timing_type}' - returning empty queryset")
        return ServiceFeePayment.objects.none()
    
    # Add computed service_status annotation
    base_query = base_query.annotate(
        # ✅ CALCULATED FIELD: Automatically mark as 'overdue' if due_date passed
        computed_service_status=Case(
            # If due_date < current_date AND status is 'due', mark as 'overdue'
            When(
                Q(due_date__lt=current_date) & Q(service_status='due'),
                then=Value('overdue')
            ),
            # Otherwise, keep original service_status
            default='service_status',
            output_field=CharField()
        )
    ).select_related(
        'unit',
        'unit__floor',
        'unit__floor__tower',
        'resident',
        'service_fee'
    )
    
    # Apply payment status filter (if not 'All')
    if 'All' not in payment_statuses:
        # Map status names to match database values (case-insensitive)
        status_mapping = {
            'Paid': 'paid',
            'Due': 'due',
            'Overdue': 'overdue',
            'Partial': 'partial'
        }
        
        db_statuses = [status_mapping.get(ps, ps.lower()) for ps in payment_statuses]
        # Filter using computed_service_status (which includes overdue calculation)
        base_query = base_query.filter(computed_service_status__in=db_statuses)
        logger.info(f"✅ Applied payment status filter on computed_service_status: {db_statuses}")
    else:
        logger.info("✅ Payment status 'All' selected - no status filtering")
    
    # Apply custom payment status filter if provided (overrides reminder settings)
    if payment_status_filter:
        base_query = base_query.filter(computed_service_status__in=payment_status_filter)
        logger.info(f"✅ Applied custom payment status filter on computed_service_status: {payment_status_filter}")
    
    # Filter by audience - get target unit IDs
    target_units = get_reminder_audience_units(reminder)
    unit_ids = list(target_units.values_list('id', flat=True))
    
    if unit_ids:
        base_query = base_query.filter(unit_id__in=unit_ids)
    else:
        # No target units means no billings to send
        return ServiceFeePayment.objects.none()
    
    # Ensure units have contact email
    base_query = base_query.filter(
        Q(unit__primary_email__isnull=False) | Q(unit__secondary_email__isnull=False)
    ).exclude(
        Q(unit__primary_email='') & Q(unit__secondary_email='')
    )
    
    return base_query


def get_audience_list_with_email_and_unit_data(reminder, timing_rule=None):
    """
    Final function that returns the complete audience list with email + unit data.
    
    This is the main deliverable function that combines all the above queries
    to return a clean, structured list of recipients with all necessary information.
    
    Args:
        reminder: Reminder instance (or reminder ID)
        timing_rule: ReminderTiming instance to calculate target due_date
    
    Returns:
        list: List of dictionaries containing:
            - unit_id: Unit ID
            - unit_name: Unit name
            - tower_name: Tower name
            - floor_no: Floor number
            - primary_email: Primary contact email
            - primary_name: Primary contact name
            - secondary_email: Secondary contact email
            - secondary_name: Secondary contact name
            - billing_id: Service fee payment ID
            - billing_amount: Amount due
            - due_date: Due date
            - service_status: Payment status
            - service_period: Service period display
    """
    from service_fee_management.models import Reminder
    
    # If reminder is an ID, fetch it with all relations
    if isinstance(reminder, int):
        try:
            reminder = get_active_reminders_with_relations().get(id=reminder)
        except Reminder.DoesNotExist:
            logger.error(f"Reminder with ID {reminder} not found")
            return []
    
    # Get target billings with all relations based on timing_rule
    billings = get_reminder_target_billings(reminder, timing_rule)
    
    # Build the audience list
    audience_list = []
    
    for billing in billings:
        unit = billing.unit
        
        # Determine which email to use (primary first, then secondary)
        email = unit.primary_email or unit.secondary_email
        contact_name = unit.primary_name or unit.secondary_name or 'Resident'
        
        audience_data = {
            # Unit information
            'unit_id': unit.id,
            'unit_name': unit.unit_name,
            'tower_name': unit.floor.tower.tower_name,
            'tower_id': unit.floor.tower.id,
            'floor_no': unit.floor.floor_no,
            'floor_id': unit.floor.id,
            
            # Contact information
            'primary_email': unit.primary_email,
            'primary_name': unit.primary_name,
            'primary_number': unit.primary_number,
            'secondary_email': unit.secondary_email,
            'secondary_name': unit.secondary_name,
            'secondary_number': unit.secondary_number,
            
            # Preferred contact (for sending)
            'email': email,
            'contact_name': contact_name,
            
            # Billing information
            'billing_id': billing.id,
            'billing_amount': float(billing.amount) if hasattr(billing, 'amount') else 0,
            'remaining_amount': float(billing.remaining_amount) if hasattr(billing, 'remaining_amount') else 0,
            'due_date': billing.due_date.strftime('%Y-%m-%d') if billing.due_date else None,
            'service_status': billing.service_status,
            'service_period_month': billing.service_period_month,
            'service_period_year': billing.service_period_year,
            'service_period': billing.service_period_display,
            
            # Resident information (if available)
            'resident_id': billing.resident.id if billing.resident else None,
            'resident_name': billing.resident.full_name if billing.resident else None,
        }
        
        audience_list.append(audience_data)
    
    logger.info(f"Generated audience list for reminder '{reminder.reminder_name}': {len(audience_list)} recipients")
    
    return audience_list


def get_reminders_due_now(current_time_str=None):
    """
    Get all reminders that should be sent right now based on timing rules.
    
    This is the main entry point for the scheduler to find which reminders to process.
    It includes timing validation against current time.
    
    Args:
        current_time_str (str): Current time in HH:MM format (e.g., '10:00')
                               If None, uses current time
    
    Returns:
        QuerySet: Reminders that should be sent now with all relations prefetched
    """
    # Get all active scheduled reminders filtered by current time
    reminders = get_active_reminders_with_relations(current_time_str)
    
    return reminders.distinct()


def was_reminder_sent_today_at_time(reminder_id, timing_rule_id, send_time, unit_id):
    """
    Check if a specific reminder was already sent today at the given time for a unit.
    
    Args:
        reminder_id (int): Reminder ID
        timing_rule_id (int): Timing rule ID
        send_time (str): Send time in HH:MM format (e.g., '10:00')
        unit_id (int): Unit ID
    
    Returns:
        bool: True if already sent today at this time, False otherwise
    """
    from service_fee_management.models import ReminderLog
    from datetime import datetime
    
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    return ReminderLog.objects.filter(
        reminder_id=reminder_id,
        timing_rule_id=timing_rule_id,
        send_time=send_time,
        unit_id=unit_id,
        sent_at__gte=today_start,
        delivery_status__in=['sent', 'delivered']
    ).exists()


def filter_unsent_audience(reminder, timing_rule, audience_list, current_time_str):
    """
    Filter audience list to exclude units that already received this reminder today at this time.
    
    Args:
        reminder: Reminder instance
        timing_rule: ReminderTiming instance
        audience_list (list): List of audience dictionaries with unit_id
        current_time_str (str): Current time in HH:MM format
    
    Returns:
        list: Filtered audience list (only units that haven't received reminder today)
    """
    if not audience_list:
        return []
    
    filtered = []
    for recipient in audience_list:
        unit_id = recipient.get('unit_id')
        if not unit_id:
            continue
        
        # Check if already sent today at this time
        if not was_reminder_sent_today_at_time(
            reminder_id=reminder.id,
            timing_rule_id=timing_rule.id,
            send_time=current_time_str,
            unit_id=unit_id
        ):
            filtered.append(recipient)
    
    logger.info(f"[Duplicate Filter] Reminder {reminder.id} at {current_time_str}: {len(audience_list)} total -> {len(filtered)} after filtering")
    
    return filtered


def get_audience_list_with_email_and_unit_data_filtered(reminder, timing_rule=None, current_time_str=None):
    """
    Get audience list with duplicate prevention.
    
    This is an enhanced version of get_audience_list_with_email_and_unit_data
    that filters out recipients who already received this reminder today at this time.
    
    Args:
        reminder: Reminder instance (or reminder ID)
        timing_rule: ReminderTiming instance to calculate target due_date
        current_time_str (str): Current time in HH:MM format (e.g., '10:00')
    
    Returns:
        list: Filtered list of recipients (excludes already-sent)
    """
    if current_time_str is None:
        current_time_str = timezone.now().strftime('%H:%M')
    
    # Get full audience list
    audience_list = get_audience_list_with_email_and_unit_data(reminder, timing_rule)
    
    # Filter out units that already received reminder today
    if timing_rule:
        filtered_list = filter_unsent_audience(reminder, timing_rule, audience_list, current_time_str)
        return filtered_list
    
    return audience_list


# ==================== EXAMPLE USAGE ====================

def example_usage():
    """
    Example usage of the query functions.
    """
    
    # Example 1: Get all active reminders with relations
    print("=== Example 1: Get all active reminders ===")
    reminders = get_active_reminders_with_relations()
    for reminder in reminders:
        print(f"Reminder: {reminder.reminder_name}")
        print(f"  Timing rules: {reminder.timing_rules.count()}")
        print(f"  Payment statuses: {[ps.status for ps in reminder.payment_statuses.all()]}")
        print(f"  Audience: {reminder.audience}")
    
    # Example 2: Get reminders due at specific time
    print("\n=== Example 2: Get reminders due at 10:00 ===")
    reminders_at_10 = get_reminders_due_now('10:00')
    print(f"Found {reminders_at_10.count()} reminders")
    
    # Example 3: Get audience list for a specific reminder
    print("\n=== Example 3: Get audience list for reminder ===")
    if reminders.exists():
        reminder = reminders.first()
        audience = get_audience_list_with_email_and_unit_data(reminder)
        print(f"Reminder: {reminder.reminder_name}")
        print(f"Audience count: {len(audience)}")
        if audience:
            print(f"First recipient: {audience[0]['contact_name']} ({audience[0]['email']})")
    
    # Example 4: Get target billings for a reminder
    print("\n=== Example 4: Get target billings ===")
    if reminders.exists():
        reminder = reminders.first()
        billings = get_reminder_target_billings(reminder)
        print(f"Found {billings.count()} target billings")
        for billing in billings[:3]:  # Show first 3
            print(f"  - Unit {billing.unit.unit_name}: {billing.service_status} - ৳{billing.remaining_amount}")


if __name__ == '__main__':
    # Run examples (only works in Django shell or management command)
    example_usage()
