# 📊 System Architecture Diagram

```
╔════════════════════════════════════════════════════════════════════════╗
║                         DJANGO SERVER STARTUP                           ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║         ServiceFeeManagementConfig.ready()                             ║
║         - Called when app initializes                                  ║
║         - Checks if runserver (not migrations)                         ║
║         - Calls start_scheduler()                                      ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║                    REMINDER SCHEDULER (scheduler.py)                    ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  Main Background Thread (Daemon)                                 │  ║
║  │  - Runs continuously                                             │  ║
║  │  - Check interval: 5 minutes (300 seconds)                       │  ║
║  │  - Non-blocking (doesn't affect server performance)              │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                     Every 5 minutes ▼
                                  
╔════════════════════════════════════════════════════════════════════════╗
║                    PROCESS SCHEDULED REMINDERS                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  1. Query Database for Active Scheduled Reminders                │  ║
║  │     WHERE:                                                        │  ║
║  │     - reminder_type = 'Scheduled'                                 │  ║
║  │     - status = 'Active'                                           │  ║
║  │     - email = True                                                │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║                FOR EACH REMINDER → FOR EACH TIMING RULE                 ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  Timing Rule Examples:                                           │  ║
║  │  • "1 day before due"                                            │  ║
║  │  • "On due date"                                                 │  ║
║  │  • "3 days after due"                                            │  ║
║  │                                                                   │  ║
║  │  Parse & Calculate Target Date:                                  │  ║
║  │  Today = Nov 5, 2025                                             │  ║
║  │  Rule: "1 day before due"                                        │  ║
║  │  → Find billings where due_date = Nov 6, 2025                    │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║                     FIND MATCHING BILLINGS                              ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  Query ServiceFeeBilling:                                        │  ║
║  │  - due_date = calculated_target_date                             │  ║
║  │  - service_status != 'paid'                                      │  ║
║  │  - Apply audience filter (All Towers, Specific Tower, etc.)      │  ║
║  │  - Ensure unit has primary_email or secondary_email              │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║              FOR EACH MATCHING BILLING → SEND EMAILS                    ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  Step 1: Check Duplicate Prevention                              │  ║
║  │  - Query ReminderLog for today                                   │  ║
║  │  - If already sent today → SKIP                                  │  ║
║  │                                                                   │  ║
║  │  Step 2: Get Recipients                                          │  ║
║  │  - billing.unit.primary_email → recipient_1                      │  ║
║  │  - billing.unit.secondary_email → recipient_2                    │  ║
║  │                                                                   │  ║
║  │  Step 3: Send Emails (Asynchronously)                            │  ║
║  │  ┌──────────────────────────────────────────────────────┐        │  ║
║  │  │  Thread 1 → Send to primary_email                    │        │  ║
║  │  │  Thread 2 → Send to secondary_email                  │        │  ║
║  │  │  (Both run in parallel, non-blocking)                │        │  ║
║  │  └──────────────────────────────────────────────────────┘        │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║                    EMAIL SENDING (Per Thread)                           ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  1. Personalize Message                                          │  ║
║  │     - Replace {resident_name} → "John Doe"                       │  ║
║  │     - Replace {unit_name} → "A-101"                              │  ║
║  │     - Replace {tower_name} → "Tower A"                           │  ║
║  │     - Replace {amount} → "5000"                                  │  ║
║  │     - Replace {due_date} → "06-Nov-2025"                         │  ║
║  │     - Replace {service_period} → "November 2025"                 │  ║
║  │                                                                   │  ║
║  │  2. Generate HTML Email                                          │  ║
║  │     - Professional template                                      │  ║
║  │     - Billing details table                                      │  ║
║  │     - Estate Link branding                                       │  ║
║  │                                                                   │  ║
║  │  3. Send via SMTP                                                │  ║
║  │     - Django send_mail()                                         │  ║
║  │     - Uses settings.py email config                              │  ║
║  │     - Gmail / Custom SMTP                                        │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
╔════════════════════════════════════════════════════════════════════════╗
║                         LOGGING & TRACKING                              ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  Create ReminderLog Entry:                                       │  ║
║  │  - reminder_id                                                   │  ║
║  │  - recipient (Member)                                            │  ║
║  │  - unit                                                          │  ║
║  │  - channel = 'Email'                                             │  ║
║  │  - message_content                                               │  ║
║  │  - delivery_status = 'sent' or 'failed'                          │  ║
║  │  - sent_at = timestamp                                           │  ║
║  │  - error_message (if failed)                                     │  ║
║  │                                                                   │  ║
║  │  Update Reminder Statistics:                                     │  ║
║  │  - reminder.total_sent += 1                                      │  ║
║  │  - reminder.last_sent = now()                                    │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═════════════════════════════════╦══════════════════════════════════════╝
                                  ║
                                  ▼
                        Wait 5 minutes...
                                  ║
                                  ▼
                          (Loop back to top)
```

