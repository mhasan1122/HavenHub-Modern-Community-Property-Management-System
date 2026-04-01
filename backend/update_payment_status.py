#!/usr/bin/env python
"""
Fix the payment_result_status for the 600 Tk payment using Django ORM
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling

# Find and update the billing record
billing = ServiceFeeBilling.objects.get(transaction_id='TXN-202602-8EA03194')

print(f"\n{'='*80}")
print(f"UPDATING PAYMENT RESULT STATUS")
print(f"{'='*80}\n")
print(f"Transaction ID: {billing.transaction_id}")
print(f"Current payment_result_status: {billing.payment_result_status}")

# This payment completed the January 2026 bill (13,200 + 600 = 13,800)
billing.payment_result_status = 'full'
billing.save()

print(f"✅ UPDATED payment_result_status to: {billing.payment_result_status}")
print(f"\n{'='*80}\n")

# Verify
billing.refresh_from_db()
print(f"Verified - payment_result_status is now: {billing.payment_result_status}")
