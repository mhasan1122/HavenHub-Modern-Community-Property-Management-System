#!/usr/bin/env python
"""
Script to cleanup test email data from database
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from towers.models import Owner
from django.contrib.auth.models import User

def cleanup_test_emails():
    """Remove test email data from database"""
    test_emails = [
        'mhlimonbdcalling@gmail.com',
        'testowner3.delivery@gmail.com',
        'testowner1@example.com',
        'testowner2@example.com',
        'testowner3@example.com'
    ]
    
    print("\n" + "="*60)
    print("🧹 Cleaning up test email data...")
    print("="*60)
    
    total_deleted = 0
    
    for email in test_emails:
        print(f"\n📧 Processing email: {email}")
        
        # Find members with this login_email
        members_with_login = Member.objects.filter(login_email=email)
        count_login = members_with_login.count()
        print(f"   Found {count_login} member(s) with login_email = '{email}'")
        
        for member in members_with_login:
            print(f"   - Member: {member.full_name} (ID: {member.id})")
            
            # Delete associated owners
            owners = Owner.objects.filter(member=member)
            owner_count = owners.count()
            if owner_count > 0:
                owners.delete()
                print(f"     ✅ Deleted {owner_count} owner(s)")
            
            # Delete user account if exists
            if member.user:
                user = member.user
                print(f"     ✅ Deleting User account: {user.username} (ID: {user.id})")
                # Clear the user reference before deleting
                member.user = None
                member.save(update_fields=['user'])
                user.delete()
            
            # Delete member (no need to clear login_email since we're deleting)
            member.delete()
            print(f"     ✅ Deleted member")
            total_deleted += 1
        
        # Find members with this general_email
        members_with_general = Member.objects.filter(general_email__iexact=email)
        count_general = members_with_general.count()
        if count_general > 0:
            print(f"   Found {count_general} member(s) with general_email = '{email}'")
            
            for member in members_with_general:
                print(f"   - Member: {member.full_name} (ID: {member.id})")
                
                # Delete associated owners
                owners = Owner.objects.filter(member=member)
                owner_count = owners.count()
                if owner_count > 0:
                    owners.delete()
                    print(f"     ✅ Deleted {owner_count} owner(s)")
                
                # Delete user account if exists
                if member.user:
                    user = member.user
                    print(f"     ✅ Deleting User account: {user.username} (ID: {user.id})")
                    # Clear the user reference before deleting
                    member.user = None
                    member.save(update_fields=['user'])
                    user.delete()
                
                # Delete member (no need to clear login_email since we're deleting)
                member.delete()
                print(f"     ✅ Deleted member")
                total_deleted += 1
    
    # Also cleanup test owners by name pattern
    print(f"\n📋 Cleaning up test owners by name pattern...")
    test_owners = Owner.objects.filter(member__full_name__startswith='Test Owner')
    test_owner_count = test_owners.count()
    if test_owner_count > 0:
        test_owners.delete()
        print(f"   ✅ Deleted {test_owner_count} test owner(s)")
    
    test_members = Member.objects.filter(full_name__startswith='Test Owner')
    test_member_count = test_members.count()
    for member in test_members:
        if member.user:
            user = member.user
            # Clear the user reference before deleting
            member.user = None
            member.save(update_fields=['user'])
            user.delete()
        member.delete()
    
    if test_member_count > 0:
        print(f"   ✅ Deleted {test_member_count} test member(s)")
        total_deleted += test_member_count
    
    print(f"\n" + "="*60)
    print(f"✅ Cleanup complete! Total records deleted: {total_deleted}")
    print("="*60 + "\n")
    
    # Verify cleanup
    print("🔍 Verification:")
    for email in test_emails:
        remaining = Member.objects.filter(login_email=email).count()
        if remaining == 0:
            print(f"   ✅ No members found with login_email = '{email}'")
        else:
            print(f"   ⚠️  Still found {remaining} member(s) with login_email = '{email}'")

if __name__ == '__main__':
    cleanup_test_emails()

