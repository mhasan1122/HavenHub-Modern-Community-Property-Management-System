#!/usr/bin/env python
"""
Test the payment_result_status calculation logic
"""

# Scenario from the database:
# Bill amount: 13,600
# Payment 1 (PayStation): 13,400
# Payment 2 (Cash): 200

bill_amount = 13600

# Payment 1
payment_1_amount = 13400
total_after_payment_1 = payment_1_amount
result_1 = 'full' if total_after_payment_1 >= bill_amount else 'partial'
print(f"Payment 1: {payment_1_amount}")
print(f"  Total paid: {total_after_payment_1}")
print(f"  Result: {result_1}")
print(f"  Expected: partial")
print(f"  ✅ CORRECT!" if result_1 == 'partial' else "❌ WRONG!")
print()

# Payment 2
payment_2_amount = 200
total_after_payment_2 = total_after_payment_1 + payment_2_amount
result_2 = 'full' if total_after_payment_2 >= bill_amount else 'partial'
print(f"Payment 2: {payment_2_amount}")
print(f"  Total paid: {total_after_payment_2}")
print(f"  Result: {result_2}")
print(f"  Expected: full")
print(f"  ✅ CORRECT!" if result_2 == 'full' else "❌ WRONG!")
