# Automated Service Fee Reminder Email System

## 📧 Overview

This is a **robust, self-contained automated email reminder system** for service fee payments that runs on **shared hosting without requiring Celery, Redis, or external task queues**.

### Key Features

✅ **Automatic Startup** - Starts when Django server starts  
✅ **Background Threading** - Runs continuously in daemon thread  
✅ **Asynchronous Email Sending** - Each email sent in separate thread  
✅ **Smart Scheduling** - Processes timing rules (before/after due dates)  
✅ **Duplicate Prevention** - Won't send same reminder twice in one day  
✅ **Primary & Secondary Contacts** - Sends to both unit contacts  
✅ **Audience Filtering** - Supports multiple audience types  
✅ **Error Handling** - Logs failures and continues operation  
✅ **Shared Hosting Compatible** - No external dependencies needed  

---

## 🏗️ Architecture

### Components

1. **ReminderScheduler** (`scheduler.py`)
   - Background daemon thread
   - Checks for scheduled reminders every 5 minutes
   - Processes timing rules and sends emails

2. **AppConfig** (`apps.py`)
   - Auto-starts scheduler when Django starts
   - Only runs in server mode (not during migrations)

3. **Management Command** (`management/commands/reminder_scheduler.py`)
   - Manual control: start, stop, status, test
   - Useful for debugging and testing

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Django Server Starts                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          ServiceFeeManagementConfig.ready()                  │
│          Starts ReminderScheduler in daemon thread           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Background Scheduler Loop                       │
│              Runs every 5 minutes (300 seconds)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─► Get Active Scheduled Reminders
                       │   (reminder_type='Scheduled', email=True)
                       │
                       ├─► For each reminder's timing rule:
                       │   • Parse rule (e.g., "1 day before due")
                       │   • Calculate target date
                       │   • Find matching billings
                       │
                       ├─► For each matching billing:
                       │   • Check if already sent today
                       │   • Get unit primary/secondary contacts
                       │   • Send email in separate thread ⚡
                       │   • Create ReminderLog
                       │
                       └─► Wait 5 minutes, repeat
```

---

## 📋 Prerequisites

### 1. Email Configuration

Ensure your `settings.py` has email configured:

```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'  # Use App Password for Gmail
```

### 2. Unit Contact Information

Units must have contact emails in the `Unit` model:

```python
# Primary contact
unit.primary_name = "John Doe"
unit.primary_email = "john@example.com"

# Secondary contact (optional)
unit.secondary_name = "Jane Doe"
unit.secondary_email = "jane@example.com"
```

### 3. Reminder Configuration

Create reminders with:
- **reminder_type** = `'Scheduled'` (not 'Manual Send')
- **email** = `True`
- **status** = `'Active'`
- **send_when** = List of timing rules

Example:
```json
{
  "reminder_name": "Payment Due Soon",
  "reminder_type": "Scheduled",
  "status": "Active",
  "email": true,
  "send_when": ["1 day before due", "3 days after due"],
  "audience": "All Towers",
  "message_preview": "Dear {resident_name}, your service fee for {service_period} is due on {due_date}. Outstanding amount: ৳{amount}"
}
```

---

## 🚀 Usage

### Automatic Mode (Recommended)

The scheduler **starts automatically** when you run Django:

```bash
python manage.py runserver
```

You'll see in the console:
```
✅ Service Fee Reminder Scheduler initialized
✅ Reminder scheduler started successfully
```

### Manual Control

Use the management command for manual control:

```bash
# Start scheduler
python manage.py reminder_scheduler start

# Stop scheduler
python manage.py reminder_scheduler stop

# Check status
python manage.py reminder_scheduler status

