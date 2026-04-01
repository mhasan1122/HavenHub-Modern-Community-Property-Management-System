"""
Django management command to keep only member_id = 1 data and remove all other data
from group_role_membersrole and user_member tables.

WARNING: This is a destructive operation that will permanently delete data!

Usage:
    python manage.py cleanup_member_data
    python manage.py cleanup_member_data --confirm  # Skip confirmation
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.conf import settings
from group_role.models import MembersRole, GroupMembers
from user.models import Member


class Command(BaseCommand):
    help = 'Keep only member_id = 1 data and remove all other data from group_role_membersrole and user_member tables'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Skip confirmation prompt (use with caution!)',
        )

    def handle(self, *args, **options):
        confirm = options['confirm']
        
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write(self.style.WARNING('MEMBER DATA CLEANUP'))
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write('\nThis will:')
        self.stdout.write('  1. Delete all records from group_role_groupmembers where member_id != 1')
        self.stdout.write('  2. Delete all records from group_role_membersrole where member_id != 1')
        self.stdout.write('  3. Fix self-referential foreign keys in user_member')
        self.stdout.write('  4. Delete all records from user_member where id != 1')
        self.stdout.write('\n⚠️  WARNING: This is a DESTRUCTIVE operation!')
        self.stdout.write('⚠️  All data except member_id = 1 will be PERMANENTLY DELETED!')
        self.stdout.write('✅  PROTECTED: member_id = 1 will NEVER be deleted')
        self.stdout.write('=' * 70)
        
        # Get current counts
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM group_role_groupmembers WHERE member_id != 1")
                groupmembers_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM group_role_membersrole WHERE member_id != 1")
                membersrole_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM user_member WHERE id != 1")
                member_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM group_role_groupmembers WHERE member_id = 1")
                groupmembers_keep = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM group_role_membersrole WHERE member_id = 1")
                membersrole_keep = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM user_member WHERE id = 1")
                member_keep = cursor.fetchone()[0]
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error checking database: {str(e)}'))
            return
        
        self.stdout.write(f'\nCurrent data:')
        self.stdout.write(f'  group_role_groupmembers: {groupmembers_count} records to DELETE, {groupmembers_keep} records to KEEP')
        self.stdout.write(f'  group_role_membersrole: {membersrole_count} records to DELETE, {membersrole_keep} records to KEEP')
        self.stdout.write(f'  user_member: {member_count} records to DELETE, {member_keep} records to KEEP')
        
        if groupmembers_count == 0 and membersrole_count == 0 and member_count == 0:
            self.stdout.write(self.style.SUCCESS('\n✓ No data to delete. All records are already member_id = 1.'))
            return
        
        # Confirmation prompt
        if not confirm:
            self.stdout.write(self.style.ERROR('\n' + '=' * 70))
            self.stdout.write(self.style.ERROR('WARNING: This will PERMANENTLY DELETE data!'))
            self.stdout.write(self.style.ERROR('=' * 70))
            response = input('\nType "DELETE" to confirm: ')
            
            if response != 'DELETE':
                self.stdout.write(self.style.WARNING('\nOperation cancelled.'))
                return
        
        # Perform deletion
        self.stdout.write(self.style.WARNING('\nStarting cleanup...'))
        
        try:
            with transaction.atomic():
                # Step 1: Delete from group_role_groupmembers where member_id != 1
                # This must be done first because it has PROTECT foreign key to Member
                self.stdout.write('\nStep 1: Cleaning group_role_groupmembers table...')
                deleted_groupmembers = GroupMembers.objects.exclude(member_id=1).delete()
                deleted_count = deleted_groupmembers[0] if isinstance(deleted_groupmembers, tuple) else deleted_groupmembers
                self.stdout.write(self.style.SUCCESS(f'  ✓ Deleted {deleted_count} record(s) from group_role_groupmembers'))
                
                # Step 2: Delete from group_role_membersrole where member_id != 1
                self.stdout.write('\nStep 2: Cleaning group_role_membersrole table...')
                deleted_membersrole = MembersRole.objects.exclude(member_id=1).delete()
                deleted_count = deleted_membersrole[0] if isinstance(deleted_membersrole, tuple) else deleted_membersrole
                self.stdout.write(self.style.SUCCESS(f'  ✓ Deleted {deleted_count} record(s) from group_role_membersrole'))
                
                # Step 3: Fix all foreign keys that reference user_member
                # Set created_by_id and updated_by_id to NULL in all tables that reference members that will be deleted
                self.stdout.write('\nStep 3: Fixing foreign keys in all tables that reference user_member...')
                total_updated = 0
                
                with connection.cursor() as cursor:
                    # List of tables and their foreign key columns that reference user_member
                    tables_to_fix = [
                        ('user_member', ['created_by_id', 'updated_by_id']),  # Self-referential
                        ('group_role_group', ['created_by_id', 'updated_by_id']),
                        ('group_role_role', ['created_by_id', 'updated_by_id']),
                        ('group_role_rolepermission', ['created_by_id', 'updated_by_id']),
                        ('group_role_rolegroup', ['created_by_id', 'updated_by_id']),
                        ('group_role_membersrole', ['created_by_id', 'updated_by_id']),
                        ('group_role_groupmembers', ['created_by_id', 'updated_by_id']),
                    ]
                    
                    for table_name, columns in tables_to_fix:
                        for column in columns:
                            # Set to NULL where it points to members that will be deleted (id != 1)
                            cursor.execute(f"""
                                UPDATE `{table_name}` 
                                SET `{column}` = NULL 
                                WHERE `{column}` IS NOT NULL AND `{column}` != 1
                            """)
                            updated = cursor.rowcount
                            if updated > 0:
                                total_updated += updated
                                self.stdout.write(f'  → Updated {updated} {column} in {table_name}')
                
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ Updated {total_updated} total foreign key reference(s) to NULL'
                ))
                
                # Step 4: Delete from user_member where id != 1
                # IMPORTANT: member_id = 1 will NEVER be deleted - it is protected
                self.stdout.write('\nStep 4: Cleaning user_member table...')
                self.stdout.write(self.style.WARNING('  ⚠️  PROTECTED: member_id = 1 will NOT be deleted'))
                
                # Check if member_id = 1 exists
                member_1_exists = Member.objects.filter(id=1).exists()
                if not member_1_exists:
                    self.stdout.write(self.style.ERROR('  ✗ ERROR: member_id = 1 does not exist in user_member table!'))
                    self.stdout.write(self.style.ERROR('  Cannot proceed with deletion as there would be no members left.'))
                    raise Exception('member_id = 1 does not exist')
                
                # Double-check: Get count of members to delete (should not include id=1)
                members_to_delete = Member.objects.exclude(id=1)
                delete_count_before = members_to_delete.count()
                self.stdout.write(f'  → Will delete {delete_count_before} member(s) (excluding member_id = 1)')
                
                # Safety check: Verify member_id = 1 is not in the delete query
                if members_to_delete.filter(id=1).exists():
                    self.stdout.write(self.style.ERROR('  ✗ SAFETY CHECK FAILED: member_id = 1 is in delete query!'))
                    self.stdout.write(self.style.ERROR('  Aborting to prevent accidental deletion of member_id = 1'))
                    raise Exception('Safety check failed: member_id = 1 would be deleted')
                
                # Perform deletion - only members where id != 1
                deleted_member = members_to_delete.delete()
                deleted_count = deleted_member[0] if isinstance(deleted_member, tuple) else deleted_member
                self.stdout.write(self.style.SUCCESS(f'  ✓ Deleted {deleted_count} record(s) from user_member'))
                
                # Final safety verification: Ensure member_id = 1 still exists
                member_1_still_exists = Member.objects.filter(id=1).exists()
                if not member_1_still_exists:
                    self.stdout.write(self.style.ERROR('  ✗ CRITICAL ERROR: member_id = 1 was deleted!'))
                    raise Exception('CRITICAL: member_id = 1 was deleted - this should never happen!')
                else:
                    self.stdout.write(self.style.SUCCESS('  ✓ Verified: member_id = 1 is still present'))
                
                # Verify final state
                self.stdout.write('\nVerifying final state...')
                with connection.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM group_role_groupmembers")
                    final_groupmembers = cursor.fetchone()[0]
                    
                    cursor.execute("SELECT COUNT(*) FROM group_role_membersrole")
                    final_membersrole = cursor.fetchone()[0]
                    
                    cursor.execute("SELECT COUNT(*) FROM user_member")
                    final_member = cursor.fetchone()[0]
                    
                    cursor.execute("SELECT COUNT(*) FROM group_role_groupmembers WHERE member_id = 1")
                    final_groupmembers_1 = cursor.fetchone()[0]
                    
                    cursor.execute("SELECT COUNT(*) FROM group_role_membersrole WHERE member_id = 1")
                    final_membersrole_1 = cursor.fetchone()[0]
                    
                    cursor.execute("SELECT COUNT(*) FROM user_member WHERE id = 1")
                    final_member_1 = cursor.fetchone()[0]
                
                self.stdout.write(f'  group_role_groupmembers: {final_groupmembers} total records (all with member_id = 1)')
                self.stdout.write(f'  group_role_membersrole: {final_membersrole} total records (all with member_id = 1)')
                self.stdout.write(f'  user_member: {final_member} total records (id = 1)')
                
                if (final_groupmembers == final_groupmembers_1 and 
                    final_membersrole == final_membersrole_1 and 
                    final_member == final_member_1 == 1):
                    self.stdout.write(self.style.SUCCESS('\n✓ Cleanup completed successfully!'))
                    self.stdout.write(self.style.SUCCESS('✓ All records now have member_id = 1'))
                else:
                    self.stdout.write(self.style.WARNING('\n⚠ Warning: Verification shows unexpected results.'))
                    self.stdout.write(self.style.WARNING('Please check the database manually.'))
        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n✗ Error during cleanup: {str(e)}'))
            self.stdout.write(self.style.ERROR('Transaction rolled back. No changes were made.'))
            raise

