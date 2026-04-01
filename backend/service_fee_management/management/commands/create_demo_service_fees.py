from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from user.models import Member, MemberType
from towers.models import Tower, Floor, Unit
from service_fee.models import ServiceFee, ServiceFeeMFS, ServiceFeeBank
from decimal import Decimal


class Command(BaseCommand):
    help = 'Create demo service fee data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating demo service fee data...')

        # Get or create admin user and member
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@example.com',
                'first_name': 'Admin',
                'last_name': 'User',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()

        # Get or create member type
        admin_type, _ = MemberType.objects.get_or_create(
            type_name='Admin'
        )

        # Get or create admin member
        admin_member, _ = Member.objects.get_or_create(
            user=admin_user,
            defaults={
                'member_type': admin_type,
                'full_name': 'Admin User',
                'general_contact': '01234567890',
                'general_email': 'admin@example.com'
            }
        )

        # Get or create demo towers
        tower1, _ = Tower.objects.get_or_create(
            tower_name='Tower A',
            defaults={
                'tower_number': 1,
                'num_floors': 10,
                'num_units': 40,
                'unit_naming_type': 'Numeric',
                'created_by': admin_member
            }
        )

        tower2, _ = Tower.objects.get_or_create(
            tower_name='Tower B',
            defaults={
                'tower_number': 2,
                'num_floors': 8,
                'num_units': 32,
                'unit_naming_type': 'Numeric',
                'created_by': admin_member
            }
        )

        # Create floors and units for Tower A
        for floor_no in range(1, 4):  # Create 3 floors
            floor, _ = Floor.objects.get_or_create(
                tower=tower1,
                floor_no=floor_no,
                defaults={
                    'number_of_units': 4,
                    'created_by': admin_member
                }
            )
            
            # Create units for each floor
            for unit_no in range(1, 5):  # 4 units per floor
                unit_name = f"{floor_no}0{unit_no}"
                Unit.objects.get_or_create(
                    floor=floor,
                    unit_name=unit_name,
                    defaults={
                        'unit_status': 'available',
                        'created_by': admin_member
                    }
                )

        # Create floors and units for Tower B
        for floor_no in range(1, 3):  # Create 2 floors
            floor, _ = Floor.objects.get_or_create(
                tower=tower2,
                floor_no=floor_no,
                defaults={
                    'number_of_units': 4,
                    'created_by': admin_member
                }
            )
            
            # Create units for each floor
            for unit_no in range(1, 5):  # 4 units per floor
                unit_name = f"{floor_no}0{unit_no}"
                Unit.objects.get_or_create(
                    floor=floor,
                    unit_name=unit_name,
                    defaults={
                        'unit_status': 'available',
                        'created_by': admin_member
                    }
                )

        # Create demo service fees
        self.create_demo_service_fees(admin_member, tower1, tower2)

        self.stdout.write(
            self.style.SUCCESS('Successfully created demo service fee data!')
        )

    def create_demo_service_fees(self, admin_member, tower1, tower2):
        """Create various demo service fees"""

        # Service Fee 1: Monthly maintenance for Tower A
        service_fee1, created = ServiceFee.objects.get_or_create(
            creator=admin_member,
            fee_amount=Decimal('5000.00'),
            currency='BDT',
            defaults={
                'creator_name': admin_member.full_name,
                'frequency': 'Monthly',
                'billing_cycle': 'Monthly',
                'due_day': 5,
                'accepts_cash': True,
                'accepts_mfs': True,
                'accepts_bank': False,
                'reminder_before_days': 3,
                'reminder_after_days': 7,
                'is_active': True,
                'created_by': admin_member
            }
        )
        
        if created:
            # Add tower to service fee
            service_fee1.towers.add(tower1)
            
            # Add MFS accounts
            ServiceFeeMFS.objects.create(
                service_fee=service_fee1,
                provider='bKash',
                account_name='Tower A Maintenance',
                account_number='01712345678'
            )
            ServiceFeeMFS.objects.create(
                service_fee=service_fee1,
                provider='Nagad',
                account_name='Tower A Maintenance',
                account_number='01812345678'
            )

        # Service Fee 2: Quarterly security for Tower B
        service_fee2, created = ServiceFee.objects.get_or_create(
            creator=admin_member,
            fee_amount=Decimal('3000.00'),
            currency='BDT',
            defaults={
                'creator_name': admin_member.full_name,
                'frequency': 'Quarterly',
                'billing_cycle': 'Monthly',
                'due_day': 15,
                'accepts_cash': False,
                'accepts_mfs': True,
                'accepts_bank': True,
                'reminder_before_days': 5,
                'reminder_after_days': 10,
                'is_active': True,
                'created_by': admin_member
            }
        )
        
        if created:
            # Add tower to service fee
            service_fee2.towers.add(tower2)
            
            # Add MFS account
            ServiceFeeMFS.objects.create(
                service_fee=service_fee2,
                provider='Rocket',
                account_name='Tower B Security',
                account_number='01912345678'
            )
            
            # Add bank account
            ServiceFeeBank.objects.create(
                service_fee=service_fee2,
                bank_name='Prime Bank',
                branch_name='Dhanmondi Branch',
                branch_address='House 12, Road 7, Dhanmondi, Dhaka',
                account_holder_name='Tower B Management',
                account_number='1234567890123456',
                routing_number='123456789'
            )

        # Service Fee 3: Specific units cleaning fee
        units_for_cleaning = Unit.objects.filter(floor__tower=tower1)[:4]  # First 4 units
        service_fee3, created = ServiceFee.objects.get_or_create(
            creator=admin_member,
            fee_amount=Decimal('1500.00'),
            currency='BDT',
            defaults={
                'creator_name': admin_member.full_name,
                'frequency': 'Monthly',
                'billing_cycle': 'Monthly',
                'due_day': 1,
                'accepts_cash': True,
                'accepts_mfs': False,
                'accepts_bank': False,
                'reminder_before_days': 2,
                'is_active': True,
                'created_by': admin_member
            }
        )
        
        if created:
            # Add specific units
            service_fee3.units.set(units_for_cleaning)

        # Service Fee 4: Inactive service fee (for testing filters)
        service_fee4, created = ServiceFee.objects.get_or_create(
            creator=admin_member,
            fee_amount=Decimal('2000.00'),
            currency='USD',
            defaults={
                'creator_name': admin_member.full_name,
                'frequency': 'Yearly',
                'billing_cycle': 'Monthly',
                'due_day': 10,
                'accepts_cash': True,
                'accepts_mfs': True,
                'accepts_bank': True,
                'is_active': False,  # Inactive
                'created_by': admin_member
            }
        )
        
        if created:
            service_fee4.towers.add(tower1, tower2)
            
            ServiceFeeMFS.objects.create(
                service_fee=service_fee4,
                provider='bKash',
                account_name='Old Service Fee',
                account_number='01612345678'
            )

        self.stdout.write('Created 4 demo service fees with various configurations')
