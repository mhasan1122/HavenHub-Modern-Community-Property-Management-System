#!/usr/bin/env python
"""
Test script for Excel bulk upload and email sending functionality
"""
import os
import sys
import django
from io import BytesIO
from datetime import datetime, date

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

import openpyxl
from openpyxl import Workbook
from django.test import RequestFactory
from django.contrib.auth.models import User
from user.models import Member
from towers.models import Tower, Floor, Unit, Owner
from towers.views.owner_views import BulkUploadOwner

def create_test_excel_file():
    """Create a test Excel file with sample owner data"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Owners"
    
    # Headers
    headers = [
        'unit_name', 'tower_name', 'tower_number', 'ownership_percentage',
        'date_of_ownership', 'full_name', 'general_contact', 'delivery_method',
        'general_email', 'nid_number', 'permanent_address', 'present_address',
        'date_of_birth', 'occupation', 'marital_status', 'religion', 'gender'
    ]
    ws.append(headers)
    
    # Test data rows
    test_rows = [
        # Row 1: With delivery_method email (should send email)
        [
            101, 'TestTower', 1, 100, '01-Jan-2020',
            'Test Owner 1', '01712345678', 'mhlimonbdcalling@gmail.com',  # delivery_method
            'testowner1@example.com', None, 'Test Permanent Address',
            'Test Present Address', '01-Jan-1990', 'Engineer', 'Married', 'Islam', 'Male'
        ],
        # Row 2: Without delivery_method (should NOT send email)
        [
            102, 'TestTower', 1, 100, '01-Jan-2021',
            'Test Owner 2', '01712345679', None,  # No delivery_method
            'testowner2@example.com', None, None, None, None, None, None, None, None
        ],
        # Row 3: With different delivery_method email (should send email)
        [
            103, 'TestTower', 1, 50, '01-Jan-2022',
            'Test Owner 3', '01712345680', 'testowner3.delivery@gmail.com',  # delivery_method
            'testowner3@example.com', None, None, None, None, None, None, None, None
        ],
    ]
    
    for row in test_rows:
        ws.append(row)
    
    # Save to BytesIO for testing
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    return excel_file, len(test_rows)

def setup_test_data():
    """Create test tower and units if they don't exist"""
    print("\n" + "="*60)
    print("🔧 Setting up test data...")
    print("="*60)
    
    # Create or get test tower
    tower, created = Tower.objects.get_or_create(
        tower_name='TestTower',
        tower_number=1,
        defaults={
            'description': 'Test Tower for Excel Upload Testing',
            'num_floors': 10,
            'num_units': 100,
            'unit_naming_type': 'Numerical',
            'add_tower_number_to_unit_name': False,
            'units_per_floor': 'Same as Every Floor'
        }
    )
    
    if created:
        print(f"✅ Created test tower: {tower.tower_name} (ID: {tower.id})")
    else:
        print(f"ℹ️  Using existing tower: {tower.tower_name} (ID: {tower.id})")
    
    # Create or get test floor
    floor, created = Floor.objects.get_or_create(
        tower=tower,
        floor_no=1,
        defaults={'number_of_units': 10}
    )
    
    if created:
        print(f"✅ Created test floor: Floor {floor.floor_no} (ID: {floor.id})")
    else:
        print(f"ℹ️  Using existing floor: Floor {floor.floor_no} (ID: {floor.id})")
    
    # Create test units
    units_created = 0
    for unit_name in [101, 102, 103]:
        unit, created = Unit.objects.get_or_create(
            floor=floor,
            unit_name=str(unit_name),
            defaults={
                'unit_status': 'available',
                'status_color': '#FF8682'
            }
        )
        if created:
            units_created += 1
            print(f"✅ Created test unit: {unit_name} (ID: {unit.id})")
    
    if units_created == 0:
        print(f"ℹ️  All test units already exist")
    
    print(f"\n✅ Test data setup complete!")
    return tower, floor

def cleanup_test_data():
    """Clean up test data"""
    print("\n" + "="*60)
    print("🧹 Cleaning up test data...")
    print("="*60)
    
    # Delete test owners
    test_owners = Owner.objects.filter(
        member__full_name__startswith='Test Owner'
    )
    owner_count = test_owners.count()
    if owner_count > 0:
        test_owners.delete()
        print(f"✅ Deleted {owner_count} test owner(s)")
    
    # Delete test members (and their user accounts)
    test_members = Member.objects.filter(
        full_name__startswith='Test Owner'
    )
    member_count = test_members.count()
    for member in test_members:
        if member.user:
            member.user.delete()
        member.delete()
    
    if member_count > 0:
        print(f"✅ Deleted {member_count} test member(s) and their user accounts")
    
    # Check for email
    email_members = Member.objects.filter(login_email='mhlimonbdcalling@gmail.com')
    email_count = email_members.count()
    if email_count > 0:
        for member in email_members:
            if member.user:
                member.user.delete()
            member.login_email = None
            member.save()
        print(f"✅ Cleared login_email for {email_count} member(s) with test email")
    
    print(f"✅ Cleanup complete!")

