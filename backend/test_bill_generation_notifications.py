#!/usr/bin/env python
"""
Test script to generate bills and verify all eligible members receive the "Monthly Bills Generated" notification.

To run:
    cd backend
    python3 manage.py shell < test_bill_generation_notifications.py
"""

from service_fee_management.utils.service_fee_generator import generate_service_fees
from notifications.models import Notification
from user.models import Member
from datetime import datetime
import json

print("\n" + "="*100)
print("TEST: Bill Generation and Notification Recipients")
print("="*100 + "\n")

# Step 1: Get eligible members BEFORE generating bills
print("[STEP 1] Get eligible members for bill issued notifications...")
print("-" * 100)

REQUIRED_PERMISSIONS = [40, 41, 66, 67, 68]
eligible_members_before = []

org_members = Member.objects.filter(is_org_member=True).order_by('id')
for member in org_members:
    try:
        member_permission_ids = member.get_permission_ids()
        if all(perm_id in member_permission_ids for perm_id in REQUIRED_PERMISSIONS):
            eligible_members_before.append(member)
            print(f"  ✅ {member.full_name} (ID: {member.id}) - ELIGIBLE")
    except Exception as e:
        print(f"  ❌ {member.full_name} (ID: {member.id}) - ERROR: {e}")

print(f"\nTotal eligible members: {len(eligible_members_before)}\n")

# Step 2: Get the current user (who will generate bills)
print("[STEP 2] Determine bill generator...")
print("-" * 100)

# Get first eligible member as the bill generator
bill_generator = eligible_members_before[0] if eligible_members_before else None

if bill_generator:
    print(f"  ✅ Bill generator: {bill_generator.full_name} (ID: {bill_generator.id})\n")
else:
    print("  ❌ No eligible members to generate bills. Exiting.\n")
    exit()

# Step 3: Count existing "Monthly Bills Generated" notifications
print("[STEP 3] Check existing 'Monthly Bills Generated' notifications...")
print("-" * 100)

# Get the latest notification
existing_notif_count = Notification.objects.filter(
    notification_type__code='service_fee_bills_generated'
).count()

print(f"  Current count: {existing_notif_count} notifications\n")

# Step 4: Generate bills for a specific month (e.g., April 2026)
print("[STEP 4] Generating bills for April 2026...")
print("-" * 100)

year = 2026
month = 4

# Get a sample service fee
from service_fee_management.models import ServiceFee
service_fees = ServiceFee.objects.filter(is_active=True)[:1]

if not service_fees.exists():
    print("  ❌ No active service fees found. Cannot generate bills.\n")
    exit()

service_fee = service_fees.first()
print(f"  Using Service Fee: {service_fee.creator_name} - BDT {service_fee.fee_amount} (ID: {service_fee.id})")

# Call generate_service_fees with the bill generator
try:
    result = generate_service_fees(
        year=year,
        month=month,
        service_fee_ids=[service_fee.id],
        created_by=bill_generator.id  # Pass the bill generator
    )
    
    print(f"  Generated: {result.get('created_count', 0)} new bills")
    print(f"  Regenerated: {result.get('regenerated_count', 0)} bills")
    print(f"  Success: {result.get('success', False)}\n")
    
except Exception as e:
    print(f"  ❌ Error generating bills: {e}\n")
    import traceback
    traceback.print_exc()
    exit()

# Step 5: Check "Monthly Bills Generated" notifications AFTER generation
print("[STEP 5] Check 'Monthly Bills Generated' notifications AFTER bill generation...")
print("-" * 100)

# Get notifications for this month
notifications = Notification.objects.filter(
    notification_type__code='service_fee_bills_generated'
).order_by('-created_at')

# Get only the latest ones (after our generation)
new_notifications = []
for notif in notifications[:20]:  # Check last 20
    try:
        metadata = notif.metadata or {}
        if metadata.get('service_period_year') == year and metadata.get('service_period_month') == month:
            new_notifications.append(notif)
    except:
        pass

print(f"  Total 'Monthly Bills Generated' notifications: {Notification.objects.filter(notification_type__code='service_fee_bills_generated').count()}")
print(f"  Notifications for {year}-{month:02d}: {len(new_notifications)}\n")

if new_notifications:
    print("  NOTIFICATION RECIPIENTS:")
    print("  " + "-" * 96)
    print(f"  {'Member ID':<12} {'Member Name':<35} {'Status':<15}")
    print("  " + "-" * 96)
    
    recipients_received = set()
    for notif in new_notifications:
        recipient = notif.recipient
        recipients_received.add(recipient.id)
        is_generator = "❌ (Generator)" if recipient.id == bill_generator.id else "✅"
        print(f"  {recipient.id:<12} {recipient.full_name:<35} {is_generator:<15}")
    
    print("  " + "-" * 96 + "\n")
    
    # Compare with eligible members
    print("  ANALYSIS:")
    print("  " + "-" * 96)
    
    eligible_ids = set(m.id for m in eligible_members_before)
    received_ids = recipients_received
    
    print(f"  Eligible members: {len(eligible_ids)}")
    print(f"  Members who received notifications: {len(received_ids)}")
    print(f"  Expected (eligible - generator): {len(eligible_ids - {bill_generator.id})}\n")
    
    missing = eligible_ids - {bill_generator.id} - received_ids
    extra = received_ids - (eligible_ids - {bill_generator.id})
    
    if missing:
        print(f"  ❌ MISSING (eligible but NO notification):")
        for member_id in missing:
            member = Member.objects.get(id=member_id)
            print(f"     • {member.full_name} (ID: {member_id})")
    
    if extra:
        print(f"  ⚠️  EXTRA (NOT eligible but got notification):")
        for member_id in extra:
            member = Member.objects.get(id=member_id)
            print(f"     • {member.full_name} (ID: {member_id})")
    
    if not missing and not extra and bill_generator.id not in received_ids:
        print(f"  ✅ CORRECT: All eligible members received notifications")
        print(f"  ✅ CORRECT: Bill generator ({bill_generator.full_name}) was excluded")
    
    print()
else:
    print("  ❌ No 'Monthly Bills Generated' notifications found!\n")

# Step 6: Check individual bill notifications (for community members)
print("[STEP 6] Check individual 'Service Fee Bill Issued' notifications...")
print("-" * 100)

bill_notifs = Notification.objects.filter(
    notification_type__code='service_fee_bill_issued'
).order_by('-created_at')[:10]

print(f"  Total 'Service Fee Bill Issued' notifications: {Notification.objects.filter(notification_type__code='service_fee_bill_issued').count()}")
print(f"  Recent notifications:\n")

for notif in bill_notifs:
    metadata = notif.metadata or {}
    recipient = notif.recipient
    print(f"  • {recipient.full_name} (ID: {recipient.id})")
    print(f"    Bill: {metadata.get('bill_number', 'N/A')} for {metadata.get('unit_name', 'N/A')}")
    print(f"    Created: {notif.created_at}\n")

print("="*100 + "\n")
