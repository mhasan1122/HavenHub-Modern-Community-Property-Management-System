#!/usr/bin/env python
"""
Django management script to fix notification channels for service fee bills and payments
Updates all existing notifications to have channel='both' and should_send_push=True
to enable push notifications on Android and iOS.

Run with: python manage.py shell < fix_notification_channels.py
Or: exec(open('fix_notification_channels.py').read())
"""

from notifications.models import Notification
from django.utils import timezone

print("="*80)
print("FIXING SERVICE FEE NOTIFICATION CHANNELS")
print("="*80)
print()

# Fix bill generated notifications
print("1. Fixing BILL GENERATED notifications...")
bill_notifs = Notification.objects.filter(
    notification_type__code='service_fee_bills_generated'
)
bill_count = bill_notifs.count()
print(f"   Found: {bill_count} notifications")

if bill_count > 0:
    # Check current state
    web_only = bill_notifs.filter(channel='web').count()
    both = bill_notifs.filter(channel='both').count()
    print(f"   - Currently 'web' only: {web_only}")
    print(f"   - Currently 'both': {both}")
    
    # Update to 'both' and enable push
    updated = 0
    for notif in bill_notifs.filter(channel='web'):
        notif.channel = 'both'
        if notif.metadata is None:
            notif.metadata = {}
        notif.metadata['should_send_push'] = True
        notif.save()
        updated += 1
    
    print(f"   ✅ Updated {updated} notifications to channel='both' with push enabled")
print()

# Fix payment received notifications
print("2. Fixing PAYMENT RECEIVED notifications...")
payment_notifs = Notification.objects.filter(
    notification_type__code='service_fee_payment_received'
)
payment_count = payment_notifs.count()
print(f"   Found: {payment_count} notifications")

if payment_count > 0:
    # Check current state
    web_only = payment_notifs.filter(channel='web').count()
    both = payment_notifs.filter(channel='both').count()
    print(f"   - Currently 'web' only: {web_only}")
    print(f"   - Currently 'both': {both}")
    
    # Update to 'both' and enable push
    updated = 0
    for notif in payment_notifs.filter(channel='web'):
        notif.channel = 'both'
        if notif.metadata is None:
            notif.metadata = {}
        notif.metadata['should_send_push'] = True
        notif.save()
        updated += 1
    
    print(f"   ✅ Updated {updated} notifications to channel='both' with push enabled")
print()

# Verify the fix
print("3. VERIFICATION:")
print()

bill_after = Notification.objects.filter(
    notification_type__code='service_fee_bills_generated',
    channel='both'
).count()
print(f"   Bill notifications with channel='both': {bill_after}")

payment_after = Notification.objects.filter(
    notification_type__code='service_fee_payment_received',
    channel='both'
).count()
print(f"   Payment notifications with channel='both': {payment_after}")

print()
print("="*80)
print("✅ FIX COMPLETE!")
print("="*80)
print()
print("Push notifications should now work for:")
print("  - Service Fee Bills Generated")
print("  - Payment Received")
print()
print("Users need to log in again to get fresh FCM tokens for the app to receive push.")
