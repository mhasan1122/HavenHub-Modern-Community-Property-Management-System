"""
Test script to verify advance payment fix - payment_method should be Cash (ID 2) for non-gateway payments
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling, AdvancePayment, PaymentMethod
from towers.models import Unit
from user.models import Member
from django.db import connection

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_advance_payment_fix():
    """Test the advance payment payment_method fix"""
    
    print_section("ADVANCE PAYMENT FIX TEST")
    
    # 1. Check Payment Methods in database
    print("📋 Available Payment Methods:")
    payment_methods = PaymentMethod.objects.all().values('id', 'method_name', 'is_active')
    for pm in payment_methods:
        status = "✅ Active" if pm['is_active'] else "❌ Inactive"
        print(f"   ID {pm['id']}: {pm['method_name']} - {status}")
    
    # 2. Check recent ServiceFeeBilling records
    print_section("Recent ServiceFeeBilling Records (Last 10)")
    
    recent_billings = ServiceFeeBilling.objects.all().order_by('-created_at')[:10].values(
        'id', 'billing_id', 'payment_type', 'payment_method_id', 
        'total_paid', 'advance_payment_id', 'created_at'
    )
    
    print(f"{'ID':<6} {'Billing ID':<20} {'Type':<25} {'Method':<8} {'Amount':<12} {'Advance ID':<12} {'Created'}")
    print("-" * 110)
    
    for billing in recent_billings:
        pm_id = billing['payment_method_id']
        pm_name = "None"
        if pm_id:
            pm_obj = PaymentMethod.objects.filter(id=pm_id).first()
            if pm_obj:
                pm_name = f"{pm_obj.method_name} ({pm_id})"
        
        print(f"{billing['id']:<6} {billing['billing_id'] or 'N/A':<20} {billing['payment_type'] or 'N/A':<25} "
              f"{pm_name:<8} {billing['total_paid']:<12} {billing['advance_payment_id'] or 'N/A':<12} "
              f"{billing['created_at'].strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 3. Check AdvancePayment records
    print_section("Recent AdvancePayment Records (Last 10)")
    
    recent_advances = AdvancePayment.objects.all().order_by('-created_at')[:10].values(
        'id', 'amount', 'remaining_amount', 'advance_type', 
        'payment_method_id', 'status', 'created_at'
    )
    
    print(f"{'ID':<6} {'Amount':<12} {'Remaining':<12} {'Type':<25} {'Method':<15} {'Status':<12} {'Created'}")
    print("-" * 110)
    
    for adv in recent_advances:
        pm_id = adv['payment_method_id']
        pm_name = "None"
        if pm_id:
            pm_obj = PaymentMethod.objects.filter(id=pm_id).first()
            if pm_obj:
                pm_name = f"{pm_obj.method_name} ({pm_id})"
        
        print(f"{adv['id']:<6} {adv['amount']:<12} {adv['remaining_amount']:<12} "
              f"{adv['advance_type'] or 'N/A':<25} {pm_name:<15} "
              f"{adv['status']:<12} {adv['created_at'].strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 4. Check for mismatches
    print_section("CHECKING FOR PAYMENT_METHOD MISMATCHES")
    
    mismatches = []
    
    # Check advance_payment billings with NULL or wrong payment_method
    advance_billings = ServiceFeeBilling.objects.filter(
        payment_type='advance_payment'
    ).exclude(
        payment_method_id=2  # Should be Cash (2) for non-gateway
    ).exclude(
        payment_gateway='paystation'  # Exclude PayStation payments
    )
    
    print(f"Found {advance_billings.count()} advance_payment billings with non-Cash payment_method (excluding PayStation)")
    
    for billing in advance_billings[:5]:
        pm_name = billing.payment_method.method_name if billing.payment_method else "NULL"
        gateway = billing.payment_gateway or "None"
        print(f"   ⚠️  Billing ID {billing.id}: {billing.billing_id}")
        print(f"       Payment Method: {pm_name} (ID: {billing.payment_method_id})")
        print(f"       Gateway: {gateway}")
        print(f"       Amount: {billing.total_paid}")
        print(f"       Created: {billing.created_at}")
        mismatches.append(billing)
        print()
    
    # 5. Summary
    print_section("TEST SUMMARY")
    
    if mismatches:
        print(f"❌ FOUND {len(mismatches)} MISMATCHES")
        print(f"   These are likely old records created before the fix.")
        print(f"   New advance payments should use Cash (ID: 2)")
    else:
        print(f"✅ NO MISMATCHES FOUND")
        print(f"   All advance payments (excluding PayStation) are using Cash payment method")
    
    print("\n💡 TO VERIFY THE FIX:")
    print("   1. Make a new cash advance payment through the web interface")
    print("   2. Run this script again")
    print("   3. Check that the new record has payment_method_id = 2 (Cash)")
    print()

if __name__ == '__main__':
    try:
        test_advance_payment_fix()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
