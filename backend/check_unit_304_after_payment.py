import os
import sys
import django

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment, AdvancePayment, PayStationTransactionMapping
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
print("🏢 PAYMENT TEST TOWER - UNIT 304 (After ৳29,000 Payment)")
print("=" * 80)

unit = payments.first().unit
tower = unit.floor.tower
service_fee = payments.first().service_fee

print(f"\n📍 Tower: {tower.tower_name}")
print(f"📍 Unit: {unit.unit_name}")
print(f"💰 Monthly Fee: ৳{service_fee.fee_amount}")

print("\n" + "=" * 80)
print("📅 PAYMENT STATUS (After ৳29,000 Payment)")
print("=" * 80)

total_due = 0
total_paid = 0

for payment in payments:
    month_name = month_names[payment.service_period_month]
    year = payment.service_period_year
    status = payment.service_status
    amount = payment.amount
    remaining = payment.remaining_amount
    paid_amount = float(amount) - float(remaining)
    
    status_emoji = {
        'paid': '✅',
        'partial': '⚠️',
        'due': '❌',
        'overdue': '🔴'
    }.get(status, '❓')
    
    print(f"\n{status_emoji} {month_name} {year}:")
    print(f"   Total Bill: ৳{amount}")
    print(f"   Paid: ৳{paid_amount:.2f}")
    print(f"   Remaining: ৳{remaining}")
    print(f"   Status: {status.upper()}")
    
    if remaining > 0:
        total_due += float(remaining)
    total_paid += paid_amount

# Check for advance payments
advances = AdvancePayment.objects.filter(unit_id=unit.id)

advance_total = 0
if advances.exists():
    print("\n" + "=" * 80)
    print("💰 ADVANCE PAYMENTS")
    print("=" * 80)
    for adv in advances:
        print(f"\n✅ Advance Payment:")
        print(f"   Amount: ৳{adv.amount}")
        print(f"   Remaining: ৳{adv.remaining_amount}")
        print(f"   Created: {adv.created_at.strftime('%Y-%m-%d %H:%M')}")
        advance_total += float(adv.remaining_amount)

# Check recent transactions
print("\n" + "=" * 80)
print("📝 RECENT TRANSACTIONS (Last 5)")
print("=" * 80)

transactions = PayStationTransactionMapping.objects.filter(
    payment__unit_id=unit.id
).order_by('-created_at')[:5]

if transactions.exists():
    for txn in transactions:
        month_name = month_names[txn.payment.service_period_month]
        year = txn.payment.service_period_year
        print(f"\n💳 Transaction #{txn.id}:")
        print(f"   Month: {month_name} {year}")
        print(f"   Amount: ৳{txn.amount}")
        print(f"   Payment Status: {txn.payment.service_status}")
        print(f"   Date: {txn.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
else:
    print("\n❌ No recent transactions found")

print("\n" + "=" * 80)
print("📊 SUMMARY")
print("=" * 80)
print(f"\n💵 Total Paid: ৳{total_paid:.2f}")
print(f"⚠️  Total Remaining: ৳{total_due:.2f}")
print(f"💰 Advance: ৳{advance_total:.2f}")

print("\n" + "=" * 80)
print("✅ EXPECTED RESULT (For ৳29,000 Payment):")
print("=" * 80)
print(f"""
December 2025: PAID ✅ (৳14,900)
January 2026: PARTIAL ⚠️ (৳14,100 paid, ৳800 remaining)
Advance: ৳0 ❌ (No advance - partial payment exists)
""")

# Verify if the result is correct
dec_payment = payments.filter(service_period_month=12, service_period_year=2025).first()
jan_payment = payments.filter(service_period_month=1, service_period_year=2026).first()

print("=" * 80)
print("🔍 VERIFICATION:")
print("=" * 80)

issues = []

if dec_payment:
    if dec_payment.service_status == 'paid' and dec_payment.remaining_amount == 0:
        print("✅ December 2025: CORRECT (PAID)")
    else:
        print(f"❌ December 2025: INCORRECT (Status: {dec_payment.service_status}, Remaining: {dec_payment.remaining_amount})")
        issues.append("December status incorrect")

if jan_payment:
    expected_jan_remaining = 800
    if jan_payment.service_status == 'partial' and abs(float(jan_payment.remaining_amount) - expected_jan_remaining) < 1:
        print("✅ January 2026: CORRECT (PARTIAL with ৳800 remaining)")
    else:
        print(f"❌ January 2026: INCORRECT (Status: {jan_payment.service_status}, Remaining: {jan_payment.remaining_amount})")
        issues.append(f"January should be PARTIAL with ৳800 remaining, but is {jan_payment.service_status} with ৳{jan_payment.remaining_amount}")

if advance_total == 0:
    print("✅ Advance: CORRECT (No advance created)")
else:
    print(f"❌ Advance: INCORRECT (Found ৳{advance_total} advance, should be ৳0)")
    issues.append("Unexpected advance payment created")

if issues:
    print("\n" + "=" * 80)
    print("🚨 ISSUES FOUND:")
    print("=" * 80)
    for issue in issues:
        print(f"❌ {issue}")
else:
    print("\n" + "=" * 80)
    print("🎉 ALL CHECKS PASSED! Payment distribution is CORRECT!")
    print("=" * 80)
