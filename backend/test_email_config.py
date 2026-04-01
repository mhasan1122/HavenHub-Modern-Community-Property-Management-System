#!/usr/bin/env python
"""
Quick test script to verify email configuration is working
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("\n" + "="*60)
print("📧 TESTING EMAIL CONFIGURATION")
print("="*60)

print(f"\n📋 Current Email Settings:")
print(f"   Backend: {settings.EMAIL_BACKEND}")
print(f"   Host: {settings.EMAIL_HOST}")
print(f"   Port: {settings.EMAIL_PORT}")
print(f"   Use TLS: {settings.EMAIL_USE_TLS}")
print(f"   Host User: {settings.EMAIL_HOST_USER}")
print(f"   Password: {'*' * len(settings.EMAIL_HOST_PASSWORD)}")

# Test email address - change this to YOUR email
test_email = input("\n📧 Enter your email address to test: ").strip()

if not test_email or '@' not in test_email:
    print("❌ Invalid email address!")
    sys.exit(1)

print(f"\n📤 Sending test email to: {test_email}")
print("   Please wait...")

try:
    result = send_mail(
        subject='Test Email from Estate Link',
        message='This is a test email to verify email configuration is working correctly.\n\nIf you receive this, emails are working! 🎉',
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=[test_email],
        fail_silently=False,
    )
    
    if result:
        print("\n✅ EMAIL SENT SUCCESSFULLY!")
        print(f"   Check your inbox: {test_email}")
        print(f"   (Also check spam folder just in case)")
        print(f"\n   Email server returned: {result} (1 = success)")
    else:
        print("\n❌ Email sending failed!")
        print(f"   Email server returned: {result}")
        
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    
    print("\n💡 Common Issues:")
    print("   1. Gmail requires 'App Password' not regular password")
    print("      → Go to: https://myaccount.google.com/apppasswords")
    print("   2. Check if 'Less secure app access' is enabled (for older accounts)")
    print("   3. Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in settings.py")
    print("   4. Check firewall/network allows SMTP traffic (port 587)")

print("\n" + "="*60)

