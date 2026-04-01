"""
Diagnostic test to check why bulletin notifications might not show after permission grant.
This test will verify each step of the notification process.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from group_role.models import Role, MembersRole, RolePermission
from group_role.permission_constants import PERMISSION_VIEW_BULLETIN_BOARD
from notifications.utils import get_bulletin_recipients, filter_recipients_by_permission, has_view_permission
from notifications.models import Notification


def diagnose_user_notifications(user_id):
    """
    Diagnose why a specific user might not be receiving bulletin notifications
    """
    print("\n" + "="*80)
    print(f"DIAGNOSTIC: Bulletin Notification Status for User ID {user_id}")
    print("="*80 + "\n")
    
    try:
        # Get the user
        user = Member.objects.get(id=user_id)
        print(f"✓ User Found: {user.full_name}")
        print(f"  - Email: {user.email}")
        print(f"  - Is Org Member: {user.is_org_member}")
        print(f"  - Is Community Member: {user.is_comm_member}")
        
        # Step 1: Check permissions
        print("\n" + "-"*80)
        print("STEP 1: Permission Check")
        print("-"*80)
        
        permission_ids = user.get_permission_ids()
        has_bulletin_view = PERMISSION_VIEW_BULLETIN_BOARD in permission_ids
        
        print(f"Has bulletin view permission: {has_bulletin_view}")
        print(f"Total permissions: {len(permission_ids)}")
        print(f"Permission IDs (first 10): {list(permission_ids)[:10]}")
        print(f"Bulletin permission ID needed: {PERMISSION_VIEW_BULLETIN_BOARD}")
        
        # Step 2: Check roles
        print("\n" + "-"*80)
        print("STEP 2: Role Check")
        print("-"*80)
        
        user_roles = MembersRole.objects.filter(
            member=user,
            is_active=True
        ).select_related('role')
        
        if user_roles.exists():
            print(f"User has {user_roles.count()} active role(s):")
            for mr in user_roles:
                role = mr.role
                print(f"  - {role.role_name} (ID: {role.id}, Active: {role.is_active})")
                
                # Check if this role has bulletin view permission
                has_perm = RolePermission.objects.filter(
                    role=role,
                    permission_id=PERMISSION_VIEW_BULLETIN_BOARD,
                    is_active=True
                ).exists()
                print(f"    → Has bulletin view permission: {has_perm}")
        else:
            print("⚠️  User has NO active roles!")
        
        # Step 3: Test permission check function
        print("\n" + "-"*80)
        print("STEP 3: Test Permission Check Function")
        print("-"*80)
        
        has_perm_result = has_view_permission(user, 'bulletin')
        print(f"has_view_permission() returned: {has_perm_result}")
        
        # Step 4: Test filter function
        print("\n" + "-"*80)
        print("STEP 4: Test Filter Function")
        print("-"*80)
        
        test_recipients = [user]
        filtered = filter_recipients_by_permission(test_recipients, 'bulletin')
        
        if user in filtered:
            print(f"✓ User WOULD receive bulletin notifications")
        else:
            print(f"❌ User WOULD NOT receive bulletin notifications")
            print(f"   Reason: Filtered out by permission check")
        
        # Step 5: Check existing bulletin notifications
        print("\n" + "-"*80)
        print("STEP 5: Existing Bulletin Notifications")
        print("-"*80)
        
        bulletin_notifications = Notification.objects.filter(
            recipient=user,
            entity_type='bulletin'
        ).order_by('-created_at')[:5]
        
        if bulletin_notifications.exists():
            print(f"Found {bulletin_notifications.count()} recent bulletin notifications:")
            for notif in bulletin_notifications:
                print(f"  - ID: {notif.id}")
                print(f"    Title: {notif.title}")
                print(f"    Message: {notif.message}")
                print(f"    Created: {notif.created_at}")
                print(f"    Read: {notif.is_read}")
                print(f"    Entity ID: {notif.entity_id}")
                print()
        else:
            print("❌ User has NO bulletin notifications")
            print("   This could mean:")
            print("   1. No bulletins have been created since permission was granted")
            print("   2. User was filtered out due to lack of permissions")
            print("   3. Bulletins were targeted to specific units user doesn't belong to")
        
        # Step 6: Summary
        print("\n" + "="*80)
        print("DIAGNOSTIC SUMMARY")
        print("="*80)
        
        if has_bulletin_view:
            print("✅ User HAS bulletin view permission")
            print("✅ User SHOULD receive notifications for NEW bulletins")
            print()
            if not bulletin_notifications.exists():
                print("⚠️  User has NO bulletin notifications yet")
                print("   → Create a new bulletin to test")
        else:
            print("❌ User LACKS bulletin view permission")
            print("❌ User will NOT receive bulletin notifications")
            print()
            print("ACTION REQUIRED:")
            print("1. Grant bulletin view permission to the user's role")
            print("2. After granting permission, create a NEW bulletin")
            print("3. User should receive notification for the NEW bulletin")
        
        print()
        return has_bulletin_view
        
    except Member.DoesNotExist:
        print(f"❌ User with ID {user_id} not found!")
        return False
    except Exception as e:
        print(f"❌ Error during diagnosis: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_recent_bulletins():
    """
    Check recent bulletins and their notification recipients
    """
    print("\n" + "="*80)
    print("RECENT BULLETINS AND NOTIFICATIONS")
    print("="*80 + "\n")
    
    try:
        from bulletins.models import Bulletin
        
        recent_bulletins = Bulletin.objects.filter(
            status='current'
        ).order_by('-created_at')[:5]
        
        if not recent_bulletins.exists():
            print("No current bulletins found")
            return
        
        for bulletin in recent_bulletins:
            print(f"\nBulletin ID: {bulletin.id}")
            print(f"Title: {bulletin.title}")
            print(f"Creator: {bulletin.creator.full_name if bulletin.creator else 'Unknown'}")
            print(f"Created: {bulletin.created_at}")
            print(f"Status: {bulletin.status}")
            
            # Check notifications for this bulletin
            notifications = Notification.objects.filter(
                entity_type='bulletin',
                entity_id=bulletin.id
            )
            
            print(f"Notifications sent: {notifications.count()}")
            if notifications.count() > 0:
                print(f"Recipients (first 5):")
                for notif in notifications[:5]:
                    print(f"  - {notif.recipient.full_name} (ID: {notif.recipient.id})")
            print("-" * 40)
            
    except Exception as e:
        print(f"Error checking bulletins: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n" + "="*80)
    print("BULLETIN NOTIFICATION DIAGNOSTIC TOOL")
    print("="*80)
    
    # Check recent bulletins first
    check_recent_bulletins()
    
    # Diagnose specific user (change this ID to test different users)
    print("\n\nEnter user ID to diagnose (or press Enter to skip): ")
    try:
        user_input = input().strip()
        if user_input:
            user_id = int(user_input)
            diagnose_user_notifications(user_id)
    except:
        print("\nSkipping user diagnosis")
    
    # Or run automatic diagnosis for users without bulletin permissions
    print("\n\n" + "="*80)
    print("AUTO-DIAGNOSIS: Finding users without bulletin permissions")
    print("="*80 + "\n")
    
    all_members = Member.objects.filter(is_comm_member=True)[:10]  # Check first 10
    
    users_without_permission = []
    for member in all_members:
        permission_ids = member.get_permission_ids()
        has_bulletin_view = PERMISSION_VIEW_BULLETIN_BOARD in permission_ids
        
        if not has_bulletin_view:
            users_without_permission.append(member)
            print(f"User: {member.full_name} (ID: {member.id}) - NO bulletin permission")
    
    if users_without_permission:
        print(f"\n✓ Found {len(users_without_permission)} users without bulletin view permission")
        print("These users will NOT receive bulletin notifications")
        print("Grant them permission and create a NEW bulletin to test")
    else:
        print("\n✓ All checked users have bulletin view permission")
