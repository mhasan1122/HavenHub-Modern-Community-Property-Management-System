import os
import sys
import django

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment, AdvancePayment
from django.db.models import Sum
from calendar import month_name as month_names

# Find Payment Test Tower, Unit 304
payments = ServiceFeePayment.objects.filter(
    unit__floor__tower__tower_name__icontains='Payment Test',
    unit__unit_name='304'
).order_by('service_period_year', 'service_period_month')

if not payments.exists():
    print("❌ No payments found for Payment Test Tower, Unit 304")
    exit()

print("=" * 80)
print("🏢 PAYMENT TEST TOWER - UNIT 304")
print("=" * 80)

unit = payments.first().unit
tower = unit.floor.tower
service_fee = payments.first().service_fee

print(f"\n📍 Tower: {tower.tower_name}")
print(f"📍 Unit: {unit.unit_name}")
print(f"💰 Monthly Fee: ৳{service_fee.fee_amount}")
print(f"🆔 Unit ID: {unit.id}")
print(f"🆔 Service Fee ID: {service_fee.id}")

print("\n" + "=" * 80)
print("📅 PAYMENT HISTORY (Oldest → Newest)")
print("=" * 80)

total_due = 0
total_paid = 0
months_with_due = []

for payment in payments:
    month_name = month_names[payment.service_period_month]
    year = payment.service_period_year
    status = payment.service_status
    amount = payment.amount
    remaining = payment.remaining_amount
    
    status_emoji = {
        'paid': '✅',
        'partial': '⚠️',
        'due': '❌',
        'overdue': '🔴'
    }.get(status, '❓')
    
    print(f"\n{status_emoji} {month_name} {year}:")
    print(f"   Amount: ৳{amount}")
    print(f"   Status: {status.upper()}")
    print(f"   Remaining: ৳{remaining}")
    
    if remaining > 0:
        total_due += float(remaining)
        months_with_due.append(f"{month_name} {year}")
    else:
        total_paid += float(amount)

# Check for advance payments (AdvancePayment uses different field names)
advances = AdvancePayment.objects.filter(
    unit_id=unit.id
)

advance_total = 0
if advances.exists():
    print("\n" + "=" * 80)
    print("💰 ADVANCE PAYMENTS")
    print("=" * 80)
    for adv in advances:
        print(f"\n✅ Advance Payment:")
        print(f"   Amount: ৳{adv.amount}")
        print(f"   Created: {adv.created_at.strftime('%Y-%m-%d %H:%M')}")
        advance_total += float(adv.amount)

print("\n" + "=" * 80)
print("📊 SUMMARY")
print("=" * 80)
print(f"\n💵 Total Paid: ৳{total_paid:.2f}")
print(f"⚠️  Total Due: ৳{total_due:.2f}")
print(f"💰 Advance: ৳{advance_total:.2f}")
print(f"📌 Current Balance: ৳{total_due:.2f}")

if months_with_due:
    print(f"\n📅 Months with Outstanding Balance:")
    for month in months_with_due:
        print(f"   - {month}")

print("\n" + "=" * 80)
print("🧪 TEST SCENARIOS")
print("=" * 80)

if total_due > 0:
    monthly_fee = float(service_fee.fee_amount)
    
    # Scenario 1: Partial payment
    partial_amount = total_due - 1000
    print(f"\n1️⃣  Partial Payment Test: ৳{partial_amount:.2f}")
    print(f"   Expected: Oldest months paid, last month partial")
    print(f"   Expected Advance: ৳0 (partial exists)")
    
    # Scenario 2: Full payment
    print(f"\n2️⃣  Full Payment Test: ৳{total_due:.2f}")
    print(f"   Expected: All months PAID")
    print(f"   Expected Advance: ৳0 (exact amount)")
    
    # Scenario 3: Overpayment
    over_amount = total_due + 1000
    print(f"\n3️⃣  Overpayment Test: ৳{over_amount:.2f}")
    print(f"   Expected: All months PAID")
    print(f"   Expected Advance: ৳1000 ✅")
else:
    print("\n✅ All payments are up to date!")
    print("\n1️⃣  Advance Payment Test: ৳1000")
    print(f"   Expected: Advance created")

print("\n" + "=" * 80)
