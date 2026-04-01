#!/usr/bin/env python
"""Check raw SQL for advance payment records"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

print('=== RAW SQL QUERY: ADVANCE PAYMENTS ===')
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT id, amount, payment_method_id, status, created_at 
        FROM service_fee_advance_payments 
        ORDER BY id DESC 
        LIMIT 5
    """)
    rows = cursor.fetchall()
    print(f"{'ID':<5} {'Amount':<12} {'PM_ID':<8} {'Status':<12} {'Created'}")
    print("-" * 70)
    for row in rows:
        print(f"{row[0]:<5} {row[1]:<12} {str(row[2]) if row[2] else 'NULL':<8} {row[3]:<12} {row[4]}")
