import sqlite3
import os
import django

# Setup Django  
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'estate_link.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling

# Check model fields
print("=== ServiceFeeBilling Model Fields ===")
for field in ServiceFeeBilling._meta.get_fields():
    print(f"{field.name}: {field.__class__.__name__}")

# Check database columns
print("\n=== service_fee_payment_details Table Columns (from DB) ===")
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('PRAGMA table_info(service_fee_payment_details)')
columns = cursor.fetchall()
for col in columns:
    print(f"{col[1]}: {col[2]}")

# Check if unit_role exists in any billing record
print("\n=== Checking for unit_role in data ===")
cursor.execute("SELECT * FROM service_fee_payment_details LIMIT 1")
row_data = cursor.fetchone()
if row_data:
    cursor.execute("PRAGMA table_info(service_fee_payment_details)")
    col_names = [col[1] for col in cursor.fetchall()]
    print(f"Column names: {col_names}")
    if 'unit_role' in col_names:
        print("✓ unit_role column EXISTS")
    else:
        print("✗ unit_role column DOES NOT EXIST")
else:
    print("No data in table")

conn.close()
