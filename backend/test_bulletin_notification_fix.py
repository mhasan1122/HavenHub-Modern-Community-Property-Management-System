"""
Test script to verify the bulletin notification fix
Run this after creating a new bulletin to verify all users receive notifications
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from notifications.models import Notification
from notifications.utils import get_bulletin_recipients
from user.models import Member

def test_fix():
    """Test that the fix works correctly"""
    print("\n" + "="*80)
    print("BULLETIN NOTIFICATION FIX VERIFICATION")
    print("="*80 + "\n")
    
    # Get the most recent bulletin
    recent_bulletin = Bulletin.objects.order_by('-created_at').first()
    
    if not recent_bulletin:
        print("❌ No bulletins found. Please create a bulletin first.")
        return
    
    print(f"Testing with bulletin ID: {recent_bulletin.id}")
    print(f"Title: {recent_bulletin.title}")
    print(f"Status: {recent_bulletin.status}")
    print(f"Creator: {recent_bulletin.creator.full_name if recent_bulletin.creator else 'Unknown'}")
    print()
    
    # Get expected recipients
    recipients = get_bulletin_recipients(recent_bulletin)
    print(f"Expected recipients: {len(recipients)}")
    
    # Get actual notifications
    notifications = Notification.objects.filter(
        entity_type='bulletin',
        entity_id=recent_bulletin.id
    )
    print(f"Actual notifications sent: {notifications.count()}")
    print()
    
    if notifications.count() == 1 and len(recipients) > 1:
        print("❌ BUG DETECTED: Only 1 notification but multiple recipients expected!")
        print("   This bulletin was created BEFORE the fix.")
        print("   Please create a NEW bulletin to test the fix.\n")
    elif notifications.count() > 1:
        print("✅ FIX VERIFIED: Multiple users received notifications!")
        print(f"   {notifications.count()} notifications sent to different users\n")
        
        # Show some recipients
        print("Sample notification recipients:")
        for notif in notifications[:10]:
            print(f"  - {notif.recipient.full_name} (ID: {notif.recipient.id})")
        if notifications.count() > 10:
            print(f"  ... and {notifications.count() - 10} more\n")
    else:
        print("⚠️  Unable to determine if fix is working.")
        print(f"   Expected {len(recipients)} recipients")
        print(f"   Found {notifications.count()} notifications\n")
    
    print("="*80 + "\n")

if __name__ == '__main__':
    test_fix()
