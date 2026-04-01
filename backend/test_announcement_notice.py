#!/usr/bin/env python
"""
Test push notifications for Announcement and Notice
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

import time
from datetime import datetime, timedelta
from django.utils import timezone
from announcements.models import Announcement
from noticeboard.models import Notice
from user.models import Member
from notifications.models import Notification, DeviceToken

print('=' * 80)
print('🧪 TESTING PUSH NOTIFICATIONS: ANNOUNCEMENT & NOTICE')
print('=' * 80)

# Get creator
creator = Member.objects.get(id=1)
print(f'\n👤 User: {creator.full_name}')

# Check tokens
tokens = DeviceToken.objects.filter(member=creator, is_active=True)
fcm_tokens = tokens.filter(token_type='fcm')
print(f'📱 Device Tokens: {tokens.count()} total, {fcm_tokens.count()} FCM')

# =============================================================================
# TEST 1: ANNOUNCEMENT
# =============================================================================
print('\n' + '=' * 80)
print('1️⃣  TESTING ANNOUNCEMENT PUSH NOTIFICATION')
print('=' * 80)

now = timezone.now()
announcement = Announcement.objects.create(
    title='📢 TEST ANNOUNCEMENT - Mobile Push',
    description='This announcement should trigger a mobile notification!',
    creator=creator,
    post_as='creator',
    priority='high',
    label='Test',
    status='ongoing',
    start_date=now.date(),
    start_time=now.time(),
    end_date=(now + timedelta(days=7)).date(),
    end_time=(now + timedelta(days=7)).time()
)
print(f'✅ Created announcement #{announcement.id}')

# Wait for signal
print('⏳ Waiting for signal handler...')
time.sleep(2)

# Check notifications
notifs = Notification.objects.filter(entity_type='announcement', entity_id=announcement.id)
print(f'📬 Notifications created: {notifs.count()}')
for n in notifs[:3]:  # Show first 3
    print(f'   → {n.recipient.full_name}: push={n.metadata.get("should_send_push")}')

# =============================================================================
# TEST 2: NOTICE
# =============================================================================
print('\n' + '=' * 80)
print('2️⃣  TESTING NOTICE PUSH NOTIFICATION')
print('=' * 80)

# Check if Notice has signals
try:
    notice = Notice.objects.create(
        internal_title='🔔 TEST NOTICE - Mobile Push',
        creator=creator,
        post_as='creator',
        priority='urgent',
        label='Test',
        status='ongoing',
        start_date=now.date(),
        start_time=now.time(),
        end_date=(now + timedelta(days=7)).date(),
        end_time=(now + timedelta(days=7)).time()
    )
    print(f'✅ Created notice #{notice.id}')
    
    # Wait for signal
    print('⏳ Waiting for signal handler...')
    time.sleep(2)
    
    # Check notifications
    notifs = Notification.objects.filter(entity_type='notice', entity_id=notice.id)
    print(f'📬 Notifications created: {notifs.count()}')
    for n in notifs[:3]:  # Show first 3
        print(f'   → {n.recipient.full_name}: push={n.metadata.get("should_send_push")}')
        
except Exception as e:
    print(f'⚠️  Error creating notice: {e}')
    print('Note: Notice model fields might be different. Checking...')

# =============================================================================
# SUMMARY
# =============================================================================
print('\n' + '=' * 80)
print('🔔 CHECK YOUR MOBILE DEVICE NOTIFICATION BAR!')
print('=' * 80)
print('\nYou should see:')
print('  1. 📢 TEST ANNOUNCEMENT - Mobile Push')
print('  2. 🔔 TEST NOTICE - Mobile Push')
print('\nIf you see both notifications, the system is fully working! ✅')
