#!/usr/bin/env python
"""Clean 2026-01 data and regenerate to test the fix"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import (
    ServiceFeeGenerationConfig, 
    ServiceFeePayment,
    ServiceFeePaymentLatePenaltyTier
)

print("\n" + "="*60)
print("CLEANUP: Deleting existing 2026-01 data...")
print("="*60)

# Delete configs first (might have FK constraints)
configs = ServiceFeeGenerationConfig.objects.filter(year=2026, month=1)
print(f"\nDeleting {configs.count()} configs...")
configs.delete()

# Delete penalty tiers
tiers_qs = ServiceFeePaymentLatePenaltyTier.objects.filter(
    payment__service_period_year=2026,
    payment__service_period_month=1
)
print(f"Deleting {tiers_qs.count()} penalty tiers...")
tiers_qs.delete()

# Delete payments
payments = ServiceFeePayment.objects.filter(service_period_year=2026, service_period_month=1)
print(f"Deleting {payments.count()} payments...")
payments.delete()

print("\n✅ Cleanup complete! Now test with API call:")
print('{"year":2026,"month":1,"unit_ids":"86","force_regenerate":false,"service_fee_ids":"6","bill_category_ids":"13"}')
print("\n" + "="*60 + "\n")
