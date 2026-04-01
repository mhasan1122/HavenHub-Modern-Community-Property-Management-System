"""
Test script to verify user4936 access control for service fee units
This tests that units without primary or secondary numbers are properly filtered out
"""

import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from user.models import Member
from towers.models import Unit, Resident
from django.db import connection

def test_user4936_access():
    """Test access control for user4936"""
    
    print("\n" + "="*80)
    print("Testing Access Control for user4936")
    print("="*80 + "\n")
    
    try:
        # Get user4936
        user = User.objects.get(username='user4936')
        member = Member.objects.get(user=user)
        
        print(f"✅ Found User: {user.username}")
        print(f"   Member ID: {member.id}")
        print(f"   General Email: {member.general_email}")
        print(f"   Login Email: {member.login_email}")
        print(f"   General Contact: {member.general_contact}")
        print(f"   Login Contact: {member.login_contact}")
        
        # Collect user's contact info
        user_emails = []
        user_contacts = []
        
        if member.general_email:
            user_emails.append(member.general_email)
        if member.login_email:
            user_emails.append(member.login_email)
        if member.general_contact:
            user_contacts.append(member.general_contact)
        if member.login_contact:
            user_contacts.append(member.login_contact)
        
        print(f"\n📧 User Emails: {user_emails}")
        print(f"📱 User Contacts: {user_contacts}")
        
        # Check resident status
        residents = Resident.objects.filter(
            member_id=member.id,
            is_active=True
        ).select_related('unit', 'unit__floor', 'unit__floor__tower')
        
        print(f"\n🏠 Resident Units ({residents.count()}):")
        for resident in residents:
            unit = resident.unit
            tower = unit.floor.tower
            print(f"   - Tower: {tower.tower_name} (#{tower.tower_number}), Unit: {unit.unit_name}")
            print(f"     Primary Number: {unit.primary_number or 'NONE'}")
            print(f"     Secondary Number: {unit.secondary_number or 'NONE'}")
            print(f"     Primary Email: {unit.primary_email or 'NONE'}")
            print(f"     Secondary Email: {unit.secondary_email or 'NONE'}")
            
            # Check if this unit would pass the new filter
            has_contact = (unit.primary_number and unit.primary_number.strip()) or \
                         (unit.secondary_number and unit.secondary_number.strip())
            
            print(f"     ✅ HAS CONTACT: {has_contact}")
            
            if not has_contact:
                print(f"     ⚠️  WILL BE FILTERED OUT (no primary/secondary number)")
            else:
                # Check if user's contact matches
                contact_match = False
                if user_contacts:
                    for contact in user_contacts:
                        if (unit.primary_number and contact == unit.primary_number) or \
                           (unit.secondary_number and contact == unit.secondary_number):
                            contact_match = True
                            break
                
                if contact_match:
                    print(f"     ✅ WILL BE SHOWN (contact matches)")
                else:
                    print(f"     ❌ WILL BE FILTERED OUT (contact doesn't match)")
        
        # Now test the actual SQL query that the API uses
        print("\n" + "="*80)
        print("Testing Actual SQL Query")
        print("="*80 + "\n")
        
        # Build the WHERE conditions exactly as the API does
        where_conditions = [
            "sf.id IS NOT NULL",
            "u.unit_status = 'occupied'",
            "sf.is_active = 1",
            # NEW: Must have at least one contact number
            "((u.primary_number IS NOT NULL AND u.primary_number != '') OR (u.secondary_number IS NOT NULL AND u.secondary_number != ''))"
        ]
        
        sql_params = []
        
        # Add resident check
        resident_check = "EXISTS (SELECT 1 FROM towers_resident r WHERE r.unit_id = u.id AND r.member_id = %s AND r.is_active = TRUE)"
        sql_params.append(member.id)
        access_conditions = [resident_check]
        
        # Add contact matching conditions
        contact_conditions = []
        for contact in user_contacts:
            contact_conditions.append("(u.primary_number IS NOT NULL AND u.primary_number != '' AND u.primary_number = %s)")
            sql_params.append(contact)
            contact_conditions.append("(u.secondary_number IS NOT NULL AND u.secondary_number != '' AND u.secondary_number = %s)")
            sql_params.append(contact)
        
        if contact_conditions and access_conditions:
            combined_condition = f"({access_conditions[0]} AND ({' OR '.join(contact_conditions)}))"
            where_conditions.append(combined_condition)
        
        where_clause = " AND ".join(where_conditions)
        
        # Test query
        sql = f"""
        SELECT DISTINCT
            u.id AS unit_id,
            u.unit_name,
            t.tower_name,
            t.tower_number,
            u.primary_number,
            u.secondary_number,
            u.primary_email,
            u.secondary_email
        FROM 
            service_fee_servicefee sf
            INNER JOIN service_fee_management_servicefeepayment sfp ON sf.id = sfp.service_fee_id 
            INNER JOIN towers_unit u ON u.id = sfp.unit_id
            INNER JOIN towers_floor f ON u.floor_id = f.id
            INNER JOIN towers_tower t ON f.tower_id = t.id
        WHERE
            {where_clause}
        ORDER BY t.tower_name, u.unit_name
        """
        
        print("SQL Query:")
        print(sql)
        print(f"\nParameters: {sql_params}")
        
        with connection.cursor() as cursor:
            cursor.execute(sql, sql_params)
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        print(f"\n✅ Query returned {len(results)} units:\n")
        for unit in results:
            print(f"   - Tower: {unit['tower_name']} (#{unit['tower_number']}), Unit: {unit['unit_name']}")
            print(f"     Primary Number: {unit['primary_number'] or 'NONE'}")
            print(f"     Secondary Number: {unit['secondary_number'] or 'NONE'}")
        
        if len(results) == 0:
            print("   ⚠️  No units found - this is expected if units don't have contact numbers")
        
        print("\n" + "="*80)
        print("Test Complete")
        print("="*80 + "\n")
        
    except User.DoesNotExist:
        print("❌ User 'user4936' not found")
    except Member.DoesNotExist:
        print("❌ Member for user4936 not found")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_user4936_access()
