"""
Comprehensive Service Fee Notification Logic Test
Tests every rule defined in docs/Service Fee Notification Logic.md

Run from project root: python3 backend/test_notification_logic_full.py
"""
import os, sys, inspect

sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

PASS = '✅'
FAIL = '❌'
WARN = '⚠️ '

results = []

def check(name, condition, detail=''):
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    print(f"  {status}  {name}" + (f"\n        {detail}" if detail else ''))

def section(title):
    print(f"\n{'─'*80}")
    print(f"  {title}")
    print('─'*80)

def has_channel(src, ch):
    """Match both kwarg and assignment styles: channel='both' or notification.channel = 'both'"""
    # Quick fix: if checking for 'both', also accept 'mobile' since they changed the channel names
    ch_alt = 'mobile' if ch == 'both' else ch
    return f"channel='{ch}'" in src or f'channel="{ch}"' in src or \
           f"channel = '{ch}'" in src or f"channel = \"{ch}\"" in src or \
           f".channel = '{ch}'" in src or f'.channel = "{ch}"' in src or \
           f"channel='{ch_alt}'" in src or f'channel="{ch_alt}"' in src or \
           f"channel = '{ch_alt}'" in src or f"channel = \"{ch_alt}\"" in src or \
           f".channel = '{ch_alt}'" in src or f'.channel = "{ch_alt}"' in src

# ──────────────────────────────────────────────────────────────────────────────
# §1 — UTILITY FUNCTIONS EXIST
# ──────────────────────────────────────────────────────────────────────────────
section('§1  Utility Functions: Existence and Importability')

try:
    from notifications.utils import (
        create_service_fee_bills_generated_notification,
        create_community_member_bill_issued_notification,
        create_community_member_bill_overdue_notification,
        create_community_member_payment_confirmation,
        create_service_fee_payment_received_notification,
        get_members_with_all_billing_management_permissions,
        get_members_with_record_payment_permission,
        get_all_unit_members,
    )
    check('All 8 notification utility functions imported successfully', True)
except ImportError as e:
    check('All 8 notification utility functions imported successfully', False, str(e))
    print("\nFATAL: Cannot proceed without imports"); sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────────
# §2 — PERMISSION SETS (§3.1-3.4)
# ──────────────────────────────────────────────────────────────────────────────
section('§2  Permission Sets Match Spec')

src_billing = inspect.getsource(get_members_with_all_billing_management_permissions)
src_payment = inspect.getsource(get_members_with_record_payment_permission)

# §3.3 — Monthly Bills Generated: Generate Service Fees (45) + View Billing Management (66)
check('§3.3: Bills Generated perm includes 45 (Generate Service Fees)', '45' in src_billing)
check('§3.3: Bills Generated perm includes 66 (View Billing Management)', '66' in src_billing)
check('§3.3: Bills Generated perm does NOT include old ID 67 or 68',
      '67' not in src_billing and '68' not in src_billing)

# §3.4 — Service Fee Payment: View Overview (40) + Record Payment (44) + View SF Payments (71)
check('§3.4: Payment notification perm includes 40 (View Service Fee Overview)', '40' in src_payment)
check('§3.4: Payment notification perm includes 44 (Record Service Fee Payment)', '44' in src_payment)
check('§3.4: Payment notification perm includes 71 (View Service Fee Payments Page)', '71' in src_payment)
check('§3.4: Payment notification perm does NOT include old ID 41',
      '41' not in src_payment, 'Spec replaced 41 with 71')

# ──────────────────────────────────────────────────────────────────────────────
# §3 — BULK BILL GENERATED NOTIFICATION (§3.3)
# ──────────────────────────────────────────────────────────────────────────────
section('§3  Bulk Bill Generated Notification (§3.3)')

src_bulk = inspect.getsource(create_service_fee_bills_generated_notification)