def test_bulk_upload():
    """Test the bulk upload functionality"""
    print("\n" + "="*60)
    print("📤 Testing Excel Bulk Upload...")
    print("="*60)
    
    # Create test Excel file
    excel_file, row_count = create_test_excel_file()
    print(f"✅ Created test Excel file with {row_count} data rows")
    
    # Get or create test user
    test_user = User.objects.first()
    if not test_user:
        test_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        print(f"✅ Created test user: {test_user.username}")
    else:
        print(f"ℹ️  Using existing user: {test_user.username}")
    
    # Call the view directly (bypassing HTTP layer)
    from django.core.files.uploadedfile import SimpleUploadedFile
    from rest_framework.test import APIRequestFactory
    from rest_framework.parsers import MultiPartParser, FormParser
    
    # Prepare file for upload
    excel_file.seek(0)  # Reset file pointer
    file_content = excel_file.read()
    uploaded_file = SimpleUploadedFile(
        name='test_owners.xlsx',
        content=file_content,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    
    try:
        # Create request factory
        factory = APIRequestFactory()
        request = factory.post(
            '/towers/owners/bulk-upload/',
            {'file': uploaded_file},
            format='multipart'
        )
        request.user = test_user
        
        # Call the view
        view = BulkUploadOwner()
        response = view.post(request)
        
        print(f"\n📊 Response Status: {response.status_code}")
        
        # Get response data
        if hasattr(response, 'data'):
            data = response.data
        else:
            import json
            data = json.loads(response.content) if response.content else {}
        
        print(f"📊 Status: {data.get('status', 'unknown')}")
        print(f"📊 Message: {data.get('message', 'No message')}")
        print(f"📊 Success Count: {data.get('success_count', 0)}")
        print(f"📊 Error Count: {data.get('error_count', 0)}")
        print(f"📊 Total Rows: {data.get('total_rows', 0)}")
        
        if data.get('created_owners'):
            print(f"\n✅ Created Owners:")
            for owner in data['created_owners']:
                print(f"   - {owner.get('member_name')} (Unit: {owner.get('unit')})")
        
        if data.get('failed_rows'):
            print(f"\n❌ Failed Rows:")
            for failed in data['failed_rows']:
                print(f"   - Row {failed.get('row')}: {failed.get('errors')}")
        
        return response
        
    except Exception as e:
        print(f"\n❌ Error during bulk upload: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def verify_email_sending():
    """Verify that emails were sent correctly"""
    print("\n" + "="*60)
    print("📧 Verifying Email Sending...")
    print("="*60)
    
    # Check members with delivery_method emails
    test_email_1 = 'mhlimonbdcalling@gmail.com'
    test_email_2 = 'testowner3.delivery@gmail.com'
    
    members_with_email_1 = Member.objects.filter(login_email=test_email_1)
    members_with_email_2 = Member.objects.filter(login_email=test_email_2)
    
    print(f"\n📧 Members with login_email = '{test_email_1}': {members_with_email_1.count()}")
    for member in members_with_email_1:
        print(f"   - Member: {member.full_name} (ID: {member.id})")
        print(f"     Has User Account: {member.user is not None}")
        if member.user:
            print(f"     Username: {member.user.username}")
    
    print(f"\n📧 Members with login_email = '{test_email_2}': {members_with_email_2.count()}")
    for member in members_with_email_2:
        print(f"   - Member: {member.full_name} (ID: {member.id})")
        print(f"     Has User Account: {member.user is not None}")
        if member.user:
            print(f"     Username: {member.user.username}")
    
    # Check members without delivery_method (should not have login_email set)
    test_members_no_delivery = Member.objects.filter(
        full_name__startswith='Test Owner',
        login_email__isnull=True
    )
    print(f"\n📧 Members without delivery_method (no login_email): {test_members_no_delivery.count()}")
    for member in test_members_no_delivery:
        print(f"   - Member: {member.full_name} (ID: {member.id})")
        print(f"     General Email: {member.general_email}")
        print(f"     Has User Account: {member.user is not None}")

def main():
    """Main test function"""
    print("\n" + "="*80)
    print("🧪 EXCEL UPLOAD AND EMAIL SENDING TEST")
    print("="*80)
    
    try:
        # Setup test data
        tower, floor = setup_test_data()
        
        # Cleanup any existing test data first
        cleanup_test_data()
        
        # Test bulk upload
        response = test_bulk_upload()
        
        # Verify email sending
        verify_email_sending()
        
        print("\n" + "="*80)
        print("✅ TEST COMPLETE!")
        print("="*80)
        print("\n📝 Summary:")
        print("   - Test Excel file created with 3 rows")
        print("   - Row 1: Has delivery_method → Should send email to mhlimonbdcalling@gmail.com")
        print("   - Row 2: No delivery_method → Should NOT send email")
        print("   - Row 3: Has delivery_method → Should send email to testowner3.delivery@gmail.com")
        print("\n💡 Check the verification output above to see if emails were sent correctly.")
        print("💡 Check your email inbox for credential emails (if email backend is configured).")
        
        # Ask if user wants to cleanup
        print("\n" + "="*80)
        cleanup_choice = input("Do you want to cleanup test data? (y/n): ").strip().lower()
        if cleanup_choice == 'y':
            cleanup_test_data()
            print("✅ Test data cleaned up!")
        else:
            print("ℹ️  Test data kept for manual inspection.")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())

