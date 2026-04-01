#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeGenerationConfig, ServiceFeePayment

# Check configs for 2026-01
configs = ServiceFeeGenerationConfig.objects.filter(year=2026, month=1)
print(f"[Check] ServiceFeeGenerationConfig for 2026-01: {configs.count()} records")
for c in configs:
    print(f"  - SF {c.service_fee_id}: {c.fee_amount} {c.currency} (ID: {c.id})")

# Check payments for 2026-01
payments = ServiceFeePayment.objects.filter(service_period_year=2026, service_period_month=1)
print(f"\n[Check] ServiceFeePayment for 2026-01: {payments.count()} records")
for p in payments:
    print(f"  - Unit {p.unit_id}, SF {p.service_fee_id}: {p.amount} (generation_config_id: {p.generation_config_id})")

# Check if any payments have generation_config_id set
payments_with_config = payments.filter(generation_config_id__isnull=False)
print(f"\n[Check] Payments WITH generation_config_id: {payments_with_config.count()}")

payments_without_config = payments.filter(generation_config_id__isnull=True)
print(f"[Check] Payments WITHOUT generation_config_id: {payments_without_config.count()}")
