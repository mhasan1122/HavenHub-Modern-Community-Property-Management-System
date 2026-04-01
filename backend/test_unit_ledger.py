import os
import django
import json
from django.test import RequestFactory
from django.contrib.auth import get_user_model

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.views import UnitLedgerView
from towers.models import Unit

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()

# Find a unit that has some vouchers
unit = Unit.objects.first()
if not unit:
    print("No units found")
    exit()

print(f"Testing UnitLedgerView for Unit: {unit.unit_name} (ID: {unit.id})")

factory = RequestFactory()
request = factory.get(f'/api/service-fee-management/unit-ledger/?unit_id={unit.id}')
request.user = user

view = UnitLedgerView.as_view()
response = view(request)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.data
    print(f"Success: {data['success']}")
    print(f"Count: {data['pagination']['total_count']}")
    if data['data']:
        print("First Voucher details:")
        v = data['data'][0]
        print(f"  Voucher: {v['voucher_number']}")
        print(f"  Type: {v['type']}")
        print(f"  Unit DR: {v['unit_dr']}")
        print(f"  Unit CR: {v['unit_cr']}")
        print(f"  Details Count: {len(v['details'])}")
else:
    print(f"Error: {response.data}")
