#!/usr/bin/env python
"""
Script to check and delete email from database
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from django.contrib.auth.models import User

def check_and_delete_email(email):
    """Check if email exists and delete related data"""
    email = email.lower().strip()
    
    print(f"\n{'='*60}")
    print(f"🔍 Checking for email: {email}")
    print(f"{'='*60}\n")
    
    # Check login_email
    members_with_login_email = Member.objects.filter(login_email=email)
    print(f"📧 Members with login_email = '{email}': {members_with_login_email.count()}")
    
    for member in members_with_login_email:
        print(f"   - Member ID: {member.id}")
        print(f"     Name: {member.full_name}")
        print(f"     Contact: {member.general_contact}")
        print(f"     General Email: {member.general_email}")
        print(f"     Has User Account: {member.user is not None}")
        if member.user:
            print(f"     User ID: {member.user.id}")
            print(f"     Username: {member.user.username}")
    
    # Check general_email
    members_with_general_email = Member.objects.filter(general_email__iexact=email)
    print(f"\n📧 Members with general_email = '{email}': {members_with_general_email.count()}")
    
    for member in members_with_general_email:
        print(f"   - Member ID: {member.id}")
        print(f"     Name: {member.full_name}")
        print(f"     Contact: {member.general_contact}")
        print(f"     Login Email: {member.login_email}")
        print(f"     Has User Account: {member.user is not None}")
    
    # Delete logic
    total_found = members_with_login_email.count() + members_with_general_email.count()
    
    if total_found == 0:
        print(f"\n✅ No members found with email: {email}")
        return
    
    print(f"\n{'='*60}")
    print(f"🗑️  DELETION PROCESS")
    print(f"{'='*60}\n")
    
    deleted_count = 0
    
    # Delete members with login_email matching
    for member in members_with_login_email:
        print(f"🗑️  Deleting member: {member.full_name} (ID: {member.id})")
        
        # Delete user account if exists
        if member.user:
            user = member.user
            print(f"   - Deleting User account: {user.username} (ID: {user.id})")
            user.delete()
        
        # Delete member
        member.delete()
        deleted_count += 1
        print(f"   ✅ Deleted successfully\n")
    
    # For general_email, we'll just clear the login_email if it matches
    # (Don't delete the member, just clear the login_email)
    for member in members_with_general_email:
        if member.login_email and member.login_email.lower() == email:
            print(f"🔄 Clearing login_email for member: {member.full_name} (ID: {member.id})")
            member.login_email = None
            if member.user:
                print(f"   - Deleting User account: {member.user.username} (ID: {member.user.id})")
                member.user.delete()
                member.user = None
            member.save()
            print(f"   ✅ Cleared login_email\n")
            deleted_count += 1
    
    print(f"{'='*60}")
    print(f"✅ Deletion complete! Removed {deleted_count} record(s)")
    print(f"{'='*60}\n")
    
    # Verify deletion
    remaining = Member.objects.filter(login_email=email).count()
    if remaining == 0:
        print(f"✅ Verification: No members found with login_email = '{email}'")
    else:
        print(f"⚠️  Warning: Still found {remaining} member(s) with login_email = '{email}'")

if __name__ == '__main__':
    email = 'mhlimonbdcalling@gmail.com'
    check_and_delete_email(email)

