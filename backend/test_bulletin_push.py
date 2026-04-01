#!/usr/bin/env python
"""
Test script to create a bulletin and verify push notifications are sent
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from user.models import Member
from notifications.models import DeviceToken

print("=" * 80)
print("🧪 Testing Bulletin Push Notifications")
print("=" * 80)
print()

# Get user12 (the provided test user)
try:
    user = Member.objects.get(user__username='user12')
    print(f"✅ Found user: {user.full_name} (ID: {user.id})")
except Member.DoesNotExist:
    print("❌ User 'user12' not found. Using first available member...")
    user = Member.objects.filter(is_org_member=True).first()
    if not user:
        print("❌ No members found!")
        sys.exit(1)
    print(f"✅ Using user: {user.full_name} (ID: {user.id})")

# Check device tokens
tokens = DeviceToken.objects.filter(is_active=True)
print(f"\n📱 Active device tokens: {tokens.count()}")
for token in tokens:
    print(f"   • {token.member.full_name}: {token.token_type} token")

# Create a test bulletin
print("\n📝 Creating test bulletin...")
bulletin = Bulletin.objects.create(
    title="🧪 TEST PUSH NOTIFICATION",
    description="This is a test bulletin to verify mobile push notifications work correctly.",
    creator=user,
    status='active',
    priority='high'
)

print(f"✅ Created bulletin #{bulletin.id}: {bulletin.title}")
print("\n🔔 Push notification should have been triggered by the signal!")
print("   Check your mobile device notification bar.")
print()
print("=" * 80)
