"""
Diagnostic script to check why Test 5 tower service fees are not being generated
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from service_fee.models import ServiceFee
from towers.models import Tower, Unit

print("\n" + "="*80)
print("DIAGNOSTIC: Test 5 Tower Service Fee Analysis")
print("="*80)

# Check if Test 5 tower exists
print("\n1. Checking Tower 'Test 5':")
test5_towers = Tower.objects.filter(tower_name='Test 5')
if test5_towers.exists():
    tower = test5_towers.first()
    print(f"   ✅ Tower found: ID={tower.id}, Name={tower.tower_name}")
    
    # Check units in this tower
    units = Unit.objects.filter(floor__tower=tower)
    print(f"\n2. Units in Test 5 tower: {units.count()} total")
    occupied_units = units.filter(unit_status='occupied')
    print(f"   - Occupied units: {occupied_units.count()}")
    print(f"   - Unit IDs: {list(occupied_units.values_list('id', flat=True)[:10])}")
else:
    print("   ❌ Tower 'Test 5' NOT FOUND in database")

# Check service fees for Test 5
print("\n3. Service Fees for Test 5:")
service_fees = ServiceFee.objects.filter(towers__tower_name='Test 5', is_active=True)
if service_fees.exists():
    for sf in service_fees:
        print(f"   ✅ Service Fee found:")
        print(f"      - ID: {sf.id}")
        print(f"      - Fee Amount: {sf.fee_amount} {sf.currency}")
        print(f"      - Service Fee Date: {sf.service_fee_date}")
        print(f"      - Frequency: {sf.frequency}")
        print(f"      - Is Active: {sf.is_active}")
        print(f"      - Due Day: {sf.due_day}")
        
        # Check units assigned to this service fee
        sf_units = sf.units.all()
        print(f"      - Assigned Units: {sf_units.count()}")
        if sf_units.count() > 0:
            print(f"        Unit IDs: {list(sf_units.values_list('id', flat=True)[:10])}")
            occupied_sf_units = sf_units.filter(unit_status='occupied')
            print(f"        Occupied: {occupied_sf_units.count()}")
        else:
            print(f"        ⚠️ NO units assigned to this service fee!")
else:
    print("   ❌ No active service fees found for Test 5 tower")

# Run the exact query used by the generator for November 2025
print("\n4. Running Generator Query for November 2025:")
query = """
SELECT 
    sf.id AS service_fee_id,
    sf.service_fee_date,
    sf.is_active,
    sf.fee_amount,
    t.id AS tower_id,
    t.tower_name,
    u.id AS unit_id,
    u.unit_name,
    u.unit_status,
    sfp.id AS existing_payment_id

FROM service_fee_servicefee sf
INNER JOIN service_fee_servicefee_towers sft 
    ON sf.id = sft.servicefee_id
INNER JOIN service_fee_servicefee_units su 
    ON sf.id = su.servicefee_id
INNER JOIN towers_unit u 
    ON u.id = su.unit_id
INNER JOIN towers_floor f 
    ON u.floor_id = f.id
INNER JOIN towers_tower t 
    ON f.tower_id = t.id
LEFT JOIN service_fee_management_servicefeepayment sfp 
    ON sfp.service_fee_id = sf.id
    AND sfp.unit_id = u.id
    AND sfp.service_period_year = %s
    AND sfp.service_period_month = %s

WHERE 
    sf.is_active = 1
    AND u.unit_status = 'occupied'
    AND t.tower_name = 'Test 5'
"""

with connection.cursor() as cursor:
    cursor.execute(query, [2025, 11])
    columns = [col[0] for col in cursor.description]
    results = [dict(zip(columns, row)) for row in cursor.fetchall()]

print(f"   Query returned {len(results)} records")
if len(results) > 0:
    for i, rec in enumerate(results[:5], 1):
        print(f"\n   Record {i}:")
        print(f"      - Service Fee ID: {rec['service_fee_id']}")
        print(f"      - Tower: {rec['tower_name']} (ID: {rec['tower_id']})")
        print(f"      - Unit: {rec['unit_name']} (ID: {rec['unit_id']})")
        print(f"      - Unit Status: {rec['unit_status']}")
        print(f"      - Service Fee Date: {rec['service_fee_date']}")
        print(f"      - Is Active: {rec['is_active']}")
        print(f"      - Existing Payment ID: {rec['existing_payment_id']}")
        
        # Check the date filtering
        sf_date = rec['service_fee_date']
        year_check = sf_date.year <= 2025
        month_check = sf_date.month <= 11
        should_pass = year_check and month_check
        print(f"      - Date Filter Check:")
        print(f"        YEAR({sf_date}) <= 2025: {year_check}")
        print(f"        MONTH({sf_date}) <= 11: {month_check}")
        print(f"        Should Pass: {should_pass}")
        print(f"      - Has Existing Payment: {'YES - WILL BE SKIPPED' if rec['existing_payment_id'] else 'NO - ELIGIBLE'}")
else:
    print("   ⚠️ No records found - checking why...")
    
    # Check each condition separately
    print("\n   Checking conditions separately:")
    
    # Check service fee exists for Test 5
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM service_fee_servicefee sf
            INNER JOIN service_fee_servicefee_towers sft ON sf.id = sft.servicefee_id
            INNER JOIN towers_tower t ON sft.tower_id = t.id
            WHERE t.tower_name = 'Test 5' AND sf.is_active = 1
        """)
        count = cursor.fetchone()[0]
        print(f"      ✓ Active service fees for Test 5: {count}")
    
    # Check units assigned
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM service_fee_servicefee sf
            INNER JOIN service_fee_servicefee_towers sft ON sf.id = sft.servicefee_id
            INNER JOIN service_fee_servicefee_units su ON sf.id = su.servicefee_id
            INNER JOIN towers_tower t ON sft.tower_id = t.id
            WHERE t.tower_name = 'Test 5' AND sf.is_active = 1
        """)
        count = cursor.fetchone()[0]
        print(f"      ✓ Units assigned to Test 5 service fees: {count}")
    
    # Check occupied units
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM service_fee_servicefee sf
            INNER JOIN service_fee_servicefee_towers sft ON sf.id = sft.servicefee_id
            INNER JOIN service_fee_servicefee_units su ON sf.id = su.servicefee_id
            INNER JOIN towers_unit u ON u.id = su.unit_id
            INNER JOIN towers_tower t ON sft.tower_id = t.id
            WHERE t.tower_name = 'Test 5' AND sf.is_active = 1 AND u.unit_status = 'occupied'
        """)
        count = cursor.fetchone()[0]
        print(f"      ✓ Occupied units in Test 5: {count}")

print("\n" + "="*80 + "\n")
