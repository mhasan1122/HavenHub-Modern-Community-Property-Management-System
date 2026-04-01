#!/usr/bin/env python
"""
Django management-like script to check who will receive bill issued notifications.

This script:
1. Lists all organization members
2. Shows which permissions each member has
3. Highlights which members have ALL 5 required billing management permissions
4. Would receive bill issued notifications

To run:
    cd backend
    python manage.py shell < check_bill_notification_recipients.py
    
Or from Django shell:
    exec(open('check_bill_notification_recipients.py').read())
"""

from user.models import Member
from django.db.models import Q

# Define all required permissions for bill issued notifications
REQUIRED_PERMISSIONS = [
    40,  # PERMISSION_VIEW_SERVICE_FEE_OVERVIEW
    41,  # PERMISSION_VIEW_UNIT_PAYMENT_HISTORY
    66,  # PERMISSION_VIEW_BILLING_MANAGEMENT
    67,  # PERMISSION_ADD_BILLING_MANAGEMENT
    68,  # PERMISSION_EDIT_BILLING_MANAGEMENT
]

PERMISSION_NAMES = {
    40: "View Service Fee Overview",
    41: "View Unit Payment History",
    66: "View Billing Management",
    67: "Add Billing Management",
    68: "Edit Billing Management",
}

print("\n" + "="*100)
print("BILL ISSUED NOTIFICATION RECIPIENTS CHECK")
print("="*100 + "\n")

# Get all organization members
org_members = Member.objects.filter(is_org_member=True).order_by('id')

if not org_members.exists():
    print("❌ No organization members found!")
    exit()

print(f"Total organization members: {len(org_members)}\n")

# Track results
members_eligible = []
members_ineligible = []

print("-" * 100)
print(f"{'Member ID':<10} {'Full Name':<30} {'Status':<15} {'Permissions':<45}")
print("-" * 100)

for member in org_members:
    try:
        member_permission_ids = member.get_permission_ids()
        
        # Check if member has ALL required permissions
        has_all = all(perm_id in member_permission_ids for perm_id in REQUIRED_PERMISSIONS)
        
        # Get list of required permissions they have
        has_perms = [p for p in REQUIRED_PERMISSIONS if p in member_permission_ids]
        missing_perms = [p for p in REQUIRED_PERMISSIONS if p not in member_permission_ids]
        
        status = "✅ ELIGIBLE" if has_all else "❌ INELIGIBLE"
        
        perm_display = f"Has {len(has_perms)}/5 required"
        
        print(f"{member.id:<10} {member.full_name:<30} {status:<15} {perm_display:<45}")
        
        if has_all:
            members_eligible.append(member)
        else:
            members_ineligible.append((member, missing_perms))
    
    except Exception as e:
        print(f"{member.id:<10} {member.full_name:<30} {'❌ ERROR':<15} Error: {str(e)[:45]}")

print("-" * 100 + "\n")

# Summary
print("SUMMARY")
print("-" * 100)
print(f"✅ Members ELIGIBLE for bill issued notifications: {len(members_eligible)}")
print(f"❌ Members INELIGIBLE for bill issued notifications: {len(members_ineligible)}\n")

if members_eligible:
    print("ELIGIBLE MEMBERS (will receive notifications):")
    print("-" * 100)
    for member in members_eligible:
        print(f"  • {member.full_name} (ID: {member.id}, Email: {member.user.email})")
    print()

if members_ineligible:
    print("INELIGIBLE MEMBERS (will NOT receive notifications):")
    print("-" * 100)
    for member, missing_perms in members_ineligible:
        perm_names = [PERMISSION_NAMES.get(p, f"Unknown({p})") for p in missing_perms]
        print(f"  • {member.full_name} (ID: {member.id})")
        print(f"    Missing permissions: {', '.join(perm_names)}")
    print()

print("\nREQUIRED PERMISSIONS FOR BILL ISSUED NOTIFICATIONS:")
print("-" * 100)
for perm_id in REQUIRED_PERMISSIONS:
    perm_name = PERMISSION_NAMES.get(perm_id, f"Unknown({perm_id})")
    print(f"  • Permission {perm_id}: {perm_name}")

print("\nNOTE: Members must have ALL 5 permissions (AND logic) to receive notifications.")
print("="*100 + "\n")
