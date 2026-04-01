"""
Test script to verify DefaultAccountHead protection validation
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account, DefaultAccountHead
from accounts.serializers import AccountSerializer

def test_default_account_head_protection():
    print("=" * 80)
    print("Testing DefaultAccountHead Protection Validation")
    print("=" * 80)
    
    # Find an account that is used as default account head
    default_heads = DefaultAccountHead.objects.all()
    
    if not default_heads.exists():
        print("\n❌ No DefaultAccountHead records found. Cannot test protection.")
        return
    
    default_head = default_heads.first()
    account = default_head.defaultAccount
    
    print(f"\n✓ Found DefaultAccountHead: {default_head.customLabel or default_head.transactionType}")
    print(f"✓ Associated Account: {account.accountCode} - {account.accountName}")
    
    # Test 1: Try to change account name
    print("\n" + "=" * 80)
    print("Test 1: Attempt to modify account name")
    print("=" * 80)
    
    serializer = AccountSerializer(
        instance=account,
        data={'accountName': 'Modified Name'},
        partial=True
    )
    
    if serializer.is_valid():
        print("❌ FAILED: Serializer should have rejected name change")
    else:
        errors = serializer.errors
        print(f"✓ PASSED: Validation blocked the change")
        print(f"  Error: {errors.get('accountName', errors)}")
    
    # Test 2: Try to move account to different parent
    print("\n" + "=" * 80)
    print("Test 2: Attempt to move account to different parent")
    print("=" * 80)
    
    # Find a different parent of same type
    different_parent = Account.objects.filter(
        accountType=account.accountType,
        isActive=True
    ).exclude(id=account.id).exclude(id=account.parentAccount_id if account.parentAccount else None).first()
    
    if different_parent:
        serializer = AccountSerializer(
            instance=account,
            data={'parentAccount': different_parent.id},
            partial=True
        )
        
        if serializer.is_valid():
            print("❌ FAILED: Serializer should have rejected parent change")
        else:
            errors = serializer.errors
            print(f"✓ PASSED: Validation blocked the change")
            print(f"  Error: {errors.get('parentAccount', errors)}")
    else:
        print("⚠ SKIPPED: No suitable parent account found")
    
    # Test 3: Try to change account type
    print("\n" + "=" * 80)
    print("Test 3: Attempt to change account type")
    print("=" * 80)
    
    # Find a different account type
    different_type = None
    for acc_type, _ in Account.ACCOUNT_TYPES:
        if acc_type != account.accountType:
            different_type = acc_type
            break
    
    if different_type:
        serializer = AccountSerializer(
            instance=account,
            data={'accountType': different_type},
            partial=True
        )
        
        if serializer.is_valid():
            print("❌ FAILED: Serializer should have rejected type change")
        else:
            errors = serializer.errors
            print(f"✓ PASSED: Validation blocked the change")
            print(f"  Error: {errors.get('accountType', errors)}")
    
    # Test 4: Verify isDefaultAccountHead field is populated
    print("\n" + "=" * 80)
    print("Test 4: Verify isDefaultAccountHead field in serializer")
    print("=" * 80)
    
    serializer = AccountSerializer(instance=account)
    data = serializer.data
    
    if 'isDefaultAccountHead' in data:
        if data['isDefaultAccountHead'] is True:
            print(f"✓ PASSED: isDefaultAccountHead field is True")
        else:
            print(f"❌ FAILED: isDefaultAccountHead should be True but is {data['isDefaultAccountHead']}")
    else:
        print("❌ FAILED: isDefaultAccountHead field not found in serializer data")
    
    # Test 5: Test with account that is NOT a default account head
    print("\n" + "=" * 80)
    print("Test 5: Verify non-default account can be modified")
    print("=" * 80)
    
    # Find account that is NOT used as default and has no voucher entries
    non_default_account = Account.objects.filter(
        isActive=True
    ).exclude(
        id__in=DefaultAccountHead.objects.values_list('defaultAccount_id', flat=True)
    ).exclude(
        voucher_details__isnull=False
    ).first()
    
    if non_default_account:
        print(f"✓ Found non-default account: {non_default_account.accountCode} - {non_default_account.accountName}")
        
        serializer = AccountSerializer(
            instance=non_default_account,
            data={'accountName': 'Modified Test Name'},
            partial=True
        )
        
        if serializer.is_valid():
            print("✓ PASSED: Non-default account can be modified")
            
            # Check isDefaultAccountHead field
            serializer_check = AccountSerializer(instance=non_default_account)
            if serializer_check.data.get('isDefaultAccountHead') is False:
                print("✓ PASSED: isDefaultAccountHead field is False for non-default account")
            else:
                print(f"❌ FAILED: isDefaultAccountHead should be False but is {serializer_check.data.get('isDefaultAccountHead')}")
        else:
            print(f"⚠ WARNING: Validation failed but account should be modifiable")
            print(f"  Errors: {serializer.errors}")
    else:
        print("⚠ SKIPPED: No suitable non-default account found")
    
    print("\n" + "=" * 80)
    print("All Tests Completed")
    print("=" * 80)

if __name__ == '__main__':
    test_default_account_head_protection()
