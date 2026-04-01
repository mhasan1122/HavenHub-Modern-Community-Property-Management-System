#!/usr/bin/env python
"""
Direct test to send email and verify Gmail configuration
Run this to test if Gmail is actually accepting emails
"""
import os
import sys

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from django.core.mail import send_mail
from django.conf import settings
import smtplib
from email.mime.text import MIMEText

print("\n" + "="*70)
print("📧 DIRECT GMAIL TEST")
print("="*70)

print(f"\n📋 Current Configuration:")
print(f"   SMTP Host: {settings.EMAIL_HOST}")
print(f"   SMTP Port: {settings.EMAIL_PORT}")
print(f"   Use TLS: {settings.EMAIL_USE_TLS}")
print(f"   From Email: {settings.EMAIL_HOST_USER}")
print(f"   Password: {'*' * len(settings.EMAIL_HOST_PASSWORD)} ({len(settings.EMAIL_HOST_PASSWORD)} chars)")

# Test email
test_recipient = "mirzahasanlimon@gmail.com"

print(f"\n🔍 Test 1: Django send_mail()")
print(f"   Sending to: {test_recipient}")

try:
    result = send_mail(
        subject='🔥 URGENT TEST - Estate Link Email Config',
        message=f'''This is a DIRECT test email sent at {__import__("datetime").datetime.now()}

If you receive this:
✅ Django can send emails
✅ SMTP configuration is correct
✅ Gmail is accepting messages

Check these folders:
1. Inbox (if you see this)
2. Spam (most likely here!)
3. All Mail

Username for testing: user1234
Password for testing: test123

Please confirm receipt!
''',
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=[test_recipient],
        fail_silently=False,
    )
    
    print(f"   ✅ Django Result: {result}")
    print(f"   💡 If result=1, email was sent to Gmail's SMTP server")
    
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

print(f"\n🔍 Test 2: Direct SMTP Connection")
try:
    # Connect directly to Gmail SMTP
    print(f"   Connecting to {settings.EMAIL_HOST}:{settings.EMAIL_PORT}...")
    server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=10)
    server.set_debuglevel(1)  # Show SMTP conversation
    
    print(f"   Starting TLS...")
    server.starttls()
    
    print(f"   Logging in as {settings.EMAIL_HOST_USER}...")
    server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
    
    print(f"   ✅ SMTP Login successful!")
    print(f"   Sending test email...")
    
    msg = MIMEText("Direct SMTP test - if you see this, SMTP works perfectly!")
    msg['Subject'] = '🔥 Direct SMTP Test'
    msg['From'] = settings.EMAIL_HOST_USER
    msg['To'] = test_recipient
    
    server.send_message(msg)
    server.quit()
    
    print(f"   ✅ Direct SMTP send successful!")
    
except smtplib.SMTPAuthenticationError as e:
    print(f"   ❌ Authentication failed!")
    print(f"      Error: {e}")
    print(f"\n   💡 This means:")
    print(f"      - App password is wrong/expired")
    print(f"      - Need to regenerate at: https://myaccount.google.com/apppasswords")
    
except Exception as e:
    print(f"   ❌ Connection error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
print("📬 NEXT STEPS:")
print("="*70)
print(f"1. Check SPAM folder in: {test_recipient}")
print(f"2. Check All Mail in Gmail")
print(f"3. Search for: 'from:{settings.EMAIL_HOST_USER}'")
print(f"4. If email not found anywhere → App password issue")
print(f"5. If email in spam → Mark 'Not Spam' and try again")
print("="*70)

