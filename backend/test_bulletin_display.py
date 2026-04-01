"""
Quick test to verify bulletin notifications display correctly
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from user.models import Member
from bulletins.models import Bulletin
from notifications.models import Notification
from notifications.utils import should_show_notification
from group_role.permission_constants import PERMISSION_VIEW_BULLETIN_BOARD

# Get a member who has bulletin notifications
bulletin_notifs = Notification.objects.filter(entity_type='bulletin').select_related('recipient')[:10]
if bulletin_notifs:
    test_member = bulletin_notifs[0].recipient
    print(f'✓ Testing member: {test_member.full_name} (ID: {test_member.id})')
    print(f'  Member created at: {test_member.created_at}')
    
    # Get permission grant timestamp
    perm_ts = test_member.get_permission_grant_timestamp(PERMISSION_VIEW_BULLETIN_BOARD)
    print(f'  Permission grant timestamp: {perm_ts}')
    
    # Get bulletin notifications
    member_bulletin_notifs = Notification.objects.filter(recipient=test_member, entity_type='bulletin')
    print(f'\n📋 Total bulletin notifications in DB: {member_bulletin_notifs.count()}')
    
    shown_count = 0
    hidden_count = 0
    
    for notif in member_bulletin_notifs[:10]:
        bulletin = Bulletin.objects.filter(id=notif.entity_id).first()
        if bulletin:
            should_show = should_show_notification(test_member, notif)
            status = "✅ SHOW" if should_show else "❌ HIDE"
            created_str = bulletin.created_at.strftime("%Y-%m-%d %H:%M:%S") if bulletin.created_at else "Unknown"
            print(f'  {status} - Bulletin {bulletin.id}: created {created_str}')
            if should_show:
                shown_count += 1
            else:
                hidden_count += 1
        else:
            print(f'  ⚠️  Bulletin {notif.entity_id} not found (notification {notif.id})')
    
    print(f'\n📊 Results (first 10):')
    print(f'  Shown: {shown_count}')
    print(f'  Hidden: {hidden_count}')
    
    if hidden_count > 0:
        print(f'\n⚠️  {hidden_count} bulletin notifications are hidden (retroactive)')
    else:
        print(f'\n✅ All bulletin notifications will be displayed')
else:
    print('❌ No bulletin notifications found in database')
