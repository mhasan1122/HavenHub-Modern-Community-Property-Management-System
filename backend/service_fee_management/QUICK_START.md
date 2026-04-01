# 🚀 Quick Start Guide - Automated Email Reminder System

## ⚡ 5-Minute Setup

### Step 1: Verify Email Configuration ✉️

Check your `backend/settings.py`:

```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'  # Gmail App Password
```

**Gmail App Password Setup:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Generate App Password
4. Use that password (not your regular password)

---

### Step 2: Add Email to Units 🏢

Your units need contact emails:

```python
# Admin panel or shell
from towers.models import Unit

unit = Unit.objects.get(id=1)
unit.primary_name = "John Doe"
unit.primary_email = "john@example.com"
unit.secondary_name = "Jane Doe"
unit.secondary_email = "jane@example.com"
unit.save()
```

Or use the admin interface to add emails to units.

---

### Step 3: Create a Scheduled Reminder 📅

In Django admin or shell:

```python
from service_fee_management.models import Reminder

Reminder.objects.create(
    reminder_name="Monthly Payment Reminder",
    reminder_type="Scheduled",  # ← IMPORTANT!
    status="Active",
    email=True,  # ← Enable email
    app_notification=False,
    sms=False,
    send_when=["1 day before due", "3 days after due"],
    audience="All Towers",
    message_preview="""Dear {resident_name},

Your service fee for {service_period} is due on {due_date}.

Unit: {unit_name}
Tower: {tower_name}
Outstanding Amount: ৳{amount}

Please pay before the due date to avoid late fees.

Thank you!
Estate Link Management"""
)
```

**Important Fields:**
- `reminder_type` = `"Scheduled"` (not "Manual Send")
- `status` = `"Active"`
- `email` = `True`
- `send_when` = List of timing rules

---

### Step 4: Start Django Server 🚀

```bash
python manage.py runserver
```

**You should see:**
```
✅ Service Fee Reminder Scheduler initialized
✅ Reminder scheduler started successfully
```

**Done! The scheduler is now running in the background.** 🎉

---

## 📊 Verify It's Working

### Test 1: Check Scheduler Status

```bash
python manage.py reminder_scheduler status
```

**Expected output:**
```
✅ Scheduler is RUNNING
   Check interval: 300 seconds (5 minutes)
   Thread alive: True
```

---

### Test 2: Run System Test

```bash
python manage.py test_scheduler
```

This comprehensive test checks:
- ✅ Scheduler status
- ✅ Email configuration
- ✅ Reminders setup
- ✅ Billings in database
- ✅ Units with emails
- ✅ What would be sent today

---

### Test 3: Test Reminder Configuration

```bash
python manage.py reminder_scheduler test
```

Shows all active scheduled reminders and their targets.

---

## 🎯 How Timing Rules Work

| Timing Rule | When It Sends | Example |
|------------|---------------|---------|
| `"1 day before due"` | Day before due date | Due Nov 5 → Sends Nov 4 |
| `"On due date"` | On the due date | Due Nov 5 → Sends Nov 5 |
| `"3 days after due"` | 3 days after due | Due Nov 2 → Sends Nov 5 |
| `"7 days after due"` | 7 days after due | Due Oct 29 → Sends Nov 5 |

**Multiple rules:** You can have multiple timing rules in one reminder:
```python
send_when=["1 day before due", "On due date", "3 days after due", "7 days after due"]
```

This will send 4 emails at different times (if billing is still unpaid).

---

## 👥 Who Gets Emails?

**Primary Contact:** Always receives if `unit.primary_email` is set  
**Secondary Contact:** Always receives if `unit.secondary_email` is set

**Example:**
```
Unit A-101:
  primary_email = "john@example.com"
  secondary_email = "jane@example.com"
  
→ Both john and jane will receive reminder emails
```

If a billing is fully paid, **no reminder is sent**.

---

## 🔍 Troubleshooting

### ❌ No emails being sent?

**Check:**

1. **Scheduler running?**
   ```bash
   python manage.py reminder_scheduler status
   ```

2. **Reminder configured correctly?**
   - reminder_type = "Scheduled" ✅
   - status = "Active" ✅
   - email = True ✅

3. **Units have emails?**
   ```python
   Unit.objects.exclude(primary_email__isnull=True).count()
   ```

4. **Billings match timing rules?**
   ```python
   from django.utils import timezone
   from datetime import timedelta
   
   # For "1 day before due", check billings due tomorrow
   tomorrow = timezone.now().date() + timedelta(days=1)
   ServiceFeeBilling.objects.filter(due_date=tomorrow).count()
   ```

5. **Already sent today?**
   ```python
   from service_fee_management.models import ReminderLog
   from django.utils import timezone
   
   today_start = timezone.now().replace(hour=0, minute=0, second=0)
   ReminderLog.objects.filter(
       sent_at__gte=today_start,
       channel='Email'
   ).count()
   ```

---

### ❌ Scheduler not starting?

**Solution:**

```bash
# Manually start it
python manage.py reminder_scheduler start
```

**Or check for errors:**
```bash
python manage.py runserver --verbosity=3
```

