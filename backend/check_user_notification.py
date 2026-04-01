"""
Check if specific user (mirza hasan) with device tokens received notification
Run with: python manage.py shell < check_user_notification.py
"""

from notifications.models import Notification, DeviceToken
from user.models import Member

print("\n" + "=" * 70)
print("CHECKING NOTIFICATIONS FOR USER WITH DEVICE TOKENS")
print("=" * 70)

# Find user with device tokens
members_with_tokens = Member.objects.filter(
    device_tokens__isnull=False,
    device_tokens__is_active=True
).distinct()

print(f"\n👥 Members with active device tokens: {members_with_tokens.count()}")
for member in members_with_tokens[:5]:
    token_count = member.device_tokens.filter(is_active=True).count()
    print(f"  - {member.full_name}: {token_count} token(s)")

# Check specific user (mirza hasan)
mirza = Member.objects.filter(full_name__icontains='mirza hasan').first()
if mirza:
    print(f"\n🔍 CHECKING USER: {mirza.full_name} (ID: {mirza.id})")
    
    # Device tokens
    tokens = DeviceToken.objects.filter(member=mirza, is_active=True)
    print(f"\n📱 Device Tokens: {tokens.count()}")
    for token in tokens:
        print(f"  - Type: {token.token_type}, Device: {token.device_type}")
        print(f"    Token: {token.push_token[:60]}...")
    
    # Recent notifications (last 10)
    notifications = Notification.objects.filter(
        recipient=mirza
    ).order_by('-created_at')[:10]
    
    print(f"\n📨 Recent Notifications: {notifications.count()}")
    for notif in notifications[:5]:
        print(f"\n  #{notif.id} - {notif.created_at.strftime('%H:%M:%S')}")
        print(f"    Type: {notif.notification_type.code if notif.notification_type else 'N/A'}")
        print(f"    Title: {notif.title}")
        print(f"    Message: {notif.message[:80]}...")
        print(f"    Read: {notif.is_read}")
        print(f"    Should push: {notif.metadata.get('should_send_push', False) if notif.metadata else 'N/A'}")
    
    # Check for recent priority change notifications
    priority_notifs = Notification.objects.filter(
        recipient=mirza,
        notification_type__code__icontains='priority'
    ).order_by('-created_at')[:3]
    
    if priority_notifs.exists():
        print(f"\n⚡ Priority Change Notifications: {priority_notifs.count()}")
        for notif in priority_notifs:
            print(f"  - {notif.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    {notif.title}")
            print(f"    Should push: {notif.metadata.get('should_send_push', False) if notif.metadata else 'N/A'}")
    else:
        print(f"\n  No priority change notifications found for this user")

print("\n" + "=" * 70)
