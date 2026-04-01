#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Simple script to insert a dummy device token and verify it saves
"""
import os
import sys
import django
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from notifications.models import DeviceToken
from user.models import Member
from django.utils import timezone
from django.db import connection

def main():
    print("\n" + "="*80)
    print("INSERTING DUMMY DEVICE TOKEN")
    print("="*80)
    
    # Step 1: Find member
    try:
        member = Member.objects.get(id=41)
        print(f"\n✅ Found member: {member.full_name} (ID: {member.id})")
    except Member.DoesNotExist:
        print("\n❌ Member 41 not found. Using first member...")
        member = Member.objects.first()
        if not member:
            print("❌ No members in database!")
            return
        print(f"✅ Using member: {member.full_name} (ID: {member.id})")
    
    # Step 2: Create token
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    dummy_token = f"ExponentPushToken[DUMMY-{timestamp}]"
    
    print(f"\n📝 Creating device token:")
    print(f"   Member: {member.full_name} (ID: {member.id})")
    print(f"   Token: {dummy_token}")
    print(f"   Device: android - DUMMY_DEVICE")
    
    try:
        device_token = DeviceToken.objects.create(
            member=member,
            push_token=dummy_token,
            device_type='android',
            device_id='DUMMY_DEVICE',
            is_active=True,
            last_used_at=timezone.now()
        )
        
        print(f"\n✅ Device token created with ID: {device_token.id}")
        
        # Step 3: Immediately verify with ORM
        print(f"\n🔍 Verifying with ORM...")
        check_orm = DeviceToken.objects.filter(id=device_token.id).first()
        if check_orm:
            print(f"✅ ORM CHECK PASSED - Token {device_token.id} found")
            print(f"   Member: {check_orm.member.full_name}")
            print(f"   Token: {check_orm.push_token}")
            print(f"   Device: {check_orm.device_type} - {check_orm.device_id}")
        else:
            print(f"❌ ORM CHECK FAILED - Token {device_token.id} NOT found!")
        
        # Step 4: Verify with raw SQL
        print(f"\n🔍 Verifying with Raw SQL...")
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, member_id, push_token, device_type, device_id FROM notifications_devicetoken WHERE id = %s",
                [device_token.id]
            )
            row = cursor.fetchone()
            if row:
                print(f"✅ SQL CHECK PASSED - Token {row[0]} found")
                print(f"   Member ID: {row[1]}")
                print(f"   Token: {row[2]}")
                print(f"   Device: {row[3]} - {row[4]}")
            else:
                print(f"❌ SQL CHECK FAILED - Token {device_token.id} NOT found!")
        
        # Step 5: Count all tokens
        print(f"\n📊 Token Statistics:")
        total_tokens = DeviceToken.objects.count()
        print(f"   Total tokens in database: {total_tokens}")
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM notifications_devicetoken")
            sql_count = cursor.fetchone()[0]
            print(f"   Total tokens (raw SQL): {sql_count}")
        
        if total_tokens == sql_count:
            print(f"✅ ORM and SQL counts MATCH")
        else:
            print(f"❌ WARNING: ORM count ({total_tokens}) != SQL count ({sql_count})")
        
        # Step 6: Show last 5 tokens
        print(f"\n📋 Last 5 tokens in database:")
        recent_tokens = DeviceToken.objects.all().order_by('-id')[:5]
        for token in recent_tokens:
            print(f"   ID {token.id}: {token.member.full_name} - {token.push_token[:40]}...")
        
        print(f"\n" + "="*80)
        print("✅ SUCCESS - DUMMY TOKEN INSERTED AND VERIFIED")
        print("="*80)
        
        # Step 7: Ask if user wants to keep or delete
        print(f"\nDummy token ID: {device_token.id}")
        print(f"Token: {dummy_token}")
        
        return device_token.id
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    token_id = main()
    if token_id:
        print(f"\n💡 To delete this dummy token, run:")
        print(f"   python manage.py shell -c \"from notifications.models import DeviceToken; DeviceToken.objects.filter(id={token_id}).delete()\"")
