#!/usr/bin/env python
"""
Simulate two payments for Payment Test Tower unit 301
1st Payment: ৳15,000
2nd Payment: ৳1,000
"""

from decimal import Decimal

def simulate_payments():
    print("\n" + "="*80)
    print("SIMULATING PAYMENTS FOR PAYMENT TEST TOWER - UNIT 301")
    print("="*80)
    
    # Current bills
    bills = [
        {'month': 'December 2025', 'month_num': 12, 'year': 2025, 'remaining': Decimal('7750')},
        {'month': 'January 2026', 'month_num': 1, 'year': 2026, 'remaining': Decimal('7750')},
    ]
    
    total_due = sum(b['remaining'] for b in bills)
    
    print(f"\n💰 CURRENT STATE:")
    print(f"   December 2025: ৳{bills[0]['remaining']} due")
    print(f"   January 2026: ৳{bills[1]['remaining']} due")
    print(f"   Total Due: ৳{total_due}")
    
    # ========================================================================
    # FIRST PAYMENT: ৳15,000
    # ========================================================================
    print(f"\n{'='*80}")
    print(f"FIRST PAYMENT: ৳15,000")
    print(f"{'='*80}")
    
    payment_1 = Decimal('15000')
    remaining_1 = payment_1
    results_1 = []
    
    print(f"\n💳 Payment Amount: ৳{payment_1}")
    print(f"   Total Due: ৳{total_due}")
    print(f"   Shortfall: ৳{total_due - payment_1}")
    
    print(f"\n📊 DISTRIBUTION (OLDEST FIRST):")
    
    for bill in bills:
        bill_remaining = bill['remaining']
        
        if remaining_1 >= bill_remaining:
            # Full payment
            amount_applied = bill_remaining
            new_remaining = Decimal('0')
            status = 'paid'
            remaining_1 -= bill_remaining
        elif remaining_1 > 0:
            # Partial payment
            amount_applied = remaining_1
            new_remaining = bill_remaining - remaining_1
            status = 'partial'
            remaining_1 = Decimal('0')
        else:
            # No payment
            amount_applied = Decimal('0')
            new_remaining = bill_remaining
            status = 'due'
        
        results_1.append({
            'month': bill['month'],
            'original_remaining': bill_remaining,
            'amount_applied': amount_applied,
            'new_remaining': new_remaining,
            'status': status
        })
        
        status_icon = "✅" if status == 'paid' else "⚠️" if status == 'partial' else "❌"
        print(f"\n{status_icon} {bill['month']}:")
        print(f"   Previous Due: ৳{bill_remaining}")
        print(f"   Amount Applied: ৳{amount_applied}")
        print(f"   New Remaining: ৳{new_remaining}")
        print(f"   Status: {status.upper()}")
    
    # Check if advance should be created
    print(f"\n🎯 RESULT AFTER FIRST PAYMENT:")
    print(f"   Excess Amount: ৳{remaining_1}")
    
    all_paid_1 = all(r['status'] == 'paid' for r in results_1)
    has_partial_1 = any(r['status'] == 'partial' for r in results_1)
    
    print(f"   All Bills Paid: {all_paid_1}")
    print(f"   Has Partial Payment: {has_partial_1}")
    
    if remaining_1 > 0 and all_paid_1:
        print(f"\n   ✅ ADVANCE CREATED: ৳{remaining_1}")
        advance_balance = remaining_1
    else:
        print(f"\n   ❌ NO ADVANCE (partial payment exists)")
        advance_balance = Decimal('0')
    
    # ========================================================================
    # SECOND PAYMENT: ৳1,000
    # ========================================================================
    print(f"\n{'='*80}")
    print(f"SECOND PAYMENT: ৳1,000")
    print(f"{'='*80}")
    
    payment_2 = Decimal('1000')
    remaining_2 = payment_2
    
    print(f"\n💳 Payment Amount: ৳{payment_2}")
    print(f"   Current State After First Payment:")
    for r in results_1:
        if r['new_remaining'] > 0:
            print(f"   - {r['month']}: ৳{r['new_remaining']} remaining")
    
    print(f"\n📊 DISTRIBUTION (OLDEST FIRST):")
    
    results_2 = []
    for idx, r1 in enumerate(results_1):
        bill_remaining = r1['new_remaining']
        
        if bill_remaining == 0:
            # Already paid
            results_2.append({
                'month': r1['month'],
                'status': 'paid',
                'amount_applied': Decimal('0'),
                'new_remaining': Decimal('0')
            })
            print(f"\n✅ {r1['month']}: Already PAID (skipped)")
            continue
        
        if remaining_2 >= bill_remaining:
            # Full payment
            amount_applied = bill_remaining
            new_remaining = Decimal('0')
            status = 'paid'
            remaining_2 -= bill_remaining
        elif remaining_2 > 0:
            # Partial payment
            amount_applied = remaining_2
            new_remaining = bill_remaining - remaining_2
            status = 'partial'
            remaining_2 = Decimal('0')
        else:
            # No payment
            amount_applied = Decimal('0')
            new_remaining = bill_remaining
            status = r1['status']
        
        results_2.append({
            'month': r1['month'],
            'amount_applied': amount_applied,
            'new_remaining': new_remaining,
            'status': status
        })
        
        status_icon = "✅" if status == 'paid' else "⚠️" if status == 'partial' else "❌"
        print(f"\n{status_icon} {r1['month']}:")
        print(f"   Previous Remaining: ৳{bill_remaining}")
        print(f"   Amount Applied: ৳{amount_applied}")
        print(f"   New Remaining: ৳{new_remaining}")
        print(f"   Status: {status.upper()}")
    
    # Check if advance should be created
    print(f"\n🎯 RESULT AFTER SECOND PAYMENT:")
    print(f"   Excess Amount: ৳{remaining_2}")
    
    all_paid_2 = all(r['status'] == 'paid' for r in results_2)
    has_partial_2 = any(r['status'] == 'partial' for r in results_2)
    
    print(f"   All Bills Paid: {all_paid_2}")
    print(f"   Has Partial Payment: {has_partial_2}")
    
    if remaining_2 > 0 and all_paid_2:
        print(f"\n   ✅ ADVANCE CREATED: ৳{remaining_2}")
        print(f"   Reason: All bills fully paid, excess amount available")
        total_advance = advance_balance + remaining_2
    else:
        print(f"\n   ❌ NO ADVANCE CREATED")
        if has_partial_2:
            print(f"   Reason: Partial payment still exists")
        total_advance = advance_balance
    
    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    print(f"\n{'='*80}")
    print(f"FINAL SUMMARY - PAYMENT TEST TOWER UNIT 301")
    print(f"{'='*80}")
    
    print(f"\n💰 TOTAL PAYMENTS MADE: ৳{payment_1 + payment_2}")
    print(f"   First Payment: ৳{payment_1}")
    print(f"   Second Payment: ৳{payment_2}")
    
    print(f"\n📊 FINAL STATUS:")
    for r in results_2:
        status_icon = "✅" if r['status'] == 'paid' else "⚠️" if r['status'] == 'partial' else "❌"
        print(f"   {status_icon} {r['month']}: {r['status'].upper()}", end="")
        if r['new_remaining'] > 0:
            print(f" (৳{r['new_remaining']} remaining)")
        else:
            print(f" (৳0)")
    
    print(f"\n💎 ADVANCE BALANCE: ৳{total_advance}")
    
    if total_advance > 0:
        print(f"   ✅ Advance will be applied to future bills automatically")
    
    print(f"\n{'='*80}")
    
    # Validation
    print(f"\n✅ VALIDATION:")
    assert results_1[0]['status'] == 'paid', "December should be paid after first payment"
    assert results_1[1]['status'] == 'partial', "January should be partial after first payment"
    assert results_1[1]['new_remaining'] == Decimal('500'), "January should have ৳500 remaining"
    assert advance_balance == Decimal('0'), "No advance after first payment"
    
    assert results_2[0]['status'] == 'paid', "December should remain paid"
    assert results_2[1]['status'] == 'paid', "January should be paid after second payment"
    assert remaining_2 == Decimal('500'), "Should have ৳500 excess"
    assert total_advance == Decimal('500'), "Should have ৳500 advance"
    
    print(f"   ✅ All validations passed!")

if __name__ == '__main__':
    try:
        simulate_payments()
    except AssertionError as e:
        print(f"\n❌ VALIDATION FAILED: {str(e)}")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
