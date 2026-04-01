"""
Monitor latest advance payment to verify payment method
Run this script, then make a cash advance payment through the web interface
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling, AdvancePayment, PaymentMethod
from django.utils import timezone
import time

def print_latest_advance_payment():
    """Show the latest advance payment with full details"""
    
    print("\n" + "="*80)
    print("  LATEST ADVANCE PAYMENT CHECK")
    print("="*80 + "\n")
    
    # Get latest ServiceFeeBilling with advance_payment type
    latest_billing = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment'
    ).order_by('-created_at').first()
    
    if latest_billing:
        print("📋 Latest ServiceFeeBilling (advance_payment):")
        print(f"   ID: {latest_billing.id}")
        print(f"   Billing ID: {latest_billing.billing_id}")
        print(f"   Amount: {latest_billing.total_paid} BDT")
        print(f"   Created: {latest_billing.created_at}")
        print(f"   Gateway: {latest_billing.payment_gateway or 'None (Cash Payment)'}")
        print(f"\n   💳 Payment Method: {latest_billing.payment_method.method_name if latest_billing.payment_method else 'NULL'}")
        print(f"   💳 Payment Method ID: {latest_billing.payment_method_id}")
        
        if latest_billing.payment_gateway == 'paystation':
            print(f"\n   ℹ️  This is a PayStation payment (online gateway) - bKash is correct")
        else:
            if latest_billing.payment_method_id == 2:
                print(f"\n   ✅ CORRECT! Cash payment shows Cash (ID: 2)")
            elif latest_billing.payment_method_id == 1:
                print(f"\n   ❌ WRONG! Cash payment shows bKash (ID: 1) - Fix not working!")
            else:
                pm_name = latest_billing.payment_method.method_name if latest_billing.payment_method else "Unknown"
                print(f"\n   ⚠️  Unexpected payment method: {pm_name} (ID: {latest_billing.payment_method_id})")
    else:
        print("❌ No advance payment billing records found")
    
    print("\n" + "-"*80 + "\n")
    
    # Get latest AdvancePayment
    latest_advance = AdvancePayment.objects.order_by('-created_at').first()
    
    if latest_advance:
        print("💰 Latest AdvancePayment:")
        print(f"   ID: {latest_advance.id}")
        print(f"   Amount: {latest_advance.amount} BDT")
        print(f"   Remaining: {latest_advance.remaining_amount} BDT")
        print(f"   Status: {latest_advance.status}")
        print(f"   Created: {latest_advance.created_at}")
        print(f"\n   💳 Payment Method: {latest_advance.payment_method.method_name if latest_advance.payment_method else 'NULL'}")
        print(f"   💳 Payment Method ID: {latest_advance.payment_method_id}")
        
        if latest_advance.payment_method_id == 2:
            print(f"\n   ✅ CORRECT! Shows Cash (ID: 2)")
        elif latest_advance.payment_method_id == 1:
            print(f"\n   ❌ WRONG! Shows bKash (ID: 1)")
        else:
            pm_name = latest_advance.payment_method.method_name if latest_advance.payment_method else "Unknown"
            print(f"\n   ⚠️  Unexpected: {pm_name} (ID: {latest_advance.payment_method_id})")
    else:
        print("❌ No advance payment records found")
    
    print("\n" + "="*80)

def watch_mode():
    """Continuously monitor for new advance payments"""
    
    print("\n" + "="*80)
    print("  WATCHING FOR NEW ADVANCE PAYMENTS")
    print("="*80)
    print("\n⏱️  Monitoring database every 3 seconds...")
    print("📝 Make a cash advance payment through the web interface now")
    print("🛑 Press Ctrl+C to stop\n")
    
    # Get initial latest ID
    latest_billing = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment'
    ).order_by('-created_at').first()
    
    last_id = latest_billing.id if latest_billing else 0
    print(f"Starting from billing ID: {last_id}\n")
    
    try:
        while True:
            time.sleep(3)
            
            # Check for new records
            latest_billing = ServiceFeeBilling.objects.filter(
                payment_type='advance_payment'
            ).order_by('-created_at').first()
            
            if latest_billing and latest_billing.id > last_id:
                print(f"\n🔔 NEW PAYMENT DETECTED! (ID: {latest_billing.id})")
                print_latest_advance_payment()
                last_id = latest_billing.id
            else:
                print(".", end="", flush=True)
                
    except KeyboardInterrupt:
        print("\n\n✋ Monitoring stopped")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'watch':
        watch_mode()
    else:
        print("\n💡 Usage:")
        print("   python check_latest_advance.py        - Show latest advance payment")
        print("   python check_latest_advance.py watch  - Watch for new payments\n")
        print_latest_advance_payment()
