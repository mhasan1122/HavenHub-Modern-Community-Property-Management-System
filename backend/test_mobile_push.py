#!/usr/bin/env python
"""
Simple test to create bulletin and send push notification to mobile
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

import time
from bulletins.models import Bulletin
from user.models import Member
from notifications.models import Notification, DeviceToken

print('=' * 70)
print('🧪 TESTING PUSH NOTIFICATION TO MOBILE DEVICE')
print('=' * 70)

# Get creator
creator = Member.objects.get(id=1)
print(f'\n👤 User: {creator.full_name}')

# Check tokens
tokens = DeviceToken.objects.filter(member=creator, is_active=True)
fcm_tokens = tokens.filter(token_type='fcm')
print(f'📱 Device Tokens: {tokens.count()} total, {fcm_tokens.count()} FCM')

# Create bulletin
print(f'\n📝 Creating test bulletin...')
bulletin = Bulletin.objects.create(
    title='🔔 MOBILE NOTIFICATION TEST',
    description='If you see this notification on your phone, the system works!',
    creator=creator,
    status='active',
    priority='urgent'
)
print(f'✅ Created bulletin #{bulletin.id}')

# Wait for signal to process
print('\n⏳ Waiting for signal handler...')
time.sleep(2)

# Check notifications
notifs = Notification.objects.filter(entity_type='bulletin', entity_id=bulletin.id)
print(f'\n📬 Notifications created: {notifs.count()}')
for n in notifs:
    print(f'   → {n.recipient.full_name}')
    print(f'     Should send push: {n.metadata.get("should_send_push", False)}')

print(f'\n' + '=' * 70)
print('🔔 CHECK YOUR MOBILE DEVICE NOTIFICATION BAR NOW!')
print('=' * 70)
print(f'\nBulletin ID: {bulletin.id}')
print(f'Title: {bulletin.title}')
print(f'\nIf you see a notification, the system is working! ✅')
