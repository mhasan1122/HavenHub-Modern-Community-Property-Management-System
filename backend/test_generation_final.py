#!/usr/bin/env python
"""Test ServiceFeeGenerationConfig creation after the fix"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import (
    ServiceFeeGenerationConfig, 
    ServiceFeePayment,
    ServiceFee
)

print("\n" + "="*60)
print("TEST: ServiceFeeGenerationConfig for 2026-01")
print("="*60)

# Check configs for 2026-01
configs = ServiceFeeGenerationConfig.objects.filter(year=2026, month=1)
print(f"\nTotal Configs for 2026-01: {configs.count()}")
if configs.exists():
    for c in configs:
        print(f"  - SF ID {c.service_fee_id}: {c.fee_amount} {c.currency}")
        print(f"    Database ID: {c.id}")
else:
    print("  [EMPTY]")

# Check payments for 2026-01
payments = ServiceFeePayment.objects.filter(service_period_year=2026, service_period_month=1)
print(f"\nTotal Payments for 2026-01: {payments.count()}")

# Check payments with generation_config
payments_with_config = payments.filter(generation_config_id__isnull=False)
print(f"  Payments WITH generation_config: {payments_with_config.count()}")

if payments_with_config.exists():
    print("\n  Details:")
    for p in payments_with_config[:5]:  # Show first 5
        print(f"    - Unit {p.unit_id}, SF {p.service_fee_id}: generation_config_id={p.generation_config_id}")

# Check payments without generation_config
payments_without_config = payments.filter(generation_config_id__isnull=True)
print(f"\n  Payments WITHOUT generation_config: {payments_without_config.count()}")

if payments_without_config.exists():
    print("\n  [ISSUE] These payments are missing generation_config:")
    for p in payments_without_config[:5]:  # Show first 5
        print(f"    - Unit {p.unit_id}, SF {p.service_fee_id}")

# Summary
print("\n" + "="*60)
if configs.count() > 0 and payments_with_config.count() > 0:
    print("✅ SUCCESS: Configs created and linked to payments!")
elif configs.count() > 0 and payments.count() > 0 and payments_without_config.count() > 0:
    print("⚠️  PARTIAL: Configs exist but some payments are missing the link")
else:
    print("❌ FAILURE: No configs found")
print("="*60 + "\n")
