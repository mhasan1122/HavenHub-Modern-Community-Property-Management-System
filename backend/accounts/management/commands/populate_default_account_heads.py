"""Management command to populate default account heads for financial transactions.
Maps common transaction types to default accounts for the financial entry system.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import Account, DefaultAccountHead
from user.models import Member


class Command(BaseCommand):
    help = 'Populate default account heads for financial entry system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing default account heads before populating'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting to populate default account heads...'))
        
        try:
            # Get or create a default member for createdBy
            member = Member.objects.filter(user__username='admin').first()
            if not member:
                self.stdout.write(self.style.WARNING('No admin user found. Using system member...'))
                from django.contrib.auth.models import User
                admin_user, _ = User.objects.get_or_create(
                    username='system',
                    defaults={'first_name': 'System', 'is_staff': True}
                )
                member, _ = Member.objects.get_or_create(
                    user=admin_user,
                    defaults={'full_name': 'System Administrator'}
                )
            
            # Clear existing default account heads if requested
            if options['clear']:
                self.stdout.write(self.style.WARNING('Clearing existing default account heads...'))
                DefaultAccountHead.objects.all().delete()
                self.stdout.write('Existing default account heads cleared.')
            
            with transaction.atomic():
                self.stdout.write('Creating default account head mappings...')
                
                # Helper function to get or create default account head
                def create_default_head(trans_type, label, account_code, description):
                    try:
                        account = Account.objects.get(accountCode=account_code, isActive=True)
                        head, created = DefaultAccountHead.objects.get_or_create(
                            transactionType=trans_type,
                            defaults={
                                'customLabel': label,
                                'defaultAccount': account,
                                'description': description,
                                'isActive': True,
                                'createdBy': member,
                                'updatedBy': member
                            }
                        )
                        status = '✓ Created' if created else '✓ Exists'
                        self.stdout.write(f'  {status}: {label} -> {account.accountCode} - {account.accountName}')
                        return head
                    except Account.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'  ⚠ Skipped: {label} (Account {account_code} not found)'))
                        return None
                
                # ====================
                # INCOME TRANSACTIONS
                # ====================
                self.stdout.write(self.style.SUCCESS('\n📥 Income Transaction Mappings:'))
                
                create_default_head(
                    trans_type='service_fee_income',
                    label='Service Fee Income',
                    account_code='4110',
                    description='Default account for monthly service fee collections'
                )
                
                create_default_head(
                    trans_type='late_fee_income',
                    label='Late Payment Fee Income',
                    account_code='4120',
                    description='Default account for late payment penalty fees'
                )
                
                create_default_head(
                    trans_type='facility_rental_income',
                    label='Facility Rental Income',
                    account_code='4210',
                    description='Default account for facility rental income'
                )
                
                create_default_head(
                    trans_type='parking_rental_income',
                    label='Parking Rental Income',
                    account_code='4220',
                    description='Default account for parking space rentals'
                )
                
                create_default_head(
                    trans_type='interest_income',
                    label='Interest Income',
                    account_code='4910',
                    description='Default account for bank interest income'
                )
                
                create_default_head(
                    trans_type='donation_income',
                    label='Donations and Contributions',
                    account_code='4920',
                    description='Default account for donations received'
                )
                
                create_default_head(
                    trans_type='miscellaneous_income',
                    label='Miscellaneous Income',
                    account_code='4990',
                    description='Default account for other miscellaneous income'
                )
                
                # ====================
                # EXPENSE TRANSACTIONS
                # ====================
                self.stdout.write(self.style.SUCCESS('\n📤 Expense Transaction Mappings:'))
                
                create_default_head(
                    trans_type='salary_expense',
                    label='Salaries and Wages',
                    account_code='5110',
                    description='Default account for employee salaries'
                )
                
                create_default_head(
                    trans_type='employee_benefits',
                    label='Employee Benefits',
                    account_code='5120',
                    description='Default account for staff benefits'
                )
                
                create_default_head(
                    trans_type='electricity_expense',
                    label='Electricity Expense',
                    account_code='5210',
                    description='Default account for electricity bills'
                )
                
                create_default_head(
                    trans_type='water_expense',
                    label='Water Expense',
                    account_code='5220',
                    description='Default account for water bills'
                )
                
                create_default_head(
                    trans_type='gas_expense',
                    label='Gas Expense',
                    account_code='5230',
                    description='Default account for gas bills'
                )
                
                create_default_head(
                    trans_type='internet_expense',
                    label='Internet and Telecom',
                    account_code='5240',
                    description='Default account for internet and telephone'
                )
                
                create_default_head(
                    trans_type='building_maintenance',
                    label='Building Maintenance',
                    account_code='5310',
                    description='Default account for building repairs'
                )
                
                create_default_head(
                    trans_type='equipment_maintenance',
                    label='Equipment Maintenance',
                    account_code='5320',
                    description='Default account for equipment repairs'
                )
                
                create_default_head(
                    trans_type='elevator_maintenance',
                    label='Elevator Maintenance',
                    account_code='5330',
                    description='Default account for elevator service'
                )
                
                create_default_head(
                    trans_type='generator_maintenance',
                    label='Generator Maintenance',
                    account_code='5340',
                    description='Default account for generator service and fuel'
                )
                
                create_default_head(
                    trans_type='cleaning_expense',
                    label='Cleaning and Janitorial',
                    account_code='5350',
                    description='Default account for cleaning services'
                )
                
                create_default_head(
                    trans_type='landscaping_expense',
                    label='Landscaping and Gardening',
                    account_code='5360',
                    description='Default account for landscaping'
                )
                
                create_default_head(
                    trans_type='security_services',
                    label='Security Guard Services',
                    account_code='5410',
                    description='Default account for security personnel'
                )
                
                create_default_head(
                    trans_type='security_equipment',
                    label='Security Equipment',
                    account_code='5420',
                    description='Default account for security systems'
                )
                
                create_default_head(
                    trans_type='office_supplies',
                    label='Office Supplies',
                    account_code='5510',
                    description='Default account for office supplies'
                )
                
                create_default_head(
                    trans_type='printing_postage',
                    label='Printing and Postage',
                    account_code='5520',
                    description='Default account for printing and mailing'
                )
                
                create_default_head(
                    trans_type='professional_fees',
                    label='Professional Fees',
                    account_code='5530',
                    description='Default account for legal, accounting, consulting'
                )
                
                create_default_head(
                    trans_type='bank_charges',
                    label='Bank Charges and Fees',
                    account_code='5540',
                    description='Default account for bank service charges'
                )
                
                create_default_head(
                    trans_type='software_licenses',
                    label='Software and Licenses',
                    account_code='5550',
                    description='Default account for software subscriptions'
                )
                
                create_default_head(
                    trans_type='property_insurance',
                    label='Property Insurance',
                    account_code='5610',
                    description='Default account for property insurance'
                )
                
                create_default_head(
                    trans_type='liability_insurance',
                    label='Liability Insurance',
                    account_code='5620',
                    description='Default account for liability insurance'
                )
                
                create_default_head(
                    trans_type='depreciation',
                    label='Depreciation Expense',
                    account_code='5700',
                    description='Default account for asset depreciation'
                )
                
                # ====================
                # CASH/BANK ACCOUNTS
                # ====================
                self.stdout.write(self.style.SUCCESS('\n💰 Cash and Bank Account Mappings:'))
                
                create_default_head(
                    trans_type='cash',
                    label='Cash on Hand',
                    account_code='1111',
                    description='Default cash account for cash transactions'
                )
                
                create_default_head(
                    trans_type='petty_cash',
                    label='Petty Cash',
                    account_code='1112',
                    description='Default petty cash account'
                )
                
                create_default_head(
                    trans_type='bank',
                    label='Bank Account - Main',
                    account_code='1121',
                    description='Default bank account for transactions'
                )
                
                create_default_head(
                    trans_type='bank_service_fee',
                    label='Bank Account - Service Fee Collection',
                    account_code='1122',
                    description='Default bank account for service fee deposits'
                )
                
                create_default_head(
                    trans_type='mfs',
                    label='Mobile Financial Services',
                    account_code='1125',
                    description='Default MFS account (bKash/Nagad/Rocket)'
                )
                
                # ====================
                # RECEIVABLES
                # ====================
                self.stdout.write(self.style.SUCCESS('\n📋 Receivable Account Mappings:'))
                
                create_default_head(
                    trans_type='service_fee_receivable',
                    label='Service Fee Receivable',
                    account_code='1211',
                    description='Default account for unpaid service fees'
                )
                
                create_default_head(
                    trans_type='other_receivable',
                    label='Other Receivables',
                    account_code='1299',
                    description='Default account for other receivables'
                )
                
                # ====================
                # PAYABLES
                # ====================
                self.stdout.write(self.style.SUCCESS('\n📝 Payable Account Mappings:'))
                
                create_default_head(
                    trans_type='accounts_payable',
                    label='Accounts Payable - Trade',
                    account_code='2111',
                    description='Default account for supplier payables'
                )
                
                create_default_head(
                    trans_type='utility_payable',
                    label='Utility Bills Payable',
                    account_code='2121',
                    description='Default account for unpaid utilities'
                )
                
                create_default_head(
                    trans_type='salary_payable',
                    label='Salaries Payable',
                    account_code='2131',
                    description='Default account for unpaid salaries'
                )
                
                create_default_head(
                    trans_type='advance_payment',
                    label='Advance Payments from Residents',
                    account_code='2200',
                    description='Default account for resident advance payments'
                )
            
            total_heads = DefaultAccountHead.objects.count()
            self.stdout.write(self.style.SUCCESS(f'\n✅ Successfully populated default account heads!'))
            self.stdout.write(self.style.SUCCESS(f'📊 Total default account heads: {total_heads}'))
            self.stdout.write(self.style.SUCCESS(f'🎯 Financial entry system is now configured with default mappings!'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error populating default account heads: {str(e)}'))
            raise
