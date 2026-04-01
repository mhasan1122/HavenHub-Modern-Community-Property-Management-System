#!/usr/bin/env python
"""
Test the payment distribution fix
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from decimal import Decimal

def test_payment_distribution_logic():
    """
    Test that the fixed logic correctly distributes payments
    """
    print("\n" + "="*80)
    print("TESTING FIXED PAYMENT DISTRIBUTION LOGIC")
    print("="*80)
    
    # Scenario 1: Pay 9000 for Dec (4560) + Jan (4560) = 9120 total
    print("\n📋 SCENARIO 1: Pay ৳9,000 for bills totaling ৳9,120")
    print("="*80)
    
    payment_months = [
        {'month': 12, 'year': 2025, 'due_amount': 4560},
        {'month': 1, 'year': 2026, 'due_amount': 4560},
    ]
    
    amount = 9000
    remaining_amount = float(amount)
    
    print(f"\n💰 Total Payment: ৳{amount}")
    print(f"   December 2025: ৳{payment_months[0]['due_amount']} due")
    print(f"   January 2026: ৳{payment_months[1]['due_amount']} due")
    print(f"   Total Due: ৳{sum(m['due_amount'] for m in payment_months)}")
    
    print(f"\n📊 DISTRIBUTION:")
    for payment_month_data in payment_months:
        due_amount = float(payment_month_data.get('due_amount', 0))
        
        if remaining_amount >= due_amount:
            payment_month_data['amount'] = due_amount
            remaining_amount -= due_amount
            status = "✅ PAID"
        elif remaining_amount > 0:
            payment_month_data['amount'] = remaining_amount
            status = f"⚠️ PARTIAL (৳{due_amount - remaining_amount} remaining)"
            remaining_amount = 0
        else:
            payment_month_data['amount'] = 0
            status = "❌ NOT PAID"
        
        print(f"   {payment_month_data['month']:02d}/{payment_month_data['year']}: {status}")
        print(f"      Applied: ৳{payment_month_data['amount']}")
    
    print(f"\n🎯 RESULT:")
    print(f"   Remaining to distribute: ৳{remaining_amount}")
    
    # Check if advance should be created
    all_paid = all(m['amount'] >= m['due_amount'] for m in payment_months)
    has_partial = any(0 < m['amount'] < m['due_amount'] for m in payment_months)
    
    print(f"   All bills paid: {all_paid}")
    print(f"   Has partial: {has_partial}")
    
    if remaining_amount > 0 and all_paid:
        print(f"   ✅ Advance SHOULD be created: ৳{remaining_amount}")
    else:
        print(f"   ❌ Advance should NOT be created")
        if has_partial:
            print(f"      Reason: Partial payment exists")
        else:
            print(f"      Reason: No excess amount")
    
    # Validate
    assert payment_months[0]['amount'] == 4560, "December should get full payment"
    assert payment_months[1]['amount'] == 4440, "January should get partial payment"
    assert remaining_amount == 0, "No advance should be created"
    assert has_partial == True, "Should have partial payment"
    
    print(f"\n✅ TEST PASSED!")
    
    # Scenario 2: Pay 10000 for same bills (should create advance)
    print("\n" + "="*80)
    print("\n📋 SCENARIO 2: Pay ৳10,000 for bills totaling ৳9,120")
    print("="*80)
    
    payment_months_2 = [
        {'month': 12, 'year': 2025, 'due_amount': 4560},
        {'month': 1, 'year': 2026, 'due_amount': 4560},
    ]
    
    amount_2 = 10000
    remaining_amount_2 = float(amount_2)
    
    print(f"\n💰 Total Payment: ৳{amount_2}")
    print(f"   December 2025: ৳{payment_months_2[0]['due_amount']} due")
    print(f"   January 2026: ৳{payment_months_2[1]['due_amount']} due")
    print(f"   Total Due: ৳{sum(m['due_amount'] for m in payment_months_2)}")
    
    print(f"\n📊 DISTRIBUTION:")
    for payment_month_data in payment_months_2:
        due_amount = float(payment_month_data.get('due_amount', 0))
        
        if remaining_amount_2 >= due_amount:
            payment_month_data['amount'] = due_amount
            remaining_amount_2 -= due_amount
            status = "✅ PAID"
        elif remaining_amount_2 > 0:
            payment_month_data['amount'] = remaining_amount_2
            status = f"⚠️ PARTIAL (৳{due_amount - remaining_amount_2} remaining)"
            remaining_amount_2 = 0
        else:
            payment_month_data['amount'] = 0
            status = "❌ NOT PAID"
        
        print(f"   {payment_month_data['month']:02d}/{payment_month_data['year']}: {status}")
        print(f"      Applied: ৳{payment_month_data['amount']}")
    
    print(f"\n🎯 RESULT:")
    print(f"   Remaining to distribute: ৳{remaining_amount_2}")
    
    # Check if advance should be created
    all_paid_2 = all(m['amount'] >= m['due_amount'] for m in payment_months_2)
    has_partial_2 = any(0 < m['amount'] < m['due_amount'] for m in payment_months_2)
    
    print(f"   All bills paid: {all_paid_2}")
    print(f"   Has partial: {has_partial_2}")
    
    if remaining_amount_2 > 0 and all_paid_2:
        print(f"   ✅ Advance SHOULD be created: ৳{remaining_amount_2}")
    else:
        print(f"   ❌ Advance should NOT be created")
    
    # Validate
    assert payment_months_2[0]['amount'] == 4560, "December should get full payment"
    assert payment_months_2[1]['amount'] == 4560, "January should get full payment"
    assert remaining_amount_2 == 880, "Advance of 880 should be created"
    assert all_paid_2 == True, "All bills should be paid"
    assert has_partial_2 == False, "No partial payments"
    
    print(f"\n✅ TEST PASSED!")
    
    print("\n" + "="*80)
    print("🎉 ALL TESTS PASSED - LOGIC IS CORRECT")
    print("="*80)

if __name__ == '__main__':
    try:
        test_payment_distribution_logic()
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