# Test configuration
python manage.py reminder_scheduler test
```

---

## 📝 Timing Rules

The system supports flexible timing rules:

### Supported Formats

| Timing Rule | Description | Example |
|------------|-------------|---------|
| `"X day(s) before due"` | Send X days before due date | `"1 day before due"` → sends when billing is due tomorrow |
| `"X day(s) after due"` | Send X days after due date | `"3 days after due"` → sends when billing is 3 days overdue |
| `"On due date"` | Send on the exact due date | `"On due date"` → sends on due date itself |

### How It Works

The scheduler calculates which billings match today:

```python
# Example: "1 day before due"
# If today is Nov 4, 2025
# → Find billings with due_date = Nov 5, 2025

# Example: "3 days after due"
# If today is Nov 5, 2025
# → Find billings with due_date = Nov 2, 2025
```

---

## 🎯 Audience Filtering

Control who receives reminders:

| Audience | Description |
|----------|-------------|
| `All Towers` | All unpaid billings across all towers |
| `All Residents` | Same as All Towers |
| `Specific Tower` | Only billings from specified tower (set `specific_target` to tower ID) |
| `Specific Units` | Only specified units (set `specific_target` to comma-separated unit IDs) |
| `Specific Resident` | Only specified resident (set `specific_target` to member ID) |
| `Due Only` | Only billings with status='due' (not overdue) |
| `Overdue Only` | Only billings with status='overdue' |

---

## 🧵 Threading Implementation

### Multi-Level Threading

The system uses **2 levels of threading** for maximum efficiency:

#### Level 1: Main Scheduler Thread
```python
# Daemon thread that runs continuously
scheduler_thread = threading.Thread(target=_run_scheduler, daemon=True)
```
- Runs in background
- Checks every 5 minutes
- Non-blocking

#### Level 2: Email Sending Threads
```python
# Each email sent in separate thread
email_thread = threading.Thread(
    target=_send_single_email,
    args=(reminder, billing, recipient),
    daemon=True
)
email_thread.start()
```
- Asynchronous email sending
- Won't block if one email is slow
- Parallel processing of multiple emails

### Benefits

✅ **Non-blocking** - Server remains responsive  
✅ **Fault-tolerant** - One email failure doesn't stop others  
✅ **Efficient** - Multiple emails sent simultaneously  
✅ **Shared hosting compatible** - No external queue needed  

---

## 📊 Database Models

### Reminder Model
```python
class Reminder(models.Model):
    reminder_name = CharField  # "Monthly Payment Reminder"
    reminder_type = CharField  # "Scheduled" or "Manual Send"
    status = CharField         # "Active" or "Paused"
    send_when = JSONField      # ["1 day before due", "3 days after due"]
    email = BooleanField       # True to enable email
    audience = CharField       # "All Towers", "Specific Tower", etc.
    message_preview = TextField # Email message template
    total_sent = IntegerField  # Counter
    last_sent = DateTimeField  # Last send timestamp
```

### ReminderLog Model
```python
class ReminderLog(models.Model):
    reminder = ForeignKey(Reminder)
    recipient = ForeignKey(Member)
    unit = ForeignKey(Unit)
    channel = CharField        # "Email", "SMS", "App"
    message_content = TextField
    delivery_status = CharField # "sent", "failed", "delivered"
    sent_at = DateTimeField
    error_message = TextField  # If failed
```

---

## 🔧 Configuration Options

### Adjust Check Interval

Default is 5 minutes (300 seconds). To change:

```python
# In scheduler.py __init__ method
self.check_interval = 600  # 10 minutes
```

### Email Template Customization

Edit `_generate_reminder_html()` in `scheduler.py` to customize the email design.

### Variable Substitution

Available variables in `message_preview`:

| Variable | Replaced With |
|----------|---------------|
| `{resident_name}` | Primary or secondary contact name |
| `{unit_name}` | Unit name (e.g., "A-101") |
| `{tower_name}` | Tower name |
| `{amount}` | Remaining amount to pay |
| `{due_date}` | Formatted due date |
| `{service_period}` | Month and year (e.g., "November 2025") |

---

## 🐛 Debugging & Troubleshooting

### Enable Debug Logging

Add to `settings.py`:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'service_fee_management.scheduler': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    },
}
```

### Check Scheduler Status

```bash
python manage.py reminder_scheduler status
```

