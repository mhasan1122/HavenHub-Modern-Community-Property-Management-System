#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script to diagnose device token registration issues
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
from django.db import connection, transaction

def test_database_connection():
    """Test basic database connection"""
    print("\n" + "="*60)
    print("TEST 1: Database Connection")
    print("="*60)
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT DATABASE()")
            db_name = cursor.fetchone()[0]
            print(f"✅ Connected to database: {db_name}")
            
            cursor.execute("SELECT COUNT(*) FROM notifications_devicetoken")
            count = cursor.fetchone()[0]
            print(f"✅ Current device tokens in DB: {count}")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_member_exists():
    """Check if test member exists"""
    print("\n" + "="*60)
    print("TEST 2: Member Verification")
    print("="*60)
    
    try:
        member = Member.objects.get(id=41)
        print(f"✅ Found member: {member.full_name} (ID: {member.id})")
        return member
    except Member.DoesNotExist:
        print("❌ Member with ID 41 does not exist")
        print("Available members:")
        for m in Member.objects.all()[:5]:
            print(f"  - ID: {m.id}, Name: {m.full_name}")
        return None

def test_create_device_token_direct(member):
    """Test creating device token directly with ORM"""
    print("\n" + "="*60)
    print("TEST 3: Direct ORM Insert")
    print("="*60)
    
    test_token = f"ExponentPushToken[TEST-{datetime.now().strftime('%H%M%S')}]"
    
    try:
        # Delete any existing test tokens
        DeviceToken.objects.filter(push_token__startswith="ExponentPushToken[TEST-").delete()
        print("🧹 Cleaned up old test tokens")
        
        # Create new token
        device_token = DeviceToken.objects.create(
            member=member,
            push_token=test_token,
            device_type='android',
            device_id='TEST_DEVICE',
            is_active=True,
            last_used_at=timezone.now()
        )
        
        print(f"✅ Created device token with ID: {device_token.id}")
        print(f"   Token: {device_token.push_token}")
        print(f"   Member: {device_token.member.full_name}")
        
        # Verify it exists
        token_check = DeviceToken.objects.filter(id=device_token.id).first()
        if token_check:
            print(f"✅ VERIFIED: Token exists in database (ID: {token_check.id})")
            return device_token
        else:
            print(f"❌ FAILED: Token NOT found in database after creation!")
            return None
            
    except Exception as e:
        print(f"❌ Failed to create device token: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_update_or_create(member):
    """Test update_or_create method (same as API uses)"""
    print("\n" + "="*60)
    print("TEST 4: update_or_create (API Method)")
    print("="*60)
    
    test_token = f"ExponentPushToken[UPDATE-TEST-{datetime.now().strftime('%H%M%S')}]"
    
    try:
        device_token, created = DeviceToken.objects.update_or_create(
            member=member,
            push_token=test_token,
            defaults={
                'device_type': 'android',
                'device_id': 'UPDATE_TEST_DEVICE',
                'is_active': True,
                'last_used_at': timezone.now()
            }
        )
        
        status = "CREATED" if created else "UPDATED"
        print(f"✅ {status} device token with ID: {device_token.id}")
        print(f"   Token: {device_token.push_token}")
        print(f"   Member: {device_token.member.full_name}")
        
        # Verify it exists
        token_check = DeviceToken.objects.filter(id=device_token.id).first()
        if token_check:
            print(f"✅ VERIFIED: Token exists in database (ID: {token_check.id})")
            return device_token
        else:
            print(f"❌ FAILED: Token NOT found in database after {status.lower()}!")
            return None
            
    except Exception as e:
        print(f"❌ Failed update_or_create: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_transaction_commit():
    """Test if transactions are committing properly"""
    print("\n" + "="*60)
    print("TEST 5: Transaction Commit Test")
    print("="*60)
    
    member = Member.objects.first()
    if not member:
        print("❌ No members found")
        return False
    
    test_token = f"ExponentPushToken[TRANSACTION-TEST-{datetime.now().strftime('%H%M%S')}]"
    
    try:
        with transaction.atomic():
            device_token = DeviceToken.objects.create(
                member=member,
                push_token=test_token,
                device_type='android',
                device_id='TRANSACTION_TEST',
                is_active=True,
                last_used_at=timezone.now()
            )
            print(f"✅ Created token in transaction (ID: {device_token.id})")
        
        # Check if it exists after transaction commits
        token_check = DeviceToken.objects.filter(push_token=test_token).first()
        if token_check:
            print(f"✅ VERIFIED: Token persisted after transaction commit")
            return True
        else:
            print(f"❌ FAILED: Token NOT found after transaction commit!")
            return False
            
    except Exception as e:
        print(f"❌ Transaction test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_raw_sql_insert(member):
    """Test inserting directly with raw SQL"""
    print("\n" + "="*60)
    print("TEST 6: Raw SQL Insert")
    print("="*60)
    
    test_token = f"ExponentPushToken[RAW-SQL-{datetime.now().strftime('%H%M%S')}]"
    now = timezone.now()
    
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO notifications_devicetoken 
                (member_id, push_token, device_type, device_id, is_active, created_at, updated_at, last_used_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, [
                member.id,
                test_token,
                'android',
                'RAW_SQL_TEST',
                True,
                now,
                now,
                now
            ])
            print(f"✅ Raw SQL insert executed")
            
            # Get the inserted ID
            cursor.execute("SELECT LAST_INSERT_ID()")
            inserted_id = cursor.fetchone()[0]
            print(f"✅ Inserted with ID: {inserted_id}")
            
            # Verify with SELECT
            cursor.execute("SELECT COUNT(*) FROM notifications_devicetoken WHERE push_token = %s", [test_token])
            count = cursor.fetchone()[0]
            
            if count > 0:
                print(f"✅ VERIFIED: Token found with raw SQL query")
                
                # Also verify with ORM
                token_check = DeviceToken.objects.filter(push_token=test_token).first()
                if token_check:
                    print(f"✅ VERIFIED: Token also visible via ORM")
                    return True
                else:
                    print(f"❌ WARNING: Token found with raw SQL but NOT via ORM!")
                    return False
            else:
                print(f"❌ FAILED: Token NOT found after raw SQL insert!")
                return False
                
    except Exception as e:
        print(f"❌ Raw SQL insert failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def show_all_tokens():
    """Display all device tokens"""
    print("\n" + "="*60)
    print("CURRENT DEVICE TOKENS IN DATABASE")
    print("="*60)
    
    tokens = DeviceToken.objects.all().order_by('-id')[:10]
    
    if tokens:
        print(f"Total tokens: {DeviceToken.objects.count()}")
        print("\nMost recent tokens:")
        for token in tokens:
            print(f"  ID: {token.id}")
            print(f"     Member: {token.member.full_name} (ID: {token.member_id})")
            print(f"     Token: {token.push_token[:40]}...")
            print(f"     Device: {token.device_type} - {token.device_id}")
            print(f"     Active: {token.is_active}")
            print(f"     Created: {token.created_at}")
            print()
    else:
        print("❌ NO TOKENS FOUND IN DATABASE")

def cleanup_test_tokens():
    """Clean up test tokens"""
    print("\n" + "="*60)
    print("CLEANUP")
    print("="*60)
    
    try:
        deleted_count = DeviceToken.objects.filter(
            push_token__startswith="ExponentPushToken[TEST-"
        ).delete()[0]
        
        deleted_count += DeviceToken.objects.filter(
            push_token__startswith="ExponentPushToken[UPDATE-TEST-"
        ).delete()[0]
        
        deleted_count += DeviceToken.objects.filter(
            push_token__startswith="ExponentPushToken[TRANSACTION-TEST-"
        ).delete()[0]
        
        deleted_count += DeviceToken.objects.filter(
            push_token__startswith="ExponentPushToken[RAW-SQL-"
        ).delete()[0]
        
        print(f"✅ Cleaned up {deleted_count} test tokens")
    except Exception as e:
        print(f"⚠️ Cleanup warning: {e}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("DEVICE TOKEN REGISTRATION DIAGNOSTIC TESTS")
    print("="*80)
    
    # Test 1: Database connection
    if not test_database_connection():
        print("\n❌ Cannot proceed - database connection failed")
        return
    
    # Test 2: Member exists
    member = test_member_exists()
    if not member:
        print("\n❌ Cannot proceed - test member not found")
        return
    
    # Test 3: Direct ORM insert
    token1 = test_create_device_token_direct(member)
    
    # Test 4: update_or_create (same as API)
    token2 = test_update_or_create(member)
    
    # Test 5: Transaction commit
    test_transaction_commit()
    
    # Test 6: Raw SQL
    test_raw_sql_insert(member)
    
    # Show current state
    show_all_tokens()
    
    # Cleanup
    cleanup_test_tokens()
    
    # Final summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    final_count = DeviceToken.objects.count()
    print(f"Final device token count: {final_count}")
    
    if token1 or token2:
        print("✅ At least one test succeeded - ORM is working")
        print("\n⚠️  IF API STILL FAILS:")
        print("   1. Check if API is using a different database")
        print("   2. Check for transaction rollback in the view")
        print("   3. Check for exceptions being caught silently")
        print("   4. Enable Django DEBUG=True and check for errors")
    else:
        print("❌ All ORM tests failed - there's a serious database issue")
        print("\n🔍 NEXT STEPS:")
        print("   1. Check database permissions")
        print("   2. Check MySQL/MariaDB error logs")
        print("   3. Try restarting database server")
        print("   4. Check for disk space issues")

if __name__ == '__main__':
    main()
