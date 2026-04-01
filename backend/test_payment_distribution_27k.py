#!/usr/bin/env python
"""
Test script to verify payment distribution logic for two scenarios:
1. Payment of ৳27,000 for Dec (13,800) + Jan (13,800) total
2. Second payment of ৳1,000 to clear remaining balance
"""

from decimal import Decimal

def distribute_payment(total_payment, bills):
    """
    Distribute payment across bills (oldest first)
    Returns: (updated_bills, excess_amount, all_paid)
    """
    remaining = Decimal(str(total_payment))
    results = []
    
    for bill in bills:
        bill_remaining = bill['remaining']
        
        if remaining >= bill_remaining:
            # Full payment for this bill
            payment_applied = bill_remaining
            new_remaining = Decimal('0')
            status = 'paid'
            remaining -= bill_remaining
        elif remaining > 0:
            # Partial payment
            payment_applied = remaining
            new_remaining = bill_remaining - remaining
            status = 'partial'
            remaining = Decimal('0')
        else:
            # No payment for this bill
            payment_applied = Decimal('0')
            new_remaining = bill_remaining
            status = bill['status']  # Keep current status
        
        results.append({
            'month': bill['month'],
            'original_amount': bill['original_amount'],
            'previous_remaining': bill['remaining'],
            'payment_applied': payment_applied,
            'new_remaining': new_remaining,
            'status': status
        })
    
    all_paid = all(r['status'] == 'paid' for r in results)
    
    return results, remaining, all_paid


def test_scenario():
    print("\n" + "="*80)
    print("PAYMENT DISTRIBUTION TEST - TWO SCENARIOS")
    print("="*80)
    
    # Initial bills
    print("\n📋 INITIAL STATE:")
    print("   December 2025: ৳13,800 due")
    print("   January 2026:  ৳13,800 due")
    print("   Total Due:     ৳27,600")
    
    # Scenario 1: First payment of 27,000
    print("\n" + "="*80)
    print("SCENARIO 1: First Payment of ৳27,000")
    print("="*80)
    
    bills_scenario1 = [
        {'month': 'December 2025', 'original_amount': Decimal('13800'), 'remaining': Decimal('13800'), 'status': 'due'},
        {'month': 'January 2026', 'original_amount': Decimal('13800'), 'remaining': Decimal('13800'), 'status': 'due'},
    ]
    
    payment_1 = Decimal('27000')
    print(f"\n💰 Payment Amount: ৳{payment_1}")
    print(f"   Total Due: ৳{sum(b['remaining'] for b in bills_scenario1)}")
    print(f"   Shortfall: ৳{sum(b['remaining'] for b in bills_scenario1) - payment_1}")
    
    results_1, excess_1, all_paid_1 = distribute_payment(payment_1, bills_scenario1)
    
    print(f"\n📊 DISTRIBUTION:")
    for r in results_1:
        status_icon = "✅" if r['status'] == 'paid' else "⚠️"
        print(f"\n   {status_icon} {r['month']}:")
        print(f"      Due Amount:      ৳{r['original_amount']}")
        print(f"      Payment Applied: ৳{r['payment_applied']}")
        print(f"      New Remaining:   ৳{r['new_remaining']}")
        print(f"      Status:          {r['status'].upper()}")
    
    print(f"\n🎯 RESULT:")
    print(f"   Excess Amount: ৳{excess_1}")
    print(f"   All Bills Paid: {all_paid_1}")
    print(f"   Advance Created: {'YES ৳' + str(excess_1) if (excess_1 > 0 and all_paid_1) else 'NO (partial payment exists)'}")
    
    # Scenario 2: Second payment of 1,000
    print("\n" + "="*80)
    print("SCENARIO 2: Second Payment of ৳1,000")
    print("="*80)
    
    # Bills after first payment
    bills_scenario2 = [
        {'month': 'December 2025', 'original_amount': Decimal('13800'), 'remaining': results_1[0]['new_remaining'], 'status': results_1[0]['status']},
        {'month': 'January 2026', 'original_amount': Decimal('13800'), 'remaining': results_1[1]['new_remaining'], 'status': results_1[1]['status']},
    ]
    
    payment_2 = Decimal('1000')
    print(f"\n💰 Payment Amount: ৳{payment_2}")
    print(f"   Total Remaining: ৳{sum(b['remaining'] for b in bills_scenario2)}")
    print(f"   Overpayment: ৳{payment_2 - sum(b['remaining'] for b in bills_scenario2)}")
    
    results_2, excess_2, all_paid_2 = distribute_payment(payment_2, bills_scenario2)
    
    print(f"\n📊 DISTRIBUTION:")
    for r in results_2:
        if r['previous_remaining'] == 0:
            print(f"\n   ✅ {r['month']}: Already Paid (Skipped)")
            continue
        
        status_icon = "✅" if r['status'] == 'paid' else "⚠️"
        print(f"\n   {status_icon} {r['month']}:")
        print(f"      Previous Remaining: ৳{r['previous_remaining']}")
        print(f"      Payment Applied:    ৳{r['payment_applied']}")
        print(f"      New Remaining:      ৳{r['new_remaining']}")
        print(f"      Status:             {r['status'].upper()}")
    
    print(f"\n🎯 RESULT:")
    print(f"   Excess Amount: ৳{excess_2}")
    print(f"   All Bills Paid: {all_paid_2}")
    print(f"   Advance Created: {'YES ৳' + str(excess_2) if (excess_2 > 0 and all_paid_2) else 'NO'}")
    
    # Final Summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    print(f"\n📈 After Both Payments:")
    print(f"   Total Paid: ৳{payment_1 + payment_2}")
    print(f"   Total Due:  ৳27,600")
    
    print(f"\n   December 2025:")
    print(f"      Status: {results_2[0]['status'].upper()}")
    print(f"      Remaining: ৳{results_2[0]['new_remaining']}")
    
    print(f"\n   January 2026:")
    print(f"      Status: {results_2[1]['status'].upper()}")
    print(f"      Remaining: ৳{results_2[1]['new_remaining']}")
    
    print(f"\n   Advance Balance: ৳{excess_2 if all_paid_2 else 0}")
    
    # Validation
    print("\n" + "="*80)
    print("✅ TEST VALIDATION")
    print("="*80)
    
    # Scenario 1 validation
    assert results_1[0]['status'] == 'paid', "December should be PAID after first payment"
    assert results_1[1]['status'] == 'partial', "January should be PARTIAL after first payment"
    assert results_1[1]['new_remaining'] == Decimal('600'), "January should have ৳600 remaining"
    assert excess_1 == 0 or not all_paid_1, "No advance should be created (partial payment exists)"
    print(f"✅ Scenario 1: PASSED")
    print(f"   - December: PAID")
    print(f"   - January: PARTIAL (৳600 remaining)")
    print(f"   - No advance created (correct!)")
    
    # Scenario 2 validation
    assert results_2[0]['status'] == 'paid', "December should remain PAID"
    assert results_2[1]['status'] == 'paid', "January should be PAID after second payment"
    assert results_2[1]['new_remaining'] == 0, "January should have ৳0 remaining"
    assert excess_2 == Decimal('400'), "Excess should be ৳400"
    assert all_paid_2 == True, "All bills should be paid"
    print(f"\n✅ Scenario 2: PASSED")
    print(f"   - December: PAID")
    print(f"   - January: PAID")
    print(f"   - Advance: ৳400 (correct!)")
    
    print("\n" + "="*80)
    print("🎉 ALL TESTS PASSED!")
    print("="*80)


if __name__ == '__main__':
    try:
        test_scenario()
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
