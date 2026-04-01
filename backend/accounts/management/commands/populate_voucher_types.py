from django.core.management.base import BaseCommand
from accounts.models import VoucherType
from user.models import Member


class Command(BaseCommand):
    help = 'Populate the VoucherType table with default voucher types'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting voucher type population...'))
        
        # Try to get a member for createdBy/updatedBy fields
        try:
            member = Member.objects.first()
            if member:
                self.stdout.write(self.style.SUCCESS(f'Using member: {member.username} for audit fields'))
            else:
                self.stdout.write(self.style.WARNING('No members found, using None for audit fields'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Could not fetch member: {e}'))
            member = None
        
        # Define default voucher types
        voucher_types_data = [
            {
                'name': 'journal',
                'displayName': 'Journal Voucher',
                'description': 'Voucher for recording non-cash transactions and adjustments',
                'prefix': 'JV',
                'isActive': True,
            },
            {
                'name': 'receipt',
                'displayName': 'Receipt Voucher',
                'description': 'Voucher for recording cash and bank receipts',
                'prefix': 'RV',
                'isActive': True,
            },
            {
                'name': 'payment',
                'displayName': 'Payment Voucher',
                'description': 'Voucher for recording cash and bank payments',
                'prefix': 'PV',
                'isActive': True,
            },
            {
                'name': 'contra',
                'displayName': 'Contra Voucher',
                'description': 'Voucher for recording transfers between cash and bank accounts',
                'prefix': 'CV',
                'isActive': True,
            },
            {
                'name': 'OpeningBalance',
                'displayName': 'Opening Balance Voucher',
                'description': 'Voucher for account seeding / opening balance',
                'prefix': 'OB',
                'isActive': True,
            },
            {
                'name': 'ClosingBalance',
                'displayName': 'Closing Balance Voucher',
                'description': 'Voucher for period closing balances',
                'prefix': 'CB',
                'isActive': True,
            },
            {
                'name': 'ServiceFeeBill',
                'displayName': 'Service Fee Bill',
                'description': 'Voucher for generating service fee bills',
                'prefix': 'SFB',
                'isActive': True,
            },
            {
                'name': 'ServiceFeePayment',
                'displayName': 'Service Fee Payment',
                'description': 'Voucher for recording service fee payments',
                'prefix': 'SFP',
                'isActive': True,
            },
            {
                'name': 'AdvancePayment',
                'displayName': 'Advance Payment',
                'description': 'Voucher for recording advance payments from residents',
                'prefix': 'ADV',
                'isActive': True,
            },
            {
                'name': 'ServiceFeeAdjustment',
                'displayName': 'Service Fee Adjustment',
                'description': 'Voucher for service fee adjustments',
                'prefix': 'SFA',
                'isActive': True,
            },
        ]
        
        created_count = 0
        updated_count = 0
        
        for vt_data in voucher_types_data:
            name = vt_data.pop('name')
            
            # Add audit fields if member exists
            if member:
                vt_data['createdBy'] = member
                vt_data['updatedBy'] = member
            
            # Use get_or_create to avoid duplicates
            voucher_type, created = VoucherType.objects.get_or_create(
                name=name,
                defaults=vt_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Created voucher type: {voucher_type.displayName} ({voucher_type.prefix})'
                    )
                )
            else:
                # Update existing record with latest data
                for key, value in vt_data.items():
                    setattr(voucher_type, key, value)
                voucher_type.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'○ Updated existing voucher type: {voucher_type.displayName} ({voucher_type.prefix})'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully completed!'
                f'\n  - Created: {created_count} voucher types'
                f'\n  - Updated: {updated_count} voucher types'
                f'\n  - Total: {VoucherType.objects.count()} voucher types in database'
            )
        )
        
        # Display all voucher types
        self.stdout.write(self.style.WARNING('\nCurrent Voucher Types in Database:'))
        for vt in VoucherType.objects.all():
            self.stdout.write(
                f'  • ID: {vt.id} | Name: {vt.name} | Display: {vt.displayName} | Prefix: {vt.prefix} | Active: {vt.isActive}'
            )
