"""Management command to populate the accounts tables with comprehensive chart of accounts data.
Optimized for estate/property management with standard accounting practices.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import Account
from user.models import Member
from decimal import Decimal


class Command(BaseCommand):
    help = 'Populate the accounts tables with comprehensive chart of accounts for estate management'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing accounts before populating (WARNING: This will delete all accounts)'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting to populate comprehensive chart of accounts...'))
        
        try:
            # Get or create a default member for createdBy
            member = Member.objects.filter(user__username='admin').first()
            if not member:
                self.stdout.write(self.style.WARNING('No admin user found. Creating system member...'))
                from django.contrib.auth.models import User
                admin_user, _ = User.objects.get_or_create(
                    username='system',
                    defaults={'first_name': 'System', 'is_staff': True}
                )
                member, _ = Member.objects.get_or_create(
                    user=admin_user,
                    defaults={'full_name': 'System Administrator'}
                )
            
            # Clear existing accounts if requested
            if options['clear']:
                self.stdout.write(self.style.WARNING('Clearing existing accounts...'))
                Account.objects.all().delete()
                self.stdout.write('Existing accounts cleared.')
            
            with transaction.atomic():
                self.stdout.write('Creating comprehensive chart of accounts...')
                
                # =======================
                # ASSET ACCOUNTS (1000s)
                # =======================
                assets = Account.objects.create(
                    accountCode='1000',
                    accountName='Assets',
                    accountType='asset',
                    description='All asset accounts',
                    isActive=True,
                    isSystemAccount=True,
                    createdBy=member
                )
                self.stdout.write(f'  ✓ {assets.accountCode} - {assets.accountName}')
                
                # Current Assets (1100s)
                current_assets = Account.objects.create(
                    accountCode='1100',
                    accountName='Current Assets',
                    accountType='asset',
                    description='Assets that can be converted to cash within one year',
                    parentAccount=assets,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {current_assets.accountCode} - {current_assets.accountName}')
                
                # Cash Accounts (1110-1119)
                cash_hand = Account.objects.create(
                    accountCode='1111',
                    accountName='Cash on Hand',
                    accountType='asset',
                    description='Physical cash in office',
                    parentAccount=current_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {cash_hand.accountCode} - {cash_hand.accountName}')
                
                petty_cash = Account.objects.create(
                    accountCode='1112',
                    accountName='Petty Cash',
                    accountType='asset',
                    description='Small cash fund for minor expenses',
                    parentAccount=current_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {petty_cash.accountCode} - {petty_cash.accountName}')
                
                # Bank Accounts (1120-1139)
                bank_main = Account.objects.create(
                    accountCode='1121',
                    accountName='Bank Account - Main',
                    accountType='asset',
                    description='Primary business bank account',
                    parentAccount=current_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {bank_main.accountCode} - {bank_main.accountName}')
                
                bank_service_fee = Account.objects.create(
                    accountCode='1122',
                    accountName='Bank Account - Service Fee Collection',
                    accountType='asset',
                    description='Bank account for service fee deposits',
                    parentAccount=current_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {bank_service_fee.accountCode} - {bank_service_fee.accountName}')
                
                bank_mfs = Account.objects.create(
                    accountCode='1125',
                    accountName='Mobile Financial Services (bKash/Nagad/Rocket)',
                    accountType='asset',
                    description='MFS accounts for digital transactions',
                    parentAccount=current_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {bank_mfs.accountCode} - {bank_mfs.accountName}')
                
                # Receivables (1200-1299)
                receivables = Account.objects.create(
                    accountCode='1200',
                    accountName='Accounts Receivable',
                    accountType='asset',
                    description='Money owed to the organization',
                    parentAccount=current_assets,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {receivables.accountCode} - {receivables.accountName}')
                
                service_fee_receivable = Account.objects.create(
                    accountCode='1211',
                    accountName='Service Fee Receivable',
                    accountType='asset',
                    description='Unpaid service fees from residents',
                    parentAccount=receivables,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'        ✓ {service_fee_receivable.accountCode} - {service_fee_receivable.accountName}')
                
                other_receivable = Account.objects.create(
                    accountCode='1299',
                    accountName='Other Receivables',
                    accountType='asset',
                    description='Other amounts owed to the organization',
                    parentAccount=receivables,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'        ✓ {other_receivable.accountCode} - {other_receivable.accountName}')
                
                # Fixed Assets (1500s)
                fixed_assets = Account.objects.create(
                    accountCode='1500',
                    accountName='Fixed Assets',
                    accountType='asset',
                    description='Long-term tangible assets',
                    parentAccount=assets,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {fixed_assets.accountCode} - {fixed_assets.accountName}')
                
                property_equipment = Account.objects.create(
                    accountCode='1511',
                    accountName='Property and Equipment',
                    accountType='asset',
                    description='Buildings, land, and equipment',
                    parentAccount=fixed_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {property_equipment.accountCode} - {property_equipment.accountName}')
                
                furniture_fixtures = Account.objects.create(
                    accountCode='1521',
                    accountName='Furniture and Fixtures',
                    accountType='asset',
                    description='Office furniture and fixtures',
                    parentAccount=fixed_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {furniture_fixtures.accountCode} - {furniture_fixtures.accountName}')
                
                computer_equipment = Account.objects.create(
                    accountCode='1531',
                    accountName='Computer Equipment',
                    accountType='asset',
                    description='Computers and IT equipment',
                    parentAccount=fixed_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {computer_equipment.accountCode} - {computer_equipment.accountName}')
                
                accumulated_depreciation = Account.objects.create(
                    accountCode='1590',
                    accountName='Accumulated Depreciation',
                    accountType='asset',
                    description='Contra-asset account for depreciation',
                    parentAccount=fixed_assets,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {accumulated_depreciation.accountCode} - {accumulated_depreciation.accountName}')
                
                # ==========================
                # LIABILITY ACCOUNTS (2000s)
                # ==========================
                liabilities = Account.objects.create(
                    accountCode='2000',
                    accountName='Liabilities',
                    accountType='liability',
                    description='All liability accounts',
                    isActive=True,
                    isSystemAccount=True,
                    createdBy=member
                )
                self.stdout.write(f'  ✓ {liabilities.accountCode} - {liabilities.accountName}')
                
                # Current Liabilities (2100s)
                current_liabilities = Account.objects.create(
                    accountCode='2100',
                    accountName='Current Liabilities',
                    accountType='liability',
                    description='Obligations due within one year',
                    parentAccount=liabilities,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {current_liabilities.accountCode} - {current_liabilities.accountName}')
                
                accounts_payable = Account.objects.create(
                    accountCode='2111',
                    accountName='Accounts Payable - Trade',
                    accountType='liability',
                    description='Amounts owed to suppliers',
                    parentAccount=current_liabilities,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {accounts_payable.accountCode} - {accounts_payable.accountName}')
                
                utility_payable = Account.objects.create(
                    accountCode='2121',
                    accountName='Utility Bills Payable',
                    accountType='liability',
                    description='Unpaid utility bills',
                    parentAccount=current_liabilities,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {utility_payable.accountCode} - {utility_payable.accountName}')
                
                salary_payable = Account.objects.create(
                    accountCode='2131',
                    accountName='Salaries Payable',
                    accountType='liability',
                    description='Unpaid staff salaries',
                    parentAccount=current_liabilities,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {salary_payable.accountCode} - {salary_payable.accountName}')
                
                # Advance Payments (2200s)
                advance_payments = Account.objects.create(
                    accountCode='2200',
                    accountName='Advance Payments from Residents',
                    accountType='liability',
                    description='Prepayments received from residents',
                    parentAccount=current_liabilities,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {advance_payments.accountCode} - {advance_payments.accountName}')
                
                # Long-term Liabilities (2500s)
                long_term_liabilities = Account.objects.create(
                    accountCode='2500',
                    accountName='Long-term Liabilities',
                    accountType='liability',
                    description='Obligations due after one year',
                    parentAccount=liabilities,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {long_term_liabilities.accountCode} - {long_term_liabilities.accountName}')
                
                long_term_loan = Account.objects.create(
                    accountCode='2511',
                    accountName='Long-term Loans',
                    accountType='liability',
                    description='Loans due after one year',
                    parentAccount=long_term_liabilities,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {long_term_loan.accountCode} - {long_term_loan.accountName}')
                
                # ======================
                # EQUITY ACCOUNTS (3000s)
                # ======================
                equity = Account.objects.create(
                    accountCode='3000',
                    accountName='Equity',
                    accountType='equity',
                    description='Owner equity and retained earnings',
                    isActive=True,
                    isSystemAccount=True,
                    createdBy=member
                )
                self.stdout.write(f'  ✓ {equity.accountCode} - {equity.accountName}')
                
                capital = Account.objects.create(
                    accountCode='3100',
                    accountName='Organizational Capital',
                    accountType='equity',
                    description='Initial capital of the organization',
                    parentAccount=equity,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {capital.accountCode} - {capital.accountName}')
                
                retained_earnings = Account.objects.create(
                    accountCode='3900',
                    accountName='Retained Earnings',
                    accountType='equity',
                    description='Accumulated profits/losses',
                    parentAccount=equity,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {retained_earnings.accountCode} - {retained_earnings.accountName}')
                
                current_year_earnings = Account.objects.create(
                    accountCode='3910',
                    accountName='Current Year Earnings',
                    accountType='equity',
                    description='Net income for current fiscal year',
                    parentAccount=equity,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {current_year_earnings.accountCode} - {current_year_earnings.accountName}')
                
                # ========================
                # REVENUE ACCOUNTS (4000s)
                # ========================
                revenue = Account.objects.create(
                    accountCode='4000',
                    accountName='Revenue',
                    accountType='revenue',
                    description='All revenue and income accounts',
                    isActive=True,
                    isSystemAccount=True,
                    createdBy=member
                )
                self.stdout.write(f'  ✓ {revenue.accountCode} - {revenue.accountName}')
                
                # Service Fee Revenue (4100s)
                service_fee_revenue = Account.objects.create(
                    accountCode='4100',
                    accountName='Service Fee Revenue',
                    accountType='revenue',
                    description='Income from monthly service fees',
                    parentAccount=revenue,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {service_fee_revenue.accountCode} - {service_fee_revenue.accountName}')
                
                monthly_service_fee = Account.objects.create(
                    accountCode='4110',
                    accountName='Monthly Service Fee Income',
                    accountType='revenue',
                    description='Regular monthly service fee collections',
                    parentAccount=service_fee_revenue,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {monthly_service_fee.accountCode} - {monthly_service_fee.accountName}')
                
                late_payment_fee = Account.objects.create(
                    accountCode='4120',
                    accountName='Late Payment Fees',
                    accountType='revenue',
                    description='Penalties for late service fee payment',
                    parentAccount=service_fee_revenue,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {late_payment_fee.accountCode} - {late_payment_fee.accountName}')
                
                # Rental Income (4200s)
                rental_income = Account.objects.create(
                    accountCode='4200',
                    accountName='Rental Income',
                    accountType='revenue',
                    description='Income from property rentals',
                    parentAccount=revenue,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {rental_income.accountCode} - {rental_income.accountName}')
                
                facility_rental = Account.objects.create(
                    accountCode='4210',
                    accountName='Facility Rental Income',
                    accountType='revenue',
                    description='Income from renting community facilities',
                    parentAccount=rental_income,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {facility_rental.accountCode} - {facility_rental.accountName}')
                
                parking_rental = Account.objects.create(
                    accountCode='4220',
                    accountName='Parking Space Rental',
                    accountType='revenue',
                    description='Income from parking space rentals',
                    parentAccount=rental_income,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {parking_rental.accountCode} - {parking_rental.accountName}')
                
                # Other Revenue (4900s)
                other_income = Account.objects.create(
                    accountCode='4900',
                    accountName='Other Income',
                    accountType='revenue',
                    description='Miscellaneous income',
                    parentAccount=revenue,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {other_income.accountCode} - {other_income.accountName}')
                
                interest_income = Account.objects.create(
                    accountCode='4910',
                    accountName='Interest Income',
                    accountType='revenue',
                    description='Interest earned on bank deposits',
                    parentAccount=other_income,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {interest_income.accountCode} - {interest_income.accountName}')
                
                donations = Account.objects.create(
                    accountCode='4920',
                    accountName='Donations and Contributions',
                    accountType='revenue',
                    description='Donations received from residents or sponsors',
                    parentAccount=other_income,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {donations.accountCode} - {donations.accountName}')
                
                misc_income = Account.objects.create(
                    accountCode='4990',
                    accountName='Miscellaneous Income',
                    accountType='revenue',
                    description='Other miscellaneous income',
                    parentAccount=other_income,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {misc_income.accountCode} - {misc_income.accountName}')
                
                # ========================
                # EXPENSE ACCOUNTS (5000s)
                # ========================
                expenses = Account.objects.create(
                    accountCode='5000',
                    accountName='Expenses',
                    accountType='expense',
                    description='All expense and cost accounts',
                    isActive=True,
                    isSystemAccount=True,
                    createdBy=member
                )
                self.stdout.write(f'  ✓ {expenses.accountCode} - {expenses.accountName}')
                
                # Payroll Expenses (5100s)
                payroll_expenses = Account.objects.create(
                    accountCode='5100',
                    accountName='Payroll Expenses',
                    accountType='expense',
                    description='Staff compensation and benefits',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {payroll_expenses.accountCode} - {payroll_expenses.accountName}')
                
                salaries = Account.objects.create(
                    accountCode='5110',
                    accountName='Salaries and Wages',
                    accountType='expense',
                    description='Employee salaries and wages',
                    parentAccount=payroll_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {salaries.accountCode} - {salaries.accountName}')
                
                staff_benefits = Account.objects.create(
                    accountCode='5120',
                    accountName='Employee Benefits',
                    accountType='expense',
                    description='Health insurance, bonuses, etc.',
                    parentAccount=payroll_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {staff_benefits.accountCode} - {staff_benefits.accountName}')
                
                # Utility Expenses (5200s)
                utility_expenses = Account.objects.create(
                    accountCode='5200',
                    accountName='Utility Expenses',
                    accountType='expense',
                    description='Utilities for common areas',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {utility_expenses.accountCode} - {utility_expenses.accountName}')
                
                electricity = Account.objects.create(
                    accountCode='5210',
                    accountName='Electricity Expense',
                    accountType='expense',
                    description='Electricity bills for common areas',
                    parentAccount=utility_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {electricity.accountCode} - {electricity.accountName}')
                
                water = Account.objects.create(
                    accountCode='5220',
                    accountName='Water Expense',
                    accountType='expense',
                    description='Water bills for common areas',
                    parentAccount=utility_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {water.accountCode} - {water.accountName}')
                
                gas = Account.objects.create(
                    accountCode='5230',
                    accountName='Gas Expense',
                    accountType='expense',
                    description='Gas bills for common areas',
                    parentAccount=utility_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {gas.accountCode} - {gas.accountName}')
                
                internet = Account.objects.create(
                    accountCode='5240',
                    accountName='Internet and Telecom',
                    accountType='expense',
                    description='Internet and telephone services',
                    parentAccount=utility_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {internet.accountCode} - {internet.accountName}')
                
                # Maintenance Expenses (5300s)
                maintenance_expenses = Account.objects.create(
                    accountCode='5300',
                    accountName='Maintenance and Repairs',
                    accountType='expense',
                    description='Building and equipment maintenance',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {maintenance_expenses.accountCode} - {maintenance_expenses.accountName}')
                
                building_maintenance = Account.objects.create(
                    accountCode='5310',
                    accountName='Building Maintenance',
                    accountType='expense',
                    description='Repairs and maintenance of buildings',
                    parentAccount=maintenance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {building_maintenance.accountCode} - {building_maintenance.accountName}')
                
                equipment_maintenance = Account.objects.create(
                    accountCode='5320',
                    accountName='Equipment Maintenance',
                    accountType='expense',
                    description='Maintenance of equipment and machinery',
                    parentAccount=maintenance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {equipment_maintenance.accountCode} - {equipment_maintenance.accountName}')
                
                elevator_maintenance = Account.objects.create(
                    accountCode='5330',
                    accountName='Elevator Maintenance',
                    accountType='expense',
                    description='Elevator service and repairs',
                    parentAccount=maintenance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {elevator_maintenance.accountCode} - {elevator_maintenance.accountName}')
                
                generator_maintenance = Account.objects.create(
                    accountCode='5340',
                    accountName='Generator Maintenance',
                    accountType='expense',
                    description='Generator service and fuel',
                    parentAccount=maintenance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {generator_maintenance.accountCode} - {generator_maintenance.accountName}')
                
                cleaning_janitorial = Account.objects.create(
                    accountCode='5350',
                    accountName='Cleaning and Janitorial',
                    accountType='expense',
                    description='Cleaning services and supplies',
                    parentAccount=maintenance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {cleaning_janitorial.accountCode} - {cleaning_janitorial.accountName}')
                
                landscaping = Account.objects.create(
                    accountCode='5360',
                    accountName='Landscaping and Gardening',
                    accountType='expense',
                    description='Garden and landscape maintenance',
                    parentAccount=maintenance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {landscaping.accountCode} - {landscaping.accountName}')
                
                # Security Expenses (5400s)
                security_expenses = Account.objects.create(
                    accountCode='5400',
                    accountName='Security Expenses',
                    accountType='expense',
                    description='Security services and equipment',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {security_expenses.accountCode} - {security_expenses.accountName}')
                
                security_services = Account.objects.create(
                    accountCode='5410',
                    accountName='Security Guard Services',
                    accountType='expense',
                    description='Security personnel costs',
                    parentAccount=security_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {security_services.accountCode} - {security_services.accountName}')
                
                security_equipment = Account.objects.create(
                    accountCode='5420',
                    accountName='Security Equipment',
                    accountType='expense',
                    description='CCTV, alarms, and security systems',
                    parentAccount=security_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {security_equipment.accountCode} - {security_equipment.accountName}')
                
                # Administrative Expenses (5500s)
                administrative_expenses = Account.objects.create(
                    accountCode='5500',
                    accountName='Administrative Expenses',
                    accountType='expense',
                    description='General office and administrative costs',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {administrative_expenses.accountCode} - {administrative_expenses.accountName}')
                
                office_supplies = Account.objects.create(
                    accountCode='5510',
                    accountName='Office Supplies',
                    accountType='expense',
                    description='Stationery and office supplies',
                    parentAccount=administrative_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {office_supplies.accountCode} - {office_supplies.accountName}')
                
                printing_postage = Account.objects.create(
                    accountCode='5520',
                    accountName='Printing and Postage',
                    accountType='expense',
                    description='Printing, copying, and postage',
                    parentAccount=administrative_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {printing_postage.accountCode} - {printing_postage.accountName}')
                
                professional_fees = Account.objects.create(
                    accountCode='5530',
                    accountName='Professional Fees',
                    accountType='expense',
                    description='Legal, accounting, consulting fees',
                    parentAccount=administrative_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {professional_fees.accountCode} - {professional_fees.accountName}')
                
                bank_charges = Account.objects.create(
                    accountCode='5540',
                    accountName='Bank Charges and Fees',
                    accountType='expense',
                    description='Bank service charges and transaction fees',
                    parentAccount=administrative_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {bank_charges.accountCode} - {bank_charges.accountName}')
                
                software_licenses = Account.objects.create(
                    accountCode='5550',
                    accountName='Software and Licenses',
                    accountType='expense',
                    description='Software subscriptions and licenses',
                    parentAccount=administrative_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {software_licenses.accountCode} - {software_licenses.accountName}')
                
                # Insurance Expenses (5600s)
                insurance_expenses = Account.objects.create(
                    accountCode='5600',
                    accountName='Insurance Expenses',
                    accountType='expense',
                    description='Insurance premiums',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {insurance_expenses.accountCode} - {insurance_expenses.accountName}')
                
                property_insurance = Account.objects.create(
                    accountCode='5610',
                    accountName='Property Insurance',
                    accountType='expense',
                    description='Building and property insurance',
                    parentAccount=insurance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {property_insurance.accountCode} - {property_insurance.accountName}')
                
                liability_insurance = Account.objects.create(
                    accountCode='5620',
                    accountName='Liability Insurance',
                    accountType='expense',
                    description='General liability insurance',
                    parentAccount=insurance_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {liability_insurance.accountCode} - {liability_insurance.accountName}')
                
                # Depreciation (5700s)
                depreciation_expense = Account.objects.create(
                    accountCode='5700',
                    accountName='Depreciation Expense',
                    accountType='expense',
                    description='Depreciation of fixed assets',
                    parentAccount=expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {depreciation_expense.accountCode} - {depreciation_expense.accountName}')
                
                # Miscellaneous Expenses (5900s)
                misc_expenses = Account.objects.create(
                    accountCode='5900',
                    accountName='Miscellaneous Expenses',
                    accountType='expense',
                    description='Other operating expenses',
                    parentAccount=expenses,
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'    ✓ {misc_expenses.accountCode} - {misc_expenses.accountName}')
                
                charity_donations = Account.objects.create(
                    accountCode='5910',
                    accountName='Charity and Donations',
                    accountType='expense',
                    description='Charitable contributions',
                    parentAccount=misc_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {charity_donations.accountCode} - {charity_donations.accountName}')
                
                other_expenses = Account.objects.create(
                    accountCode='5990',
                    accountName='Other Expenses',
                    accountType='expense',
                    description='Uncategorized expenses',
                    parentAccount=misc_expenses,
                    currentBalance=Decimal('0.00'),
                    isActive=True,
                    createdBy=member
                )
                self.stdout.write(f'      ✓ {other_expenses.accountCode} - {other_expenses.accountName}')
            
            total_accounts = Account.objects.count()
            self.stdout.write(self.style.SUCCESS(f'\n✅ Successfully populated comprehensive chart of accounts!'))
            self.stdout.write(self.style.SUCCESS(f'📊 Total accounts created: {total_accounts}'))
            self.stdout.write(self.style.SUCCESS(f'🏢 System ready for estate management financial operations!'))
            self.stdout.write(self.style.SUCCESS(f'\nNext step: Run "python manage.py populate_default_account_heads" to configure default mappings.'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error populating accounts: {str(e)}'))
            raise