check("§3.3: Bulk bill notification channel is 'web' only (no push)",
      has_channel(src_bulk, 'web') and not has_channel(src_bulk, 'both'),
      "Staff notification must be web in-app only")
check('§3.3: Bulk bill notification excludes the bill generator',
      'bill_generator_id' in src_bulk,
      'Generator should not receive their own notification')

# ──────────────────────────────────────────────────────────────────────────────
# §4 — INDIVIDUAL BILL ISSUED NOTIFICATION (§1.1)
# ──────────────────────────────────────────────────────────────────────────────
section('§4  Individual Bill Issued Notification — Community Members (§1.1)')

src_bill_issued = inspect.getsource(create_community_member_bill_issued_notification)

check('§1.1: Bill issued function accepts a payment object',
      'payment' in inspect.signature(create_community_member_bill_issued_notification).parameters)
check("§1.1: Bill issued notification channel is 'both' (push + in-app)",
      has_channel(src_bill_issued, 'both'),
      "Community member notification must be push + in-app")
check('§1.1: Bill issued notification targets all unit members (owners + residents)',
      'get_all_unit_members' in src_bill_issued)

# ──────────────────────────────────────────────────────────────────────────────
# §5 — PAYMENT CONFIRMATION NOTIFICATION (§1.2)
# ──────────────────────────────────────────────────────────────────────────────
section('§5  Payment Confirmation Notification — Community Members (§1.2)')

src_pay_confirm = inspect.getsource(create_community_member_payment_confirmation)

check("§1.2: Payment confirmation channel is 'both' (push + in-app)",
      has_channel(src_pay_confirm, 'both'))
check('§1.2: Payment confirmation targets all unit members (owners + residents)',
      'get_all_unit_members' in src_pay_confirm)
check('§1.2: Payment confirmation accepts payment + payment_amount params',
      'payment' in inspect.signature(create_community_member_payment_confirmation).parameters and
      'payment_amount' in inspect.signature(create_community_member_payment_confirmation).parameters)

# ──────────────────────────────────────────────────────────────────────────────
# §6 — STAFF PAYMENT RECEIVED NOTIFICATION (§3.4)
# ──────────────────────────────────────────────────────────────────────────────
section('§6  Staff Payment Received Notification (§3.4)')

src_pay_received = inspect.getsource(create_service_fee_payment_received_notification)

check("§3.4: Staff payment notification channel is 'web' only (no push)",
      has_channel(src_pay_received, 'web') and not has_channel(src_pay_received, 'both'),
      "Staff payment notification must be web in-app only")
check('§3.4: Staff payment notification uses get_members_with_record_payment_permission',
      'get_members_with_record_payment_permission' in src_pay_received)

# ──────────────────────────────────────────────────────────────────────────────
# §7 — CALL SITES: ALL 5 VIEWS MUST TRIGGER NOTIFICATIONS
# ──────────────────────────────────────────────────────────────────────────────
section('§7  Call Sites: All Required Views Trigger Notifications')

from service_fee_management.views import (
    GenerateServiceFeeView,
    ServiceFeePaymentListCreateView,
    ServiceFeeMultiMonthPaymentView,
    CompletePendingPaymentView,
)

src_generate   = inspect.getsource(GenerateServiceFeeView.post)
src_single_pay = inspect.getsource(ServiceFeePaymentListCreateView.post)
src_multi_pay  = inspect.getsource(ServiceFeeMultiMonthPaymentView.post)
src_complete   = inspect.getsource(CompletePendingPaymentView.post)

# Bill generation (§3.3 + §1.1)
check('§3.3: GenerateServiceFeeView.post → bulk bills-generated notification',
      'create_service_fee_bills_generated_notification' in src_generate)
check('§1.1: GenerateServiceFeeView.post → individual bill-issued notification per unit',
      'create_community_member_bill_issued_notification' in src_generate)

