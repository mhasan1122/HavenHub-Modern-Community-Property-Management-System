import os, sys, types

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
fake = types.ModuleType('weasyprint')
fake.HTML = type('H', (object,), {})
sys.modules['weasyprint'] = fake

import django
django.setup()

from django.db import connection
c = connection.cursor()
c.execute("SELECT id, bill_number, service_status FROM service_fee_management_servicefeegenerate WHERE bill_number=%s", ['BILL-2025-12-00001'])
rows = c.fetchall()
print("Results:", rows)

if rows:
    bill_id = rows[0][0]
    print(f"Found bill ID: {bill_id}")