---

## 🔄 Threading Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DJANGO MAIN PROCESS                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  Main Scheduler Thread (Daemon)                 │ │
│  │                                                                 │ │
│  │  while True:                                                    │ │
│  │      process_reminders()                                        │ │
│  │      sleep(300)  # 5 minutes                                    │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  For billing #1:                                         │  │ │
│  │  │  ┌────────────────────────────────────────────────────┐  │  │ │
│  │  │  │ Email Thread 1 (Primary Contact)   │              │  │  │ │
│  │  │  │ • Personalize message               │  Runs in     │  │  │ │
│  │  │  │ • Generate HTML                     │  Parallel    │  │  │ │
│  │  │  │ • Send email                        │              │  │  │ │
│  │  │  │ • Create log                        │              │  │  │ │
│  │  │  └────────────────────────────────────────────────────┘  │  │ │
│  │  │                                                           │  │ │
│  │  │  ┌────────────────────────────────────────────────────┐  │  │ │
│  │  │  │ Email Thread 2 (Secondary Contact) │              │  │  │ │
│  │  │  │ • Personalize message               │  Runs in     │  │  │ │
│  │  │  │ • Generate HTML                     │  Parallel    │  │  │ │
│  │  │  │ • Send email                        │              │  │  │ │
│  │  │  │ • Create log                        │              │  │  │ │
│  │  │  └────────────────────────────────────────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  For billing #2:                                         │  │ │
│  │  │  [Similar email threads...]                              │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Django Server continues normal operation...                        │
│  • Handling HTTP requests                                           │
│  • Serving API endpoints                                            │
│  • Processing user actions                                          │
│  (All unaffected by background scheduler)                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📅 Timing Rule Calculation Examples

### Example 1: "1 day before due"

```
Today's Date: November 5, 2025
Timing Rule: "1 day before due"

Calculation:
  target_date = today + 1 day
  target_date = November 6, 2025

Query:
  SELECT * FROM service_fee_billings
  WHERE due_date = '2025-11-06'
  AND service_status != 'paid'

Result:
  → Billings due on Nov 6 will receive reminder today
```

### Example 2: "3 days after due"

```
Today's Date: November 5, 2025
Timing Rule: "3 days after due"

Calculation:
  target_date = today - 3 days
  target_date = November 2, 2025

Query:
  SELECT * FROM service_fee_billings
  WHERE due_date = '2025-11-02'
  AND service_status != 'paid'

Result:
  → Billings that were due on Nov 2 (now 3 days overdue) 
    will receive reminder today
```

### Example 3: "On due date"

```
Today's Date: November 5, 2025
Timing Rule: "On due date"

Calculation:
  target_date = today
  target_date = November 5, 2025

Query:
  SELECT * FROM service_fee_billings
  WHERE due_date = '2025-11-05'
  AND service_status != 'paid'

Result:
  → Billings due today will receive reminder
```

---

## 🎯 Audience Filtering Examples

### All Towers
```python
audience = "All Towers"
# No filter - all unpaid billings match
```

