#!/usr/bin/env python
"""
Quick test to send email to mmau6295@gmail.com
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
import datetime

print("\n" + "="*70)
print("📧 SENDING TEST EMAIL")
print("="*70)

print(f"\n📋 Email Configuration:")
print(f"   Backend: {settings.EMAIL_BACKEND}")
print(f"   From: {settings.EMAIL_HOST_USER}")
print(f"   To: mmau6295@gmail.com")

print(f"\n⏳ Sending email...")

try:
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    result = send_mail(
        subject='✅ Test Email - Estate Link Configuration Working!',
        message=f'''Hello!

This is a test email to verify that Estate Link's email configuration is working correctly.

✅ Email backend: SMTP (smtp.gmail.com)
✅ Async email sending: Enabled
✅ Sent at: {timestamp}

If you receive this email, it means:
- Email configuration is correct
- SMTP backend is working
- Bulk uploads will now send credential emails successfully

Next Steps:
1. Try a small bulk upload with 2-3 test records
2. Check your inbox within 30 seconds
3. Emails should arrive almost immediately!

Best regards,
Estate Link System
''',
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=['mmau6295@gmail.com'],
        fail_silently=False,
    )
    
    if result:
        print(f"\n✅ SUCCESS! Email sent successfully!")
        print(f"   📬 Check inbox: mmau6295@gmail.com")
        print(f"   📱 Also check spam folder just in case")
        print(f"   ⏱️  Should arrive within 30 seconds")
        print(f"\n   Server response: {result} email(s) sent")
    else:
        print(f"\n❌ Email sending failed!")
        print(f"   Server returned: {result}")
        
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    
    print("\n💡 Troubleshooting:")
    print("   1. Make sure Django server is NOT running (stop it first)")
    print("   2. Check Gmail App Password is correct")
    print("   3. Verify internet connection")
    print("   4. Try restarting Django server after this test")

print("\n" + "="*70)

