"""
Diagnostic script to check announcement notification channels and recipients
Run: python manage.py shell < check_announcement_notifications.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from announcements.models import Announcement
from notifications.models import Notification
from user.models import Member
from towers.models import Unit, Resident, Owner, UnitStaff

print("=" * 80)
print("ANNOUNCEMENT NOTIFICATION DIAGNOSTIC")
print("=" * 80)

# Get the most recent announcement
latest_announcement = Announcement.objects.order_by('-created_at').first()

if not latest_announcement:
    print("❌ No announcements found")
    exit()

print(f"\n📢 Latest Announcement:")
print(f"   ID: {latest_announcement.id}")
print(f"   Title: {latest_announcement.title}")
print(f"   Status: {latest_announcement.status}")
print(f"   Priority: {latest_announcement.priority}")
print(f"   Creator: {latest_announcement.creator.full_name if latest_announcement.creator else 'Unknown'} (ID: {latest_announcement.creator.id if latest_announcement.creator else 'N/A'})")
print(f"   Created: {latest_announcement.created_at}")

# Check targeting
target_towers = list(latest_announcement.target_towers.all())
target_units = list(latest_announcement.target_units.all())

print(f"\n🎯 Targeting:")
if target_towers:
    print(f"   Towers: {[f'{t.name} (ID: {t.id})' for t in target_towers]}")
else:
    print(f"   Towers: None (All towers)")

if target_units:
    print(f"   Units: {[f'{u.unit_number} (ID: {u.id})' for u in target_units]}")
else:
    print(f"   Units: None (All units in selected towers)")

# Check all notifications for this announcement
notifications = Notification.objects.filter(
    entity_type='announcement',
    entity_id=latest_announcement.id
).select_related('recipient', 'notification_type')

print(f"\n📬 Notifications Created: {notifications.count()}")

if notifications.count() == 0:
    print("   ⚠️  No notifications were created for this announcement!")
    print("\n   Possible reasons:")
    print("   1. The notification creation function crashed (check the backend logs)")
    print("   2. No recipients matched the targeting criteria")
    print("   3. The creator is not in the targeted tower/unit")
else:
    # Group by channel
    channels = {}
    for notif in notifications:
        channel = notif.channel
        if channel not in channels:
            channels[channel] = []
        channels[channel].append(notif)
    
    print(f"\n📡 By Channel:")
    for channel, notifs in channels.items():
        print(f"   {channel.upper()}: {len(notifs)} notifications")
        for n in notifs[:3]:  # Show first 3
            print(f"      - {n.notification_type.code} → {n.recipient.full_name} (ID: {n.recipient.id})")
        if len(notifs) > 3:
            print(f"      ... and {len(notifs) - 3} more")
    
    # Check notification types
    print(f"\n📝 By Type:")
    types = {}
    for notif in notifications:
        ntype = notif.notification_type.code
        if ntype not in types:
            types[ntype] = []
        types[ntype].append(notif)
    
    for ntype, notifs in types.items():
        print(f"   {ntype}: {len(notifs)} notifications")

# Check if creator is in Tower 2
if latest_announcement.creator:
    creator = latest_announcement.creator
    print(f"\n👤 Creator Membership Check:")
    print(f"   Name: {creator.full_name}")
    print(f"   Is Org Member: {creator.is_org_member}")
    
    # Check if creator has any units in the targeted towers
    if target_towers:
        creator_units = []
        
        # Check as resident
        resident_units = Resident.objects.filter(
            member=creator,
            is_active=True,
            unit__floor__tower__in=target_towers
        ).select_related('unit', 'unit__floor', 'unit__floor__tower')
        
        # Check as owner
        owner_units = Owner.objects.filter(
            member=creator,
            unit__floor__tower__in=target_towers
        ).select_related('unit', 'unit__floor', 'unit__floor__tower')
        
        # Check as staff
        staff_units = UnitStaff.objects.filter(
            member=creator,
            is_active=True,
            unit__floor__tower__in=target_towers
        ).select_related('unit', 'unit__floor', 'unit__floor__tower')
        
        for res in resident_units:
            creator_units.append(f"Resident of {res.unit.unit_number} in {res.unit.floor.tower.name}")
        
        for own in owner_units:
            creator_units.append(f"Owner of {own.unit.unit_number} in {own.unit.floor.tower.name}")
        
        for staff in staff_units:
            creator_units.append(f"Staff of {staff.unit.unit_number} in {staff.unit.floor.tower.name}")
        
        if creator_units:
            print(f"   Units in Targeted Towers:")
            for unit in creator_units:
                print(f"      ✅ {unit}")
        else:
            print(f"   ⚠️  Creator has NO units in the targeted towers!")
            print(f"      This means they won't receive mobile notifications for this announcement")

# Summary for mobile
print(f"\n📱 Mobile App Visibility:")
mobile_notifications = notifications.exclude(channel='web')
print(f"   Notifications visible on mobile: {mobile_notifications.count()}")

if mobile_notifications.count() > 0:
    print(f"   Recipients:")
    for n in mobile_notifications[:10]:
        print(f"      - {n.recipient.full_name} (ID: {n.recipient.id}) - Channel: {n.channel}, Type: {n.notification_type.code}")
else:
    print(f"   ❌ No notifications will show on mobile!")
    print(f"\n   Diagnosis:")
    web_only = notifications.filter(channel='web').count()
    if web_only > 0:
        print(f"      • Found {web_only} notifications with channel='web' (not visible on mobile)")
        print(f"      • These are likely admin notifications intended for web dashboard only")
        print(f"      • Regular users should have channel='both' or 'mobile'")
        print(f"      • Admin users should have regular notifications with channel='mobile'")

# Check for specific user if needed
print(f"\n" + "=" * 80)
print("To check a specific user, enter their user ID (or press Enter to skip):")
# For script execution, skip this interactive part
print("(Skipped in script mode)")
print("=" * 80)
