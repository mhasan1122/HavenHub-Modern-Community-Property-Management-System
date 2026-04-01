#!/usr/bin/env python
"""
Fix partial payment status in database
This script recalculates service_status and remaining_amount for all payment records
"""

import os
import sys
import django
from decimal import Decimal

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment
from service_fee.models import ServiceFee
from django.db.models import Sum

def fix_partial_payments():
    """
    Recalculate service_status and remaining_amount for all payment records
    """
    print("\n" + "="*80)
    print("🔧 FIXING PARTIAL PAYMENT STATUS")
    print("="*80 + "\n")
    
    # Get all completed payments
    completed_payments = ServiceFeePayment.objects.filter(
        payment_status='completed'
    ).order_by('unit_id', 'service_fee_id', 'service_period_year', 'service_period_month')
    
    print(f"Found {completed_payments.count()} completed payment records\n")
    
    # Group payments by unit, service_fee, month, year
    payment_groups = {}
    for payment in completed_payments:
        key = (
            payment.unit_id,
            payment.service_fee_id,
            payment.service_period_year,
            payment.service_period_month
        )
        
        if key not in payment_groups:
            payment_groups[key] = []
        payment_groups[key].append(payment)
    
    print(f"Processing {len(payment_groups)} unique period(s)\n")
    
    fixed_count = 0
    for idx, (key, payments) in enumerate(payment_groups.items(), 1):
        unit_id, service_fee_id, year, month = key
        
        print(f"\n{'='*60}")
        print(f"Processing {idx}/{len(payment_groups)}: Unit {unit_id}, {month:02d}/{year}")
        print(f"{'='*60}")
        
        try:
            # Get service fee amount
            service_fee = ServiceFee.objects.get(id=service_fee_id)
            total_fee_amount = float(service_fee.fee_amount)
            
            # Calculate total paid for this period
            total_paid = sum(float(p.amount) for p in payments)
            
            # Calculate remaining amount
            remaining = max(0, total_fee_amount - total_paid)
            
            print(f"Total fee amount:   {total_fee_amount} TK")
            print(f"Total paid:         {total_paid} TK")
            print(f"Remaining:          {remaining} TK")
            print(f"Payment records:    {len(payments)}")
            
            # Determine correct status
            if total_paid >= total_fee_amount:
                new_status = 'paid'
                new_remaining = 0
                result_status = 'overpayment' if total_paid > total_fee_amount else 'full'
                print(f"✅ Status: FULLY PAID")
                if total_paid > total_fee_amount:
                    print(f"   ⚠️  Overpaid by: {total_paid - total_fee_amount} TK")
            else:
                new_status = 'partial'
                new_remaining = remaining
                result_status = 'partial'
                print(f"⚠️  Status: PARTIAL PAYMENT")
                print(f"   Still needs: {remaining} TK")
            
            # Update all payment records for this period
            updates_made = False
            for payment in payments:
                if (payment.service_status != new_status or 
                    float(payment.remaining_amount) != new_remaining):
                    
                    old_status = payment.service_status
                    old_remaining = float(payment.remaining_amount)
                    
                    payment.service_status = new_status
                    payment.remaining_amount = Decimal(str(new_remaining))
                    payment.payment_result_status = result_status
                    payment.save()
                    
                    print(f"   📝 Updated payment ID {payment.id}:")
                    print(f"      service_status: {old_status} → {new_status}")
                    print(f"      remaining_amount: {old_remaining} → {new_remaining}")
                    
                    updates_made = True
                    fixed_count += 1
            
            if not updates_made:
                print(f"   ✓ Already correct - no changes needed")
                
        except ServiceFee.DoesNotExist:
            print(f"❌ ServiceFee not found for ID: {service_fee_id}")
        except Exception as e:
            print(f"❌ Error processing period: {str(e)}")
    
    print(f"\n{'='*80}")
    print(f"✅ FIX COMPLETE")
    print(f"{'='*80}")
    print(f"Total payment records updated: {fixed_count}")
    print(f"Unique periods processed: {len(payment_groups)}")
    print(f"{'='*80}\n")

if __name__ == '__main__':
    fix_partial_payments()
