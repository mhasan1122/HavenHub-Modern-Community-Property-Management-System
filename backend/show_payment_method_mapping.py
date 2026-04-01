#!/usr/bin/env python3
"""
Show complete payment method to account mapping
"""
import os
import sys
import django

# Setup Django
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account
from service_fee_management.models import PaymentMethod

def show_mapping():
    print("\n" + "="*100)
    print("💳 PAYMENT METHOD → ACCOUNT MAPPING")
    print("="*100 + "\n")
    
    payment_methods = PaymentMethod.objects.filter(is_active=True).order_by('id')
    
    for pm in payment_methods:
        print(f"{'='*100}")
        print(f"Payment Method ID: {pm.id}")
        print(f"Name: {pm.method_name}")
        print(f"Description: {pm.description or 'N/A'}")
        
        if pm.default_account:
            acc = pm.default_account
            print(f"\n✅ Linked Account:")
            print(f"   Account ID: {acc.id}")
            print(f"   Account Code: {acc.accountCode}")
            print(f"   Account Name: {acc.accountName}")
            print(f"   Account Type: {acc.accountType}")
            if acc.parentAccount:
                print(f"   Parent: {acc.parentAccount.accountCode} - {acc.parentAccount.accountName}")
            print(f"   Balance: {acc.currentBalance}")
            if acc.description:
                print(f"   Description: {acc.description}")
        else:
            print(f"\n⚠️  No account linked")
        
        print()
    
    print("="*100 + "\n")

if __name__ == '__main__':
    show_mapping()
