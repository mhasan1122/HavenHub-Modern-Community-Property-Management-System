#!/usr/bin/env python
"""
Test script to verify push notification logout fix

Usage:
    python test_logout_fix.py <member_id_or_identifier>
    python test_logout_fix.py 123
    python test_logout_fix.py mirza_hasan_6671
    python test_logout_fix.py user@example.com
    python test_logout_fix.py 123 --simulate

This script checks:
1. Current active device tokens for a member
2. Simulates logout behavior
3. Verifies all tokens are deactivated
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db.models import Q
from notifications.models import DeviceToken
from user.models import Member
from django.contrib.auth.models import User


def resolve_member(identifier):
    """
    Resolve member by numeric ID or by username / login_email / login_contact.
    Returns (Member, None) or (None, error_message).
    """
    # Try numeric member ID first
    try:
        member_id = int(identifier)
        member = Member.objects.get(id=member_id)
        return member, None
    except ValueError:
        pass
    except Member.DoesNotExist:
        return None, f"Member with ID {identifier} not found"

    # Treat as string: lookup by username, login_email, or login_contact
    ident = str(identifier).strip()
    if not ident:
        return None, "Identifier cannot be empty"

    member = Member.objects.filter(
        Q(user__username=ident) |
        Q(login_email__iexact=ident) |
        Q(login_contact=ident)
    ).first()

    if member:
        return member, None
    return None, f"No member found for: {ident} (tried username, login_email, login_contact)"


def check_device_tokens(member_id):
    """Check device tokens for a member"""
    try:
        member = Member.objects.get(id=member_id)
        print(f"\n{'='*60}")
        print(f"Member: {member.full_name} (ID: {member.id})")
        print(f"{'='*60}")
        
        # Get all tokens
        all_tokens = DeviceToken.objects.filter(member=member)
        active_tokens = all_tokens.filter(is_active=True)
        inactive_tokens = all_tokens.filter(is_active=False)
        
        print(f"\nTotal tokens: {all_tokens.count()}")
        print(f"Active tokens: {active_tokens.count()}")
        print(f"Inactive tokens: {inactive_tokens.count()}")
        
        if active_tokens.exists():
            print(f"\n{'='*60}")
            print("ACTIVE TOKENS:")
            print(f"{'='*60}")
            for token in active_tokens:
                print(f"\nToken ID: {token.id}")
                print(f"Push Token: {token.push_token[:30]}...")
                print(f"Device Type: {token.device_type}")
                print(f"Token Type: {token.token_type}")
                print(f"Created: {token.created_at}")
                print(f"Last Used: {token.last_used_at}")
        else:
            print("\n✅ No active tokens found (correct after logout)")
        
        if inactive_tokens.exists():
            print(f"\n{'='*60}")
            print("INACTIVE TOKENS (from previous sessions):")
            print(f"{'='*60}")
            for token in inactive_tokens[:3]:  # Show only first 3
                print(f"\nToken ID: {token.id}")
                print(f"Push Token: {token.push_token[:30]}...")
                print(f"Device Type: {token.device_type}")
                print(f"Created: {token.created_at}")
                print(f"Deactivated: {token.last_used_at}")
        
        return member, all_tokens.count(), active_tokens.count()
        
    except Member.DoesNotExist:
        print(f"❌ Error: Member with ID {member_id} not found")
        return None, 0, 0


def simulate_logout(member_id):
    """Simulate the logout process"""
    try:
        member = Member.objects.get(id=member_id)
        
        print(f"\n{'='*60}")
        print("SIMULATING LOGOUT...")
        print(f"{'='*60}")
        
        # Count before
        before_count = DeviceToken.objects.filter(
            member=member,
            is_active=True
        ).count()
        
        print(f"Active tokens before logout: {before_count}")
        
        # Deactivate all tokens (same as logout endpoint)
        updated_count = DeviceToken.objects.filter(
            member=member,
            is_active=True
        ).update(is_active=False)
        
        # Count after
        after_count = DeviceToken.objects.filter(
            member=member,
            is_active=True
        ).count()
        
        print(f"Deactivated: {updated_count} token(s)")
        print(f"Active tokens after logout: {after_count}")
        
        if after_count == 0:
            print("\n✅ SUCCESS: All tokens deactivated")
            return True
        else:
            print(f"\n❌ FAILED: {after_count} token(s) still active")
            return False
            
    except Member.DoesNotExist:
        print(f"❌ Error: Member with ID {member_id} not found")
        return False


def main():
    """Main test function"""
    if len(sys.argv) < 2:
        print("Usage: python test_logout_fix.py <member_id_or_identifier> [--simulate]")
        print("\nExamples:")
        print("  python test_logout_fix.py 123")
        print("  python test_logout_fix.py mirza_hasan_6671")
        print("  python test_logout_fix.py user@example.com")
        print("  python test_logout_fix.py 123 --simulate")
        sys.exit(1)

    identifier = sys.argv[1]
    member, err = resolve_member(identifier)
    if err:
        print(f"❌ Error: {err}")
        sys.exit(1)

    member_id = member.id
    print(f"Resolved: {identifier} → Member ID {member_id} ({member.full_name})")

    # Check current state
    print("\n" + "="*60)
    print("CHECKING CURRENT STATE...")
    print("="*60)
    member, total, active = check_device_tokens(member_id)

    if not member:
        sys.exit(1)

    if active == 0:
        print("\nℹ️ No active tokens to test. User may have already logged out.")
        print("   To test:")
        print("   1. Login to the mobile app with this user")
        print("   2. Run this script again to see active tokens")
        print("   3. Run with --simulate flag to test logout behavior")
        sys.exit(0)

    # Ask if user wants to simulate logout
    if '--simulate' in sys.argv or '--test' in sys.argv:
        print("\n" + "="*60)
        response = input("\nDeactivate all tokens? (yes/no): ")
        if response.lower() in ['yes', 'y']:
            success = simulate_logout(member_id)

            if success:
                # Check final state
                print("\n" + "="*60)
                print("FINAL STATE:")
                print("="*60)
                check_device_tokens(member_id)
                sys.exit(0)
            else:
                sys.exit(1)
        else:
            print("\nCancelled. No changes made.")
    else:
        print("\n" + "="*60)
        print("INFO: To simulate logout, run with --simulate flag")
        print("Example: python test_logout_fix.py {} --simulate".format(identifier))
        print("="*60)


if __name__ == '__main__':
    main()
