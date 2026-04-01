#!/usr/bin/env python
"""
Script to populate the voucher types table with default values.
This addresses the issue where the accounts_vouchertype table is empty.
"""
import os
import sys
import django

# Add the project directory to Python path
sys.path.append('/Users/tausif/Codes/DevTechGuru/estate-link/backend')

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django
django.setup()

from accounts.models import VoucherType
from user.models import Member

def populate_voucher_types():
    """Populate the VoucherType table with default values."""
    
    # Get a default member for createdBy/updatedBy fields
    member = Member.objects.first()
    
    voucher_types_data = [
        {
            'name': 'receipt',
            'displayName': 'Receipt Voucher',
            'description': 'Voucher for recording cash receipts',
            'prefix': 'RV',
            'isActive': True,
        },
        {
            'name': 'payment',
            'displayName': 'Payment Voucher',
            'description': 'Voucher for recording cash payments',
            'prefix': 'PV',
            'isActive': True,
        },
        {
            'name': 'journal',
            'displayName': 'Journal Voucher',
            'description': 'Voucher for recording non-cash transactions',
            'prefix': 'JV',
            'isActive': True,
        },
        {
            'name': 'contra',
            'displayName': 'Contra Voucher',
            'description': 'Voucher for recording transfers between cash accounts',
            'prefix': 'CV',
            'isActive': True,
        },
    ]
    
    created_count = 0
    updated_count = 0
    
    for vt_data in voucher_types_data:
        voucher_type, created = VoucherType.objects.get_or_create(
            name=vt_data['name'],
            defaults={
                **vt_data,
                'createdBy': member,
                'updatedBy': member,
            }
        )
        
        if created:
            print(f"Created voucher type: {vt_data['displayName']}")
            created_count += 1
        else:
            # Update the existing record if needed
            for key, value in vt_data.items():
                setattr(voucher_type, key, value)
            voucher_type.createdBy = member
            voucher_type.updatedBy = member
            voucher_type.save()
            print(f"Updated voucher type: {vt_data['displayName']}")
            updated_count += 1
    
    print(f"\nVoucher types population completed!")
    print(f"Created: {created_count} voucher types")
    print(f"Updated: {updated_count} voucher types")
    
    # Print all voucher types to verify
    print("\nCurrent voucher types in database:")
    for vt in VoucherType.objects.all():
        print(f"- {vt.name}: {vt.displayName} (prefix: {vt.prefix})")

if __name__ == '__main__':
    populate_voucher_types()