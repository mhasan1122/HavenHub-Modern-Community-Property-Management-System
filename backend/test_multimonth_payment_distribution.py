"""
Test script to verify multi-month payment distribution logic
This simulates the scenario described by the user:
- October: 3200 TK due
- November: 3200 TK due
- User pays: 6000 TK total
Expected result:
- October: PAID (3200 TK)
- November: PARTIAL (2800 TK paid, 400 TK remaining)
"""

def test_payment_distribution():
    """Simulate the payment distribution logic"""
    
    # Setup
    total_payment_amount = 6000.0  # Total amount from SSLCommerz
    
    payments = [
        {'month': 10, 'year': 2025, 'fee_amount': 3200.0, 'previous_paid': 0},
        {'month': 11, 'year': 2025, 'fee_amount': 3200.0, 'previous_paid': 0},
    ]
    
    print("="*80)
    print("MULTI-MONTH PAYMENT DISTRIBUTION TEST")
    print("="*80)
    print(f"Total payment to distribute: {total_payment_amount} TK")
    print(f"Number of payment records: {len(payments)}")
    
    remaining_payment_to_distribute = total_payment_amount
    results = []
    
    for idx, payment in enumerate(payments, 1):
        month = payment['month']
        year = payment['year']
        total_fee_amount = payment['fee_amount']
        total_paid_from_billings = payment['previous_paid']
        
        print(f"\n{'='*60}")
        print(f"Processing Payment {idx}/{len(payments)}: {month:02d}/{year}")
        print(f"{'='*60}")
        
        # Calculate how much this month still needs
        amount_needed_for_month = total_fee_amount - total_paid_from_billings
        
        # Determine how much to apply to THIS month from the remaining payment
        if remaining_payment_to_distribute >= amount_needed_for_month:
            # We have enough to fully pay this month
            current_transaction_amount = amount_needed_for_month
            remaining_payment_to_distribute -= amount_needed_for_month
            status = "PAID"
        elif remaining_payment_to_distribute > 0:
            # Partial payment for this month
            current_transaction_amount = remaining_payment_to_distribute
            remaining_payment_to_distribute = 0
            status = "PARTIAL"
        else:
            # No money left for this month - skip it
            print(f"   ⚠️ No funds remaining to apply to this month - skipping")
            continue
        
        # Calculate total paid after adding this transaction
        total_paid_for_month = total_paid_from_billings + current_transaction_amount
        
        # Calculate remaining amount
        remaining = max(0, total_fee_amount - total_paid_for_month)
        
        print(f"Total fee amount:        {total_fee_amount} TK")
        print(f"Previous billings total: {total_paid_from_billings} TK")
        print(f"Amount needed:           {amount_needed_for_month} TK")
        print(f"Current transaction:     {current_transaction_amount} TK")
        print(f"Total paid now:          {total_paid_for_month} TK")
        print(f"Remaining amount:        {remaining} TK")
        print(f"Remaining to distribute: {remaining_payment_to_distribute} TK")
        print(f"Status: {status}")
        
        results.append({
            'month': f"{month:02d}/{year}",
            'transaction_amount': current_transaction_amount,
            'total_paid': total_paid_for_month,
            'remaining': remaining,
            'status': status
        })
    
    print("\n" + "="*80)
    print("RESULTS SUMMARY")
    print("="*80)
    for result in results:
        print(f"{result['month']}: {result['status']}")
        print(f"  Transaction amount: {result['transaction_amount']} TK")
        print(f"  Total paid: {result['total_paid']} TK")
        print(f"  Remaining: {result['remaining']} TK")
        print()
    
    # Verify expected results
    print("="*80)
    print("VERIFICATION")
    print("="*80)
    
    assert results[0]['status'] == 'PAID', f"October should be PAID, got {results[0]['status']}"
    assert results[0]['transaction_amount'] == 3200.0, f"October transaction should be 3200, got {results[0]['transaction_amount']}"
    assert results[0]['remaining'] == 0, f"October remaining should be 0, got {results[0]['remaining']}"
    
    assert results[1]['status'] == 'PARTIAL', f"November should be PARTIAL, got {results[1]['status']}"
    assert results[1]['transaction_amount'] == 2800.0, f"November transaction should be 2800, got {results[1]['transaction_amount']}"
    assert results[1]['remaining'] == 400.0, f"November remaining should be 400, got {results[1]['remaining']}"
    
    print("✅ All assertions passed!")
    print("✅ October: PAID (3200 TK applied)")
    print("✅ November: PARTIAL (2800 TK applied, 400 TK remaining)")
    

if __name__ == '__main__':
    test_payment_distribution()
