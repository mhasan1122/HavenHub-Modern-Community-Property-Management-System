#!/usr/bin/env python
"""
Test script to verify role permission update functionality
Run this after applying the RoleSerializer update fix

Usage:
    python test_role_permission_update.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from group_role.models import Role, Permission, RolePermission
from group_role.serializers import RoleSerializer
from user.models import Member, User
from django.test import RequestFactory
from django.contrib.auth import get_user_model

def test_role_permission_update():
    """
    Test that the RoleSerializer.update() method properly handles permission updates
    """
    print("=" * 70)
    print("ROLE PERMISSION UPDATE TEST")
    print("=" * 70)
    
    # Get or create a test user and member
    User = get_user_model()
    try:
        user = User.objects.filter(is_superuser=True).first()
        if not user:
            print("❌ No superuser found. Please create a superuser first.")
            return
        
        member = Member.objects.get(user=user)
    except Member.DoesNotExist:
        print("❌ No member found for the user. Please ensure proper setup.")
        return
    
    # Get or create a test role
    role, created = Role.objects.get_or_create(
        role_name="Test Permission Update Role",
        defaults={
            'role_description': 'Test role for permission update',
            'created_by': member
        }
    )
    
    if created:
        print(f"✅ Created test role: {role.role_name}")
    else:
        print(f"✅ Using existing test role: {role.role_name}")
    
    # Get some test permissions
    permissions = list(Permission.objects.all()[:5])
    if len(permissions) < 3:
        print("❌ Not enough permissions in database for testing")
        return
    
    print(f"\n📋 Available test permissions:")
    for i, perm in enumerate(permissions, 1):
        print(f"   {i}. {perm.permission_name} (ID: {perm.id})")
    
    # Initial setup - assign first 3 permissions
    print(f"\n🔧 Setting initial permissions (first 3)...")
    initial_permission_ids = [p.id for p in permissions[:3]]
    
    # Clear existing permissions
    RolePermission.objects.filter(role=role).delete()
    
    # Create initial permissions
    for perm_id in initial_permission_ids:
        RolePermission.objects.create(
            role=role,
            permission_id=perm_id,
            created_by=member
        )
    
    current_perms = list(RolePermission.objects.filter(role=role).values_list('permission__permission_name', flat=True))
    print(f"   Current permissions: {', '.join(current_perms)}")
    
    # Now test the update method
    print(f"\n🧪 Testing RoleSerializer.update() method...")
    print(f"   Updating to use permissions 2, 3, 4, 5 (removing 1, adding 4 & 5)")
    
    # Create mock request
    factory = RequestFactory()
    request = factory.put('/fake-url/')
    request.user = user
    
    # Prepare update data
    new_permission_ids = [p.id for p in permissions[1:5]]  # permissions 2, 3, 4, 5
    update_data = {
        'role_name': role.role_name,
        'role_description': role.role_description,
        'permissions': new_permission_ids
    }
    
    # Execute update
    serializer = RoleSerializer(
        role, 
        data=update_data, 
        partial=True,
        context={'request': request}
    )
    
    if serializer.is_valid():
        updated_role = serializer.save()
        print("   ✅ Serializer validation passed")
        print("   ✅ update() method executed successfully")
        
        # Verify the changes
        updated_perms = list(RolePermission.objects.filter(role=role).values_list('permission__permission_name', flat=True))
        updated_perm_ids = set(RolePermission.objects.filter(role=role).values_list('permission_id', flat=True))
        
        print(f"\n📊 RESULTS:")
        print(f"   Previous permissions: {', '.join(current_perms)}")
        print(f"   Updated permissions:  {', '.join(updated_perms)}")
        
        # Verify correctness
        expected_ids = set(new_permission_ids)
        if updated_perm_ids == expected_ids:
            print(f"\n   ✅ SUCCESS: Permissions updated correctly!")
            print(f"   ✅ Removed: {permissions[0].permission_name}")
            print(f"   ✅ Added: {permissions[3].permission_name}, {permissions[4].permission_name}")
            print(f"   ✅ Kept: {permissions[1].permission_name}, {permissions[2].permission_name}")
        else:
            print(f"\n   ❌ FAILED: Permission IDs don't match")
            print(f"      Expected: {expected_ids}")
            print(f"      Got: {updated_perm_ids}")
    else:
        print(f"   ❌ Serializer validation failed: {serializer.errors}")
    
    # Cleanup
    print(f"\n🧹 Cleaning up test data...")
    if created:
        role.delete()
        print(f"   Deleted test role")
    else:
        print(f"   Keeping existing role (not created by this test)")
    
    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    try:
        test_role_permission_update()
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH ERROR:")
        print(f"   {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
