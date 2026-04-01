"""
Automated Email Scheduler for Service Fee Reminders
Integrated with Optimized Query Utilities
"""

import sys
from concurrent.futures import ThreadPoolExecutor
import logging
import threading
from datetime import datetime, timedelta

import django
from django.conf import settings
from django.utils import timezone
from django.core.mail import send_mail
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Import optimized query utilities
try:
    from service_fee_management.reminder_query_utils import (
        get_reminders_due_now,
        get_reminder_payments_setbased
    )
    from service_fee_management.models import ReminderLog, Reminder, Member, ReminderTiming
except ImportError:
    pass # Will be handled when run in Django context

logger = logging.getLogger(__name__)

class ReminderScheduler:
    """
    Background scheduler for automated reminder emails using APScheduler
    """
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.running = False
        # Worker pool for parallel email sending (Async & Fast)
        self.email_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="EmailSender")
        
    def start(self):
        """Start the scheduler"""
        if self.running:
            logger.info("[WARN] Reminder scheduler already running")
            return
            
        # Add job to run every minute
        self.scheduler.add_job(
            self._process_scheduled_reminders,
            trigger=CronTrigger(minute='*'),
            id='reminder_check',
            name='Check Reminders',
            replace_existing=True,
            max_instances=1
        )
        
        self.scheduler.start()
        self.running = True
        logger.info("[OK] Reminder scheduler started successfully (Every Minute)")
        print("[EMAIL] Reminder scheduler started (Every Minute)")
        
    def stop(self):
        """Stop the scheduler gracefully"""
        if not self.running:
            return
            
        self.scheduler.shutdown(wait=False)
        self.email_executor.shutdown(wait=False)
        self.running = False
        logger.info("[STOPPED] Reminder scheduler stopped")
        
    def _process_scheduled_reminders(self):
        """
        Find and process all active scheduled reminders.
        """
        try:
            # Console feedback for heartbeat
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔄 Checking Reminders...")
            logger.info("[ReminderScheduler] 🔄 Checking for reminders...")
            
            now = timezone.now()
            current_time_str = now.strftime('%H:%M')
            
            # Only check the current minute
            times_to_check = [current_time_str]

            for check_time in times_to_check:
                # Use set-based generator to get grouped payment querysets matching reminders
                entries = get_reminder_payments_setbased(check_time)
                if not entries:
                    continue

                # Collect all unique reminder and timing ids to prefetch once
                all_reminder_ids = set()
                all_timing_ids = set()
                for e in entries:
                    all_reminder_ids.update(e.get('reminder_ids', []))
                    all_timing_ids.update(e.get('timing_ids', []))

                reminders_map = {}
                timings_map = {}
                if all_reminder_ids:
                    qs = Reminder.objects.filter(id__in=list(all_reminder_ids)).prefetch_related('timing_rules', 'payment_statuses', 'specific_targets', 'reminder_towers')
                    for r in qs:
                        reminders_map[r.id] = r

                if all_timing_ids:
                    for t in ReminderTiming.objects.filter(id__in=list(all_timing_ids)).select_related('reminder'):
                        timings_map[t.id] = t

                # Expand each group and send
                for entry in entries:
                    payments_qs = entry['payments_qs']
                    reminder_ids = entry.get('reminder_ids', [])
                    timing_ids = set(entry.get('timing_ids', []))

                    # fetch reminder objects for this entry
                    reminders_for_entry = [reminders_map[rid] for rid in reminder_ids if rid in reminders_map]

                    # iterate payments and pair with reminders/timings
                    for billing in payments_qs:
                        unit = getattr(billing, 'unit', None)
                        if not unit:
                            continue

                        email = unit.primary_email or unit.secondary_email
                        contact_name = unit.primary_name or unit.secondary_name or 'Resident'
                        recipient = {
                            'unit_id': unit.id,
                            'unit_name': getattr(unit, 'unit_name', '') or getattr(unit, 'name', ''),
                            'tower_name': getattr(unit.floor.tower, 'tower_name', '') if getattr(unit, 'floor', None) and getattr(unit.floor, 'tower', None) else '',
                            'floor_no': getattr(unit.floor, 'floor_no', None),
                            'primary_email': unit.primary_email,
                            'primary_name': unit.primary_name,
                            'secondary_email': unit.secondary_email,
                            'secondary_name': unit.secondary_name,
                            'email': email,
                            'contact_name': contact_name,
                            'billing_id': billing.id,
                            'billing_amount': float(getattr(billing, 'amount', 0)) if getattr(billing, 'amount', None) is not None else 0,
                            'remaining_amount': float(getattr(billing, 'remaining_amount', 0)) if getattr(billing, 'remaining_amount', None) is not None else 0,
                            'due_date': getattr(billing, 'due_date', None).strftime('%Y-%m-%d') if getattr(billing, 'due_date', None) else None,
                            'service_status': getattr(billing, 'service_status', None),
                            'service_period': getattr(billing, 'service_period_display', '') or f"{getattr(billing,'service_period_month','')}-{getattr(billing,'service_period_year','')}",
                            'resident_id': getattr(billing.resident, 'id', None) if getattr(billing, 'resident', None) else None,
                            'resident_name': getattr(billing.resident, 'full_name', None) if getattr(billing, 'resident', None) else None
                        }

                        # For each reminder this payment could belong to, find relevant timing rules and send
                        for rem in reminders_for_entry:
                            # get timing rules for this reminder that are in timing_ids
                            rules = [t for t in rem.timing_rules.all() if t.id in timing_ids]
                            for rule in rules:
                                try:
                                    # ✅ CHECK FOR DUPLICATES: Skip if already sent today at this time
                                    if self._was_already_sent(rem.id, rule.id, check_time, unit.id):
                                        logger.info(f"  [SKIP] Reminder '{rem.reminder_name}' already sent to unit {unit.id} today at {check_time}")
                                        continue
                                    
                                    logger.info(f"  [SEND] Processing reminder '{rem.reminder_name}' (rule {rule.id}) at {check_time} for unit {unit.id}")
                                    if rem.email:
                                        self._send_email_from_dict(rem, recipient, rule, check_time)
                                    if rem.sms:
                                        self._send_sms_from_dict(rem, recipient, rule, check_time)
                                    if rem.app_notification:
                                        self._send_app_notification_from_dict(rem, recipient, rule, check_time)
                                except Exception as e:
                                    logger.error(f"[ERROR] Error sending for reminder {rem.id} unit {unit.id}: {e}", exc_info=True)
                    
        except Exception as e:
            logger.error(f"[ERROR] Error in scheduler: {e}", exc_info=True)

    def _calculate_target_date(self, rule):
        """
        Calculate target date based on timing rule object
        """
        try:
            today = timezone.now().date()
            offset = rule.day_offset or 0
            
            if rule.timing_type == 'before_due':
                return today + timedelta(days=offset)
            elif rule.timing_type == 'after_due':
                return today - timedelta(days=offset)
            elif rule.timing_type == 'on_due':
                return today
            
            # Fallback for legacy data
            label = rule.timing_label.lower()
            if "before" in label:
                days = int(''.join(filter(str.isdigit, label)) or 1)
                return today + timedelta(days=days)
            elif "after" in label:
                days = int(''.join(filter(str.isdigit, label)) or 1)
                return today - timedelta(days=days)
            elif "on due" in label:
                return today
                
            return today
            
        except Exception:
            return timezone.now().date()

    def _was_already_sent(self, reminder_id, timing_rule_id, send_time, unit_id):
        """
        Check if reminder was already sent today at this exact time for this unit.
        Prevents duplicate sends by checking ReminderLog table.
        """
        try:
            from service_fee_management.models import ReminderLog
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Check if this exact reminder+timing+time+unit combination was already sent today
            already_sent = ReminderLog.objects.filter(
                reminder_id=reminder_id,
                timing_rule_id=timing_rule_id,
                send_time=send_time,
                unit_id=unit_id,
                sent_at__gte=today_start,
                delivery_status__in=['sent', 'delivered']
            ).exists()
            
            return already_sent
        except Exception as e:
            logger.error(f"[ERROR] Error checking duplicate: {e}")
            return False

    def _send_email_from_dict(self, reminder, recipient, timing_rule, send_time):
        """
        Queue email sending task to thread pool
        """
        try:
            # Send email via thread pool (FAST & ASYNC)
            self.email_executor.submit(
                self._send_single_email_task,
                reminder, recipient, timing_rule, send_time
            )
                
        except Exception as e:
            logger.error(f"[ERROR] Error queuing email: {e}", exc_info=True)

    def _send_single_email_task(self, reminder, recipient, timing_rule, send_time):
        """
        Actual email sending task
        """
        try:
            # Prepare email content
            subject = f"Service Fee Reminder - {recipient['service_period']}"
            
            message = reminder.message_preview
            message = message.replace('{resident_name}', recipient['contact_name'])
            message = message.replace('{unit_name}', recipient['unit_name'])
            message = message.replace('{tower_name}', recipient['tower_name'])
            message = message.replace('{amount}', str(recipient['remaining_amount']))
            message = message.replace('{due_date}', recipient['due_date'] or 'N/A')
            message = message.replace('{service_period}', recipient['service_period'])
            
            is_overdue = str(recipient['service_status']).lower() == 'overdue'
            status_color = '#FEE2E2' if is_overdue else '#FEF3C7'
            status_text_color = '#991B1B' if is_overdue else '#92400E'
            
            html_message = self._generate_html(recipient, message, status_color, status_text_color)
            
            from_email = getattr(settings, 'EMAIL_HOST_USER', 'noreply@estatelink.com')
            
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[recipient['email']],
                fail_silently=False,
                html_message=html_message
            )
            
            # Log ACTUAL send time (after send completes)
            actual_send_time = timezone.now().strftime('%H:%M')
            logger.info(f"[OK] Sent to {recipient['email']} at {actual_send_time}")
            self._create_log(reminder, recipient, message, 'sent', 'Email', timing_rule.id if timing_rule else None, actual_send_time)
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to send to {recipient['email']}: {e}")
            actual_send_time = timezone.now().strftime('%H:%M')
            self._create_log(reminder, recipient, reminder.message_preview, 'failed', 'Email', timing_rule.id if timing_rule else None, actual_send_time, str(e))

    def _send_sms_from_dict(self, reminder, recipient, timing_rule, send_time):
        """Stub SMS sender; integrate provider here."""
        try:
            logger.info(f"[SMS] Would send to {recipient.get('primary_number') or recipient.get('secondary_number') or 'unknown'} for reminder '{reminder.reminder_name}'")
            actual_send_time = timezone.now().strftime('%H:%M')
            self._create_log(reminder, recipient, reminder.message_preview, 'sent', 'SMS', timing_rule.id if timing_rule else None, actual_send_time)
        except Exception as e:
            logger.error(f"[ERROR] SMS send stub failed: {e}")
            actual_send_time = timezone.now().strftime('%H:%M')
            self._create_log(reminder, recipient, reminder.message_preview, 'failed', 'SMS', timing_rule.id if timing_rule else None, actual_send_time, str(e))

    def _send_app_notification_from_dict(self, reminder, recipient, timing_rule, send_time):
        """Send App notification with community member overdue notification integration"""
        try:
            logger.info(f"[APP] Sending app notification to unit {recipient.get('unit_id')} for reminder '{reminder.reminder_name}'")
            
            # Check if this is an overdue reminder
            is_overdue = str(recipient.get('service_status', '')).lower() == 'overdue'
            
            if is_overdue and recipient.get('billing_id'):
                # Send community member overdue notification
                try:
                    from notifications.utils import create_community_member_bill_overdue_notification
                    from service_fee_management.models import ServiceFeePayment
                    
                    # Get the payment object
                    payment = ServiceFeePayment.objects.filter(id=recipient['billing_id']).select_related(
                        'owner', 'owner__member', 'unit', 'unit__floor__tower'
                    ).first()
                    
                    if payment:
                        # Create community member overdue notification (Push + In-app)
                        create_community_member_bill_overdue_notification(payment)
                        logger.info(f"[APP] ✅ Community member overdue notification sent for payment ID {payment.id}")
                    else:
                        logger.warning(f"[APP] Payment not found for billing_id {recipient['billing_id']}")
                except Exception as notif_error:
                    logger.error(f"[APP] Error creating community member overdue notification: {notif_error}", exc_info=True)
            
            actual_send_time = timezone.now().strftime('%H:%M')
            self._create_log(reminder, recipient, reminder.message_preview, 'sent', 'App', timing_rule.id if timing_rule else None, actual_send_time)
        except Exception as e:
            logger.error(f"[ERROR] App notification failed: {e}")
            actual_send_time = timezone.now().strftime('%H:%M')
            self._create_log(reminder, recipient, reminder.message_preview, 'failed', 'App', timing_rule.id if timing_rule else None, actual_send_time, str(e))

    def _create_log(self, reminder, recipient, message, status, channel, timing_rule_id, send_time, error=None):
        """
        Create database log entry 
        """
        try:
            from service_fee_management.models import ReminderLog
            ReminderLog.objects.create(
                reminder=reminder,
                recipient_id=recipient.get('resident_id'),
                unit_id=recipient['unit_id'],
                channel=channel,
                timing_rule_id=timing_rule_id,
                send_time=send_time,
                message_content=message,
                delivery_status=status,
                error_message=error
            )

            if status == 'sent':
                reminder.total_sent += 1
                reminder.last_sent = timezone.now()
                reminder.save(update_fields=['total_sent', 'last_sent'])

        except Exception as e:
            logger.error(f"Log error: {e}")

    def _generate_html(self, r, message, bg_color, text_color):
        """Generate HTML content"""
        return f"""
        <html>
        <body style="font-family: Arial; padding: 20px; background: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; border-bottom: 2px solid #3D9D9B; padding-bottom: 20px; margin-bottom: 20px;">
                    <h2 style="color: #3D9D9B; margin: 0;">Service Fee Reminder</h2>
                    <p style="color: #6B7280; font-size: 14px; margin-top: 5px;">Estate Link Property Management</p>
                </div>
                
                <p>Dear <strong>{r['contact_name']}</strong>,</p>
                
                <div style="white-space: pre-line; color: #4B5563; line-height: 1.6;">{message}</div>
                
                <div style="background: #F9FAFB; padding: 20px; margin-top: 25px; border-radius: 8px; border-left: 4px solid #3D9D9B;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px 0; color: #6B7280;">Unit:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold;">{r['unit_name']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #6B7280;">Tower:</td>
                            <td style="padding: 5px 0; text-align: right;">{r['tower_name']}</td>
                        </tr>
                         <tr>
                            <td style="padding: 5px 0; color: #6B7280;">Period:</td>
                            <td style="padding: 5px 0; text-align: right;">{r['service_period']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #6B7280;">Amount Due:</td>
                            <td style="padding: 5px 0; text-align: right; color: #DC2626; font-size: 18px; font-weight: bold;">৳{r['remaining_amount']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #6B7280;">Status:</td>
                            <td style="padding: 5px 0; text-align: right;">
                                <span style="background:{bg_color}; color:{text_color}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    {r['service_status'].upper()}
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>
                
                 <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 20px;">
                    <p>This is an automated reminder. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

# Global scheduler instance
_scheduler_instance = None

def get_scheduler():
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = ReminderScheduler()
    return _scheduler_instance

def start_scheduler():
    get_scheduler().start()

def stop_scheduler():
    get_scheduler().stop()