---

### ❌ Emails go to spam?

**Improve deliverability:**

1. **SPF/DKIM Records:** Configure for your domain
2. **Sender Name:** Set in settings.py:
   ```python
   DEFAULT_FROM_EMAIL = 'Estate Link <noreply@yourdomain.com>'
   ```
3. **Professional Template:** The HTML template is already professional
4. **Test First:** Send to yourself first

---

## 📈 Monitor Performance

### Check Logs

```python
from service_fee_management.models import ReminderLog

# Today's logs
from django.utils import timezone
today_start = timezone.now().replace(hour=0, minute=0, second=0)

logs = ReminderLog.objects.filter(
    sent_at__gte=today_start,
    channel='Email'
)

print(f"Emails sent today: {logs.count()}")
print(f"Successful: {logs.filter(delivery_status='sent').count()}")
print(f"Failed: {logs.filter(delivery_status='failed').count()}")
```

### Check Reminder Stats

```python
from service_fee_management.models import Reminder

for reminder in Reminder.objects.filter(reminder_type='Scheduled'):
    print(f"{reminder.reminder_name}:")
    print(f"  Total sent: {reminder.total_sent}")
    print(f"  Last sent: {reminder.last_sent}")
```

---

## 🎓 Example Scenarios

### Scenario 1: Simple Due Date Reminder

**Goal:** Send email 1 day before payment is due

```python
Reminder.objects.create(
    reminder_name="Payment Due Tomorrow",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["1 day before due"],
    audience="All Towers",
    message_preview="Dear {resident_name}, your payment of ৳{amount} is due tomorrow ({due_date})."
)
```

---

### Scenario 2: Multi-Stage Escalation

**Goal:** Send multiple reminders as payment becomes overdue

```python
Reminder.objects.create(
    reminder_name="Payment Escalation",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=[
        "1 day before due",      # Gentle reminder
        "On due date",            # Due today
        "3 days after due",       # First overdue notice
        "7 days after due",       # Second overdue notice
        "14 days after due"       # Final notice
    ],
    audience="All Towers",
    message_preview="""Dear {resident_name},

Your service fee for {service_period} requires your attention.

Outstanding Amount: ৳{amount}
Due Date: {due_date}
Unit: {unit_name}, {tower_name}

Please make your payment as soon as possible.

Thank you,
Estate Link Management"""
)
```

---

### Scenario 3: Overdue Only

**Goal:** Only remind those already overdue (not send before due date)

```python
Reminder.objects.create(
    reminder_name="Overdue Accounts Only",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["3 days after due", "7 days after due"],
    audience="Overdue Only",  # ← Only overdue
    message_preview="""URGENT: Your payment is overdue!

Amount: ৳{amount}
Was due: {due_date}

Please pay immediately to avoid penalties."""
)
```

---

### Scenario 4: Specific Tower

**Goal:** Send reminders only to Tower A

```python
from towers.models import Tower

tower_a = Tower.objects.get(tower_name="Tower A")

Reminder.objects.create(
    reminder_name="Tower A Reminder",
    reminder_type="Scheduled",
    status="Active",
    email=True,
    send_when=["1 day before due"],
    audience="Specific Tower",
    specific_target=str(tower_a.id),  # ← Tower ID
    message_preview="Dear Tower A resident, your payment is due tomorrow."
)
```

---

## 🔧 Advanced Configuration

### Change Check Interval

Default is 5 minutes. To change:

Edit `scheduler.py`:
```python
def __init__(self):
    self.running = False
    self.thread = None
    self.check_interval = 600  # 10 minutes (600 seconds)
```

### Custom Email Template

Edit `_generate_reminder_html()` in `scheduler.py` to customize the HTML design.

### Add More Variables

Edit `_send_single_email()` in `scheduler.py`:

```python
# Add new variable
message = message.replace('{custom_var}', 'Custom Value')
```

Then use in template:
```
Dear {resident_name},
{custom_var}
```

---

## ✅ Checklist

Before going live, verify:

- [ ] Email settings configured in `settings.py`
- [ ] Gmail App Password generated (if using Gmail)
- [ ] Units have `primary_email` or `secondary_email`
- [ ] At least one reminder created with:
  - [ ] reminder_type = "Scheduled"
  - [ ] status = "Active"  
  - [ ] email = True
  - [ ] send_when = valid timing rules
- [ ] Billings exist in database
- [ ] Billings have correct due_dates
- [ ] Scheduler started (check with `reminder_scheduler status`)
- [ ] Test run completed successfully

---

## 🎉 You're Done!

The system will now:
1. ✅ Check for reminders every 5 minutes
2. ✅ Find billings matching timing rules
3. ✅ Send emails to primary & secondary contacts
4. ✅ Log all activity in ReminderLog table
5. ✅ Update reminder statistics

**Completely automated. No manual intervention needed!** 🚀

---

## 📞 Need Help?

1. Run diagnostic: `python manage.py test_scheduler`
2. Check logs in console
3. Verify ReminderLog table for delivery status
4. Review comprehensive docs: `REMINDER_SCHEDULER_DOCS.md`

**Happy automating! 🎊**