### Specific Tower
```python
audience = "Specific Tower"
specific_target = "3"  # Tower ID

# Additional filter:
WHERE unit.floor.tower_id = 3
```

### Overdue Only
```python
audience = "Overdue Only"

# Additional filter:
WHERE service_status = 'overdue'
```

---

## 💾 Database Flow

```
┌─────────────────┐
│   Reminder      │  reminder_type = 'Scheduled'
│   Model         │  status = 'Active'
└────────┬────────┘  email = True
         │           send_when = ["1 day before due"]
         │
         ▼
┌─────────────────────────────────────────┐
│  Find matching billings:                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ServiceFeeBilling                │  │
│  │  - due_date matches timing rule   │  │
│  │  - service_status != 'paid'       │  │
│  │  - links to Unit                  │  │
│  └───────────┬───────────────────────┘  │
└─────────────┼───────────────────────────┘
              │
              ▼
     ┌────────────────┐
     │   Unit Model   │
     │                │
     │  primary_email ───────► Send Email
     │  primary_name  │
     │                │
     │  secondary_email ─────► Send Email
     │  secondary_name │
     └────────────────┘
              │
              ▼
     ┌────────────────┐
     │  ReminderLog   │  Created for each email
     │                │  - Tracks delivery
     │  reminder_id   │  - Prevents duplicates
     │  unit_id       │  - Audit trail
     │  channel       │
     │  sent_at       │
     │  status        │
     └────────────────┘
```

---

## ✅ Complete Workflow Example

**Scenario:** Monthly payment reminder

```
1. SETUP (One-time)
   ├─ Create Reminder:
   │  ├─ name: "Monthly Payment Reminder"
   │  ├─ type: "Scheduled"
   │  ├─ status: "Active"
   │  ├─ email: True
   │  ├─ send_when: ["1 day before due"]
   │  └─ audience: "All Towers"
   │
   └─ Configure Units:
      ├─ Unit A-101:
      │  ├─ primary_email: "john@example.com"
      │  └─ primary_name: "John Doe"
      └─ Unit A-102:
         ├─ primary_email: "jane@example.com"
         └─ primary_name: "Jane Smith"

2. BILLING CREATED
   ├─ Unit A-101 billing for November 2025
   │  ├─ billing_amount: 5000 TK
   │  ├─ due_date: 2025-11-06
   │  └─ service_status: 'due'
   │
   └─ Unit A-102 billing for November 2025
      ├─ billing_amount: 5000 TK
      ├─ due_date: 2025-11-06
      └─ service_status: 'due'

3. SCHEDULER RUNS (Nov 5, 2025 at 10:00 AM)
   ├─ Get reminders (finds "Monthly Payment Reminder")
   ├─ Parse timing rule: "1 day before due"
   ├─ Calculate target: tomorrow = Nov 6
   ├─ Find billings: 2 billings found
   │  ├─ Billing #1 (Unit A-101)
   │  └─ Billing #2 (Unit A-102)
   │
   └─ Send emails:
      ├─ Thread 1: john@example.com
      │  ├─ Personalize message
      │  ├─ Generate HTML
      │  ├─ Send via SMTP
      │  └─ Create ReminderLog
      │
      └─ Thread 2: jane@example.com
         ├─ Personalize message
         ├─ Generate HTML
         ├─ Send via SMTP
         └─ Create ReminderLog

4. RESULT
   ├─ 2 emails sent successfully
   ├─ 2 ReminderLog entries created
   ├─ Reminder.total_sent = 2
   ├─ Reminder.last_sent = 2025-11-05 10:00:00
   └─ Next check in 5 minutes (10:05 AM)

5. DUPLICATE PREVENTION (Nov 5, 2025 at 10:05 AM)
   ├─ Scheduler runs again
   ├─ Finds same billings
   └─ Checks ReminderLog:
      ├─ Already sent today? YES
      └─ SKIP (no duplicate email sent)
```

This ensures emails are only sent once per day per billing! 🎯
