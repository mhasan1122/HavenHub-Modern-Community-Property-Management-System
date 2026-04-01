"""
Management command to test user4936 access control
Usage: python manage.py test_user_access user4936
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from user.models import Member
from towers.models import Resident
from django.db import connection


class Command(BaseCommand):
    help = 'Test access control for a specific user'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username to test')

    def handle(self, *args, **options):
        username = options['username']
        
        self.stdout.write("\n" + "="*80)
        self.stdout.write(f"Testing Access Control for {username}")
        self.stdout.write("="*80 + "\n")
        
        try:
            # Get user
            user = User.objects.get(username=username)
            member = Member.objects.get(user=user)
            
            self.stdout.write(self.style.SUCCESS(f"✅ Found User: {user.username}"))
            self.stdout.write(f"   Member ID: {member.id}")
            self.stdout.write(f"   General Contact: {member.general_contact}")
            self.stdout.write(f"   Login Contact: {member.login_contact}")
            
            # Collect user's contact info
            user_contacts = []
            if member.general_contact:
                user_contacts.append(member.general_contact)
            if member.login_contact:
                user_contacts.append(member.login_contact)
            
            self.stdout.write(f"\n📱 User Contacts: {user_contacts}")
            
            # Check resident status
            residents = Resident.objects.filter(
                member_id=member.id,
                is_active=True
            ).select_related('unit', 'unit__floor', 'unit__floor__tower')
            
            self.stdout.write(f"\n🏠 Resident Units ({residents.count()}):")
            for resident in residents:
                unit = resident.unit
                tower = unit.floor.tower
                self.stdout.write(f"\n   Tower: {tower.tower_name} (#{tower.tower_number})")
                self.stdout.write(f"   Unit: {unit.unit_name}")
                self.stdout.write(f"   Primary Number: {unit.primary_number or 'NONE'}")
                self.stdout.write(f"   Secondary Number: {unit.secondary_number or 'NONE'}")
                
                # Check if this unit has contact numbers
                has_contact = (unit.primary_number and unit.primary_number.strip()) or \
                             (unit.secondary_number and unit.secondary_number.strip())
                
                if not has_contact:
                    self.stdout.write(self.style.WARNING(f"   ⚠️  WILL BE FILTERED OUT (no primary/secondary number)"))
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
                        self.stdout.write(self.style.SUCCESS(f"   ✅ WILL BE SHOWN (contact matches)"))
                    else:
                        self.stdout.write(self.style.ERROR(f"   ❌ WILL BE FILTERED OUT (contact doesn't match)"))
            
            self.stdout.write("\n" + "="*80)
            self.stdout.write(self.style.SUCCESS("Test Complete"))
            self.stdout.write("="*80 + "\n")
            
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ User '{username}' not found"))
        except Member.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Member for {username} not found"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error: {str(e)}"))
            import traceback
            traceback.print_exc()