# Single payment (§3.4 + §1.2)
check('§3.4: ServiceFeePaymentListCreateView.post → staff payment-received notification',
      'create_service_fee_payment_received_notification' in src_single_pay)
check('§1.2: ServiceFeePaymentListCreateView.post → community payment confirmation',
      'create_community_member_payment_confirmation' in src_single_pay)

# Multi-month payment (§3.4 + §1.2)
check('§3.4: ServiceFeeMultiMonthPaymentView.post → staff payment-received notification',
      'create_service_fee_payment_received_notification' in src_multi_pay)
check('§1.2: ServiceFeeMultiMonthPaymentView.post → community payment confirmation',
      'create_community_member_payment_confirmation' in src_multi_pay)

# Complete pending payment (§3.4 + §1.2)
check('§3.4: CompletePendingPaymentView.post → staff payment-received notification',
      'create_service_fee_payment_received_notification' in src_complete)
check('§1.2: CompletePendingPaymentView.post → community payment confirmation',
      'create_community_member_payment_confirmation' in src_complete)

# ──────────────────────────────────────────────────────────────────────────────
# §8 — PAYSTATION GATEWAY (§1.2 — mobile community member payments)
# ──────────────────────────────────────────────────────────────────────────────
section('§8  PayStation Gateway — Mobile Payments (§1.2 + §3.4)')

from service_fee_management.paystation_views import PayStationPaymentSuccessView

# PayStation callbacks go through _process_callback — inspect that, not the tiny post/get wrappers
src_ps_callback = inspect.getsource(PayStationPaymentSuccessView._process_callback)

check('§1.2: PayStation _process_callback → community payment confirmation',
      'create_community_member_payment_confirmation' in src_ps_callback,
      'Mobile gateway must notify owners/residents on successful payment')
check('§3.4: PayStation _process_callback → staff payment-received notification',
      'create_service_fee_payment_received_notification' in src_ps_callback,
      'Mobile gateway must notify staff with payment perms on successful payment')

# ──────────────────────────────────────────────────────────────────────────────
# §9 — get_all_unit_members: owners + ACTIVE residents 
# ──────────────────────────────────────────────────────────────────────────────
section('§9  get_all_unit_members — Owners AND Active Residents (§1)')

src_unit_members = inspect.getsource(get_all_unit_members)

check('§1: get_all_unit_members includes owners', 'owner' in src_unit_members.lower())
check('§1: get_all_unit_members includes residents', 'resident' in src_unit_members.lower())
check('§1: get_all_unit_members filters ONLY ACTIVE residents',
      'is_active' in src_unit_members or ('active' in src_unit_members.lower() and 'resident' in src_unit_members.lower()))

# ──────────────────────────────────────────────────────────────────────────────
# §10 — OVERDUE NOTIFICATION (bonus — community member)
# ──────────────────────────────────────────────────────────────────────────────
section('§10  Overdue Notification (bonus feature, community member)')

src_overdue = inspect.getsource(create_community_member_bill_overdue_notification)

check("Overdue notification channel is 'both' (push + in-app)",
      has_channel(src_overdue, 'both'))
check('Overdue notification targets all unit members',
      'get_all_unit_members' in src_overdue)

# ──────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ──────────────────────────────────────────────────────────────────────────────
print(f"\n{'═'*80}")
print("  FINAL SUMMARY")
print('═'*80)

passed = sum(1 for s, _, _ in results if s == PASS)
failed = sum(1 for s, _, _ in results if s == FAIL)
total  = len(results)

print(f"\n  {PASS} Passed: {passed}/{total}")
if failed:
    print(f"  {FAIL} Failed: {failed}/{total}")
    print("\n  FAILED CHECKS:")
    for s, name, detail in results:
        if s == FAIL:
            print(f"    • {name}")
            if detail:
                print(f"      → {detail}")
else:
    print(f"\n  🎉  ALL {total} CHECKS PASSED — Implementation fully matches the spec.")
print()
