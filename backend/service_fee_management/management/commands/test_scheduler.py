"""
Quick test script for the automated reminder scheduler

Run this to verify the scheduler is working correctly
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from service_fee_management.models import (
    Reminder, ServiceFeeBilling, ServiceFeePayment, ReminderLog
)
from towers.models import Tower, Floor, Unit
from service_fee.models import ServiceFee
from user.models import Member


class Command(BaseCommand):
    help = 'Test the automated reminder scheduler with sample data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('🧪 Testing Reminder Scheduler System\n'))
        
        # Test 1: Check scheduler status
        self.test_scheduler_status()
        
        # Test 2: Check email configuration
        self.test_email_config()
        
        # Test 3: Check reminders
        self.test_reminders()
        
        # Test 4: Check billings
        self.test_billings()
        
        # Test 5: Check units with emails
        self.test_unit_emails()
        
        # Test 6: Show what would be sent today
        self.test_what_would_send()
        
        self.stdout.write(self.style.SUCCESS('\n✅ Test completed!\n'))
        
    def test_scheduler_status(self):
        """Test if scheduler is running"""
        self.stdout.write(self.style.WARNING('\n📊 TEST 1: Scheduler Status'))
        
        try:
            # from backend.service_fee_management.schedulerOLD import get_scheduler
            scheduler = get_scheduler()
            
            if scheduler.running:
                self.stdout.write(self.style.SUCCESS('   ✅ Scheduler is RUNNING'))
                self.stdout.write(f'   Check interval: {scheduler.check_interval}s ({scheduler.check_interval//60} mins)')
                if scheduler.thread:
                    self.stdout.write(f'   Thread alive: {scheduler.thread.is_alive()}')
            else:
                self.stdout.write(self.style.ERROR('   ❌ Scheduler is NOT running'))
                self.stdout.write('   Run: python manage.py reminder_scheduler start')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error: {e}'))
            
    def test_email_config(self):
        """Test email configuration"""
        self.stdout.write(self.style.WARNING('\n📧 TEST 2: Email Configuration'))
        
        from django.conf import settings
        
        try:
            backend = getattr(settings, 'EMAIL_BACKEND', 'Not configured')
            host = getattr(settings, 'EMAIL_HOST', 'Not configured')
            port = getattr(settings, 'EMAIL_PORT', 'Not configured')
            user = getattr(settings, 'EMAIL_HOST_USER', 'Not configured')
            
            self.stdout.write(f'   Backend: {backend}')
            self.stdout.write(f'   Host: {host}')
            self.stdout.write(f'   Port: {port}')
            self.stdout.write(f'   User: {user}')
            
            if 'console' in backend:
                self.stdout.write(self.style.WARNING('   ⚠️ Using console backend (emails will print to console)'))
            elif host != 'Not configured':
                self.stdout.write(self.style.SUCCESS('   ✅ SMTP configured'))
            else:
                self.stdout.write(self.style.ERROR('   ❌ Email not properly configured'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error: {e}'))
            
    def test_reminders(self):
        """Test reminders configuration"""
        self.stdout.write(self.style.WARNING('\n📋 TEST 3: Reminders'))
        
        try:
            # All reminders
            total_reminders = Reminder.objects.count()
            self.stdout.write(f'   Total reminders: {total_reminders}')
            
            # Scheduled reminders
            scheduled = Reminder.objects.filter(reminder_type='Scheduled')
            self.stdout.write(f'   Scheduled type: {scheduled.count()}')
            
            # Active scheduled with email
            active_email = Reminder.objects.filter(
                reminder_type='Scheduled',
                status='Active',
                email=True
            )
            self.stdout.write(f'   Active scheduled with email: {active_email.count()}')
            
            if active_email.count() > 0:
                self.stdout.write(self.style.SUCCESS('   ✅ Ready to send emails'))
                self.stdout.write('\n   Details:')
                for reminder in active_email:
                    self.stdout.write(f'   • {reminder.reminder_name}')
                    self.stdout.write(f'     Timing: {", ".join(reminder.send_when)}')
                    self.stdout.write(f'     Audience: {reminder.audience}')
                    self.stdout.write(f'     Total sent: {reminder.total_sent}')
            else:
                self.stdout.write(self.style.WARNING('   ⚠️ No active scheduled email reminders'))
                self.stdout.write('   Create one with: reminder_type="Scheduled", status="Active", email=True')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error: {e}'))
            
    def test_billings(self):
        """Test billings"""
        self.stdout.write(self.style.WARNING('\n💰 TEST 4: Billings'))
        
        try:
            total_billings = ServiceFeeBilling.objects.count()
            self.stdout.write(f'   Total billings: {total_billings}')
            
            # Unpaid billings
            unpaid = ServiceFeeBilling.objects.exclude(service_status='paid')
            self.stdout.write(f'   Unpaid billings: {unpaid.count()}')
            
            # Due today
            today = timezone.now().date()
            due_today = ServiceFeeBilling.objects.filter(due_date=today)
            self.stdout.write(f'   Due today ({today}): {due_today.count()}')
            
            # Due tomorrow
            tomorrow = today + timedelta(days=1)
            due_tomorrow = ServiceFeeBilling.objects.filter(due_date=tomorrow)
            self.stdout.write(f'   Due tomorrow ({tomorrow}): {due_tomorrow.count()}')
            
            # Overdue
            overdue = ServiceFeeBilling.objects.filter(
                due_date__lt=today,
                service_status__in=['due', 'partial', 'overdue']
            )
            self.stdout.write(f'   Overdue: {overdue.count()}')
            
            if unpaid.count() > 0:
                self.stdout.write(self.style.SUCCESS('   ✅ Has unpaid billings to remind'))
            else:
                self.stdout.write(self.style.WARNING('   ⚠️ No unpaid billings'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error: {e}'))
            
    def test_unit_emails(self):
        """Test units with email addresses"""
        self.stdout.write(self.style.WARNING('\n🏢 TEST 5: Unit Email Contacts'))
        
        try:
            total_units = Unit.objects.count()
            self.stdout.write(f'   Total units: {total_units}')
            
            with_primary = Unit.objects.exclude(primary_email__isnull=True).exclude(primary_email='')
            self.stdout.write(f'   Units with primary email: {with_primary.count()}')
            
            with_secondary = Unit.objects.exclude(secondary_email__isnull=True).exclude(secondary_email='')
            self.stdout.write(f'   Units with secondary email: {with_secondary.count()}')
            
            with_any = Unit.objects.filter(
                Q(primary_email__isnull=False, primary_email__gt='') |
                Q(secondary_email__isnull=False, secondary_email__gt='')
            )
            self.stdout.write(f'   Units with any email: {with_any.count()}')
            
            if with_any.count() > 0:
                self.stdout.write(self.style.SUCCESS('   ✅ Units have email contacts'))
                
                # Show sample
                sample = with_any.first()
                if sample:
                    self.stdout.write(f'\n   Sample: {sample.unit_name}')
                    if sample.primary_email:
                        self.stdout.write(f'   • Primary: {sample.primary_name} <{sample.primary_email}>')
                    if sample.secondary_email:
                        self.stdout.write(f'   • Secondary: {sample.secondary_name} <{sample.secondary_email}>')
            else:
                self.stdout.write(self.style.ERROR('   ❌ No units have email addresses'))
                self.stdout.write('   Set primary_email or secondary_email on Unit records')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error: {e}'))
            
    def test_what_would_send(self):
        """Show what emails would be sent today"""
        self.stdout.write(self.style.WARNING('\n🎯 TEST 6: What Would Be Sent Today'))
        
        try:
            from backend.service_fee_management.schedulerOLD import ReminderScheduler
            from django.db.models import Q
            
            scheduler = ReminderScheduler()
            today = timezone.now().date()
            
            # Get active scheduled email reminders
            reminders = Reminder.objects.filter(
                reminder_type='Scheduled',
                status='Active',
                email=True
            )
            
            total_would_send = 0
            
            for reminder in reminders:
                self.stdout.write(f'\n   📧 {reminder.reminder_name}')
                
                for timing_rule in reminder.send_when:
                    target_date = scheduler._calculate_target_date(timing_rule)
                    
                    if target_date:
                        self.stdout.write(f'      Rule: "{timing_rule}"')
                        self.stdout.write(f'      Target date: {target_date}')
                        
                        # Find matching billings
                        billings = ServiceFeeBilling.objects.filter(
                            due_date=target_date
                        ).exclude(service_status='paid')
                        
                        # Apply audience filter
                        if reminder.audience == 'Specific Tower' and reminder.specific_target:
                            billings = billings.filter(unit__floor__tower_id=reminder.specific_target)
                        elif reminder.audience == 'Due Only':
                            billings = billings.filter(service_status='due')
                        elif reminder.audience == 'Overdue Only':
                            billings = billings.filter(service_status='overdue')
                            
                        # Filter to units with emails
                        billings = billings.filter(
                            Q(unit__primary_email__isnull=False, unit__primary_email__gt='') |
                            Q(unit__secondary_email__isnull=False, unit__secondary_email__gt='')
                        )
                        
                        count = billings.count()
                        total_would_send += count
                        
                        if count > 0:
                            self.stdout.write(self.style.SUCCESS(f'      ✅ Would send to {count} billings'))
                            
                            # Show first few
                            for billing in billings[:3]:
                                emails = []
                                if billing.unit.primary_email:
                                    emails.append(billing.unit.primary_email)
                                if billing.unit.secondary_email:
                                    emails.append(billing.unit.secondary_email)
                                    
                                self.stdout.write(f'         • {billing.unit.unit_name}: {", ".join(emails)}')
                                
                            if count > 3:
                                self.stdout.write(f'         ... and {count - 3} more')
                        else:
                            self.stdout.write(self.style.WARNING(f'      ⚠️ No matching billings'))
                            
            if total_would_send > 0:
                self.stdout.write(self.style.SUCCESS(f'\n   📊 Total emails that would be sent: {total_would_send}'))
            else:
                self.stdout.write(self.style.WARNING('\n   ⚠️ No emails would be sent today'))
                self.stdout.write('   This is normal if no billings match the timing rules')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error: {e}'))
            import traceback
            traceback.print_exc()


from django.db.models import Q