Output:
```
✅ Scheduler is RUNNING
   Check interval: 300 seconds (5 minutes)
   Thread alive: True
```

### Test Reminder Configuration

```bash
python manage.py reminder_scheduler test
```

This shows:
- Active scheduled reminders
- Their configuration
- Potential recipients
- What would be sent

### Common Issues

| Issue | Solution |
|-------|----------|
| Scheduler not starting | Check for management commands in `sys.argv` |
| No emails sent | Verify units have `primary_email` or `secondary_email` |
| Duplicate emails | Check `ReminderLog` for existing entries |
| Wrong timing | Verify billing `due_date` matches timing rule calculation |

### Manual Test Send

Create a test reminder:

```python
from service_fee_management.models import Reminder

reminder = Reminder.objects.create(
    reminder_name="Test Reminder",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["On due date"],  # Adjust based on your test billings
    audience="All Towers",
    message_preview="Test: {resident_name}, pay ৳{amount} by {due_date}"
)
```

Then wait for the scheduler to process it, or manually trigger:

```python
from service_fee_management.scheduler import get_scheduler
scheduler = get_scheduler()
scheduler._process_scheduled_reminders()
```

---

## 📈 Performance Considerations

### Scalability

| Metric | Limit | Notes |
|--------|-------|-------|
| Check Interval | 5 minutes | Adjustable |
| Concurrent Emails | Unlimited | Each in separate thread |
| Reminders | ~100 | Per check cycle |
| Recipients per Reminder | ~1000 | Limited by email rate limits |

### Email Rate Limits

**Gmail** (default config):
- 500 emails/day (free)
- 2000 emails/day (Google Workspace)

If you exceed limits, consider:
1. Increase check interval
2. Use dedicated SMTP service (SendGrid, Mailgun)
3. Batch recipients

### Memory Usage

- **Scheduler thread**: ~5-10 MB
- **Email threads**: ~1-2 MB each (short-lived)
- **Total**: Minimal impact on shared hosting

---

## 🔒 Security Considerations

### Email Credentials

✅ **Use environment variables** for sensitive data:

```python
# settings.py
import os
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
```

### Prevent Email Bombing

