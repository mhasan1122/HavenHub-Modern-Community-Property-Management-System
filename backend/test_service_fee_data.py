#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee.models import ServiceFee, ServiceFeeMFS, ServiceFeeBank

def test_service_fee_data():
    print("=== Service Fee Demo Data ===")
    
    service_fees = ServiceFee.objects.all()
    print(f"Total Service Fees: {service_fees.count()}")
    
    for i, sf in enumerate(service_fees, 1):
        print(f"\n{i}. Service Fee ID: {sf.id}")
        print(f"   Creator: {sf.creator_name}")
        print(f"   Amount: {sf.fee_amount} {sf.currency}")
        print(f"   Frequency: {sf.frequency}")
        print(f"   Due Day: {sf.due_day}")
        print(f"   Active: {sf.is_active}")
        
        # Towers
        towers = sf.towers.all()
        if towers:
            print(f"   Towers: {', '.join([t.tower_name for t in towers])}")
        
        # Units
        units = sf.units.all()
        if units:
            print(f"   Units: {', '.join([u.unit_name for u in units[:3]])}{'...' if units.count() > 3 else ''}")
        
        # Payment methods
        payment_methods = []
        if sf.accepts_cash:
            payment_methods.append("Cash")
        if sf.accepts_mfs:
            payment_methods.append("MFS")
        if sf.accepts_bank:
            payment_methods.append("Bank")
        print(f"   Payment Methods: {', '.join(payment_methods)}")
        
        # MFS accounts
        mfs_accounts = sf.mfs_accounts.all()
        if mfs_accounts:
            print(f"   MFS Accounts: {', '.join([f'{m.provider} ({m.account_number})' for m in mfs_accounts])}")
        
        # Bank account
        if hasattr(sf, 'bank_account'):
            bank = sf.bank_account
            print(f"   Bank: {bank.bank_name} - {bank.account_number}")

if __name__ == "__main__":
    test_service_fee_data()
