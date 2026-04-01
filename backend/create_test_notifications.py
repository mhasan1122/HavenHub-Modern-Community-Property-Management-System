"""
Create a fresh role and group notification for testing
This simulates what happens in production when a user is assigned a role/group
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from group_role.models import Role, Group, MembersRole, GroupMembers
from notifications.models import Notification, NotificationType
from notifications.serializers import NotificationListSerializer

def create_fresh_notifications():
    """Create fresh role and group notifications for a test user"""
    print("\n" + "="*80)
    print("Creating Fresh Notifications for Testing")
    print("="*80)
    
    # Find a test member
    member = Member.objects.filter(full_name__icontains='test').first()
    if not member:
        print("❌ No test member found")
        return
    
    print(f"✓ Using member: {member.full_name} (ID: {member.id})")
    
    # Find a role the member doesn't have yet
    existing_role_ids = MembersRole.objects.filter(
        member=member
    ).values_list('role_id', flat=True)
    
    available_role = Role.objects.filter(
        is_active=True
    ).exclude(id__in=existing_role_ids).first()
    
    if available_role:
        print(f"\n✓ Found available role: {available_role.role_name} (ID: {available_role.id})")
        print("📤 Assigning role to member (will trigger notification)...")
        
        members_role = MembersRole.objects.create(
            member=member,
            role=available_role,
            is_active=True
        )
        
        print(f"✓ Role assigned!")
        
        # Check for notification
        role_notification = Notification.objects.filter(
            recipient=member,
            notification_type__code='role_assigned'
        ).order_by('-created_at').first()
        
        if role_notification:
            print(f"✅ Role notification created (ID: {role_notification.id})")
            serializer = NotificationListSerializer(role_notification)
            print("\n📡 API Response:")
            print(json.dumps(serializer.data, indent=2, default=str))
        else:
            print("❌ No role notification created!")
    else:
        print("\n⚠ Member already has all available roles")
        print("Showing existing role notification instead:")
        role_notification = Notification.objects.filter(
            recipient=member,
            notification_type__code='role_assigned'
        ).order_by('-created_at').first()
        
        if role_notification:
            serializer = NotificationListSerializer(role_notification)
            print("\n📡 API Response:")
            print(json.dumps(serializer.data, indent=2, default=str))
    
    # Find a group the member doesn't have yet
    existing_group_ids = GroupMembers.objects.filter(
        member=member
    ).values_list('group_id', flat=True)
    
    available_group = Group.objects.filter(
        is_active=True
    ).exclude(id__in=existing_group_ids).first()
    
    if available_group:
        print(f"\n✓ Found available group: {available_group.group_name} (ID: {available_group.id})")
        print("📤 Adding member to group (will trigger notification)...")
        
        group_member = GroupMembers.objects.create(
            member=member,
            group=available_group
        )
        
        print(f"✓ Member added to group!")
        
        # Check for notification
        group_notification = Notification.objects.filter(
            recipient=member,
            notification_type__code='group_added'
        ).order_by('-created_at').first()
        
        if group_notification:
            print(f"✅ Group notification created (ID: {group_notification.id})")
            serializer = NotificationListSerializer(group_notification)
            print("\n📡 API Response:")
            print(json.dumps(serializer.data, indent=2, default=str))
        else:
            print("❌ No group notification created!")
    else:
        print("\n⚠ Member already in all available groups")
        print("Showing existing group notification instead:")
        group_notification = Notification.objects.filter(
            recipient=member,
            notification_type__code='group_added'
        ).order_by('-created_at').first()
        
        if group_notification:
            serializer = NotificationListSerializer(group_notification)
            print("\n📡 API Response:")
            print(json.dumps(serializer.data, indent=2, default=str))
    
    print("\n" + "="*80)
    print("Summary")
    print("="*80)
    
    total_role_notifs = Notification.objects.filter(
        notification_type__code='role_assigned'
    ).count()
    total_group_notifs = Notification.objects.filter(
        notification_type__code='group_added'
    ).count()
    
    print(f"Total role assignment notifications: {total_role_notifs}")
    print(f"Total group addition notifications: {total_group_notifs}")
    
    member_role_notifs = Notification.objects.filter(
        recipient=member,
        notification_type__code='role_assigned'
    ).count()
    member_group_notifs = Notification.objects.filter(
        recipient=member,
        notification_type__code='group_added'
    ).count()
    
    print(f"\nFor {member.full_name}:")
    print(f"  Role notifications: {member_role_notifs}")
    print(f"  Group notifications: {member_group_notifs}")
    
    print("\n📋 Next Steps:")
    print("1. Open the frontend application")
    print("2. Log in as the test user")
    print("3. Check the notification bell - you should see these notifications")
    print("4. Click on role notification - should go to /profile with Organization Member tab")
    print("5. Click on group notification - should go to /group-list")


if __name__ == '__main__':
    create_fresh_notifications()