✅ **Built-in protections**:
- Duplicate prevention (same reminder won't send twice/day)
- Status filtering (only unpaid billings)
- Audience filtering (target specific groups)

### Data Privacy

✅ **Email content**:
- Only sends to unit's registered contacts
- Logs track delivery (audit trail)
- No sensitive payment details in email

---

## 🧪 Testing

### Unit Tests

Create tests in `tests/test_scheduler.py`:

```python
from django.test import TestCase
from service_fee_management.scheduler import ReminderScheduler
from service_fee_management.models import Reminder, ServiceFeeBilling

class ReminderSchedulerTestCase(TestCase):
    def test_scheduler_start_stop(self):
        scheduler = ReminderScheduler()
        scheduler.start()
        self.assertTrue(scheduler.running)
        
        scheduler.stop()
        self.assertFalse(scheduler.running)
    
    def test_timing_rule_parsing(self):
        scheduler = ReminderScheduler()
        
        # Test "before due"
        from datetime import timedelta
        from django.utils import timezone
        
        target = scheduler._calculate_target_date("1 day before due")
        expected = timezone.now().date() + timedelta(days=1)
        self.assertEqual(target, expected)
```

### Integration Tests

Test with real database:

```bash
# 1. Create test reminder
python manage.py shell
>>> from service_fee_management.models import Reminder
>>> Reminder.objects.create(...)

# 2. Run scheduler test
python manage.py reminder_scheduler test

# 3. Check logs
tail -f logs/django.log
```

---

## 📦 Deployment

### Production Checklist

- [ ] Set `EMAIL_BACKEND` to SMTP (not console)
- [ ] Use environment variables for credentials
- [ ] Configure real SMTP server
- [ ] Test email delivery
- [ ] Enable logging
- [ ] Monitor ReminderLog table
- [ ] Set up error alerts

### Shared Hosting Setup

**Compatible with**:
- cPanel hosting
- Shared Django hosting
- Basic VPS

**Steps**:
1. Upload code to server
2. Configure email in `settings.py`
3. Start server: `python manage.py runserver` (or use gunicorn/uwsgi)
4. Scheduler starts automatically
5. Monitor logs

### Process Managers

If using **Gunicorn/uWSGI**:

```bash
# gunicorn
gunicorn backend.wsgi:application --bind 0.0.0.0:8000

# Scheduler will start automatically in each worker
```

⚠️ **Important**: Scheduler runs in **each worker process**. If you have 4 workers, you'll have 4 scheduler threads. This is usually fine, as duplicate prevention handles it.

To run only in one worker, use process number check:

```python
# apps.py
def ready(self):
    import os
    # Only start in worker 0
    if os.environ.get('GUNICORN_WORKER', '0') == '0':
        from .scheduler import start_scheduler
        start_scheduler()
```

---

## 📚 API Reference

### Scheduler Methods

```python
from service_fee_management.scheduler import get_scheduler

scheduler = get_scheduler()

# Start scheduler
scheduler.start()

# Stop scheduler
scheduler.stop()

# Check if running
is_running = scheduler.running

# Change check interval
scheduler.check_interval = 600  # 10 minutes
```

### Email Sending

```python
# Manually send reminder email
from service_fee_management.scheduler import ReminderScheduler
from service_fee_management.models import Reminder, ServiceFeeBilling

scheduler = ReminderScheduler()
reminder = Reminder.objects.get(id=1)
billing = ServiceFeeBilling.objects.get(id=1)

recipient = {
    'email': 'test@example.com',
    'name': 'John Doe',
    'type': 'Primary'
}

scheduler._send_single_email(reminder, billing, recipient)
```

---

## 🎓 Examples

### Example 1: Monthly Due Date Reminder

```python
Reminder.objects.create(
    reminder_name="Monthly Service Fee Due",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["1 day before due"],
    audience="All Towers",
    message_preview="""
Dear {resident_name},

This is a friendly reminder that your service fee for {service_period} is due tomorrow.

Unit: {unit_name}
Tower: {tower_name}
Amount: ৳{amount}
Due Date: {due_date}

Please make your payment at your earliest convenience.

Thank you!
Estate Link Management
    """
)
```

### Example 2: Overdue Escalation

```python
Reminder.objects.create(
    reminder_name="Overdue Payment Notice",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["3 days after due", "7 days after due", "14 days after due"],
    audience="Overdue Only",
    message_preview="""
Dear {resident_name},

Your service fee payment for {service_period} is now overdue.

Outstanding Amount: ৳{amount}
Original Due Date: {due_date}

Please settle this payment immediately to avoid late fees.

Contact us if you need assistance.

Estate Link Management
    """
)
```

### Example 3: Specific Tower Reminder

```python
# Get tower ID first
tower = Tower.objects.get(tower_name="Tower A")

Reminder.objects.create(
    reminder_name="Tower A Payment Reminder",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["2 days before due"],
    audience="Specific Tower",
    specific_target=str(tower.id),
    message_preview="Dear {resident_name}, Tower A service fee due in 2 days: ৳{amount}"
)
```

---

## 🤝 Support

### Questions?

1. Check logs for errors
2. Run `python manage.py reminder_scheduler test`
3. Verify email configuration
4. Check unit contact information

### Contributing

To improve the scheduler:
1. Edit `scheduler.py`
2. Test thoroughly
3. Update this documentation

---

## ✅ Summary

You now have a **production-ready, automated email reminder system** that:

- ✅ Starts automatically with Django
- ✅ Runs in background without blocking
- ✅ Sends emails asynchronously using threads
- ✅ Targets primary & secondary contacts
- ✅ Prevents duplicate sends
- ✅ Works on shared hosting
- ✅ Logs all activity
- ✅ Handles errors gracefully

**No Celery, No Redis, No External Services Needed!** 🎉
