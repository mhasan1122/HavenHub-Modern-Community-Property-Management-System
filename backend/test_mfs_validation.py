#!/usr/bin/env python
"""
Test script for MFS mobile number validation
This script tests the Bangladeshi mobile number validation for MFS payment methods.
"""

import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee.serializers import ServiceFeeMFSSerializer
from service_fee.models import ServiceFeeMFS
from django.core.exceptions import ValidationError


def test_valid_numbers():
    """Test valid Bangladeshi mobile numbers"""
    print("=== Testing Valid Mobile Numbers ===")
    
    valid_numbers = [
        '01712345678',  # Grameenphone
        '01812345678',  # Robi
        '01912345678',  # Banglalink
        '01512345678',  # Teletalk
        '01612345678',  # Airtel
        '01312345678',  # Grameenphone
        '01412345678',  # Robi
        '01312345670',  # Different ending
        '01912345679',  # Different ending
    ]
    
    passed = 0
    total = len(valid_numbers)
    
    for number in valid_numbers:
        try:
            # Test serializer validation
            data = {
                'provider': 'bKash',
                'account_name': 'Test Account',
                'account_number': number
            }
            serializer = ServiceFeeMFSSerializer(data=data)
            
            if serializer.is_valid():
                print(f"✅ {number} - PASSED")
                passed += 1
            else:
                print(f"❌ {number} - FAILED: {serializer.errors}")
        
        except Exception as e:
            print(f"❌ {number} - ERROR: {e}")
    
    print(f"\nValid Numbers Test: {passed}/{total} passed\n")
    return passed == total


def test_invalid_numbers():
    """Test invalid mobile numbers"""
    print("=== Testing Invalid Mobile Numbers ===")
    
    invalid_test_cases = [
        {
            'number': '123456789',  # Too short
            'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
        },
        {
            'number': '012345678901',  # Too long
            'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
        },
        {
            'number': '02123456789',  # Doesn't start with 01
            'expected_error': 'Bangladeshi mobile number must start with \'01\'.'
        },
        {
            'number': '0112345678a',  # Contains letters
            'expected_error': 'Mobile number should contain only digits.'
        },
        {
            'number': '01223456789',  # Invalid prefix 012
            'expected_error': 'Invalid mobile number prefix \'012\'. Valid prefixes are: 013, 014, 015, 016, 017, 018, 019.'
        },
        {
            'number': '+8801712345678',  # With country code
            'expected_error': 'Mobile number should contain only digits.'
        },
        {
            'number': '8801712345678',  # Without +
            'expected_error': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
        },
        {
            'number': '01012345678',  # Invalid prefix 010
            'expected_error': 'Invalid mobile number prefix \'010\'. Valid prefixes are: 013, 014, 015, 016, 017, 018, 019.'
        },
        {
            'number': '01112345678',  # Invalid prefix 011
            'expected_error': 'Invalid mobile number prefix \'011\'. Valid prefixes are: 013, 014, 015, 016, 017, 018, 019.'
        },
        {
            'number': '01212345678',  # Invalid prefix 012
            'expected_error': 'Invalid mobile number prefix \'012\'. Valid prefixes are: 013, 014, 015, 016, 017, 018, 019.'
        },
        {
            'number': '',  # Empty
            'expected_error': 'Account number is required.'
        },
        {
            'number': '   ',  # Whitespace only
            'expected_error': 'Account number is required.'
        },
        {
            'number': '01-712-345-678',  # With dashes
            'expected_error': 'Mobile number should contain only digits.'
        },
        {
            'number': '017 1234 5678',  # With spaces
            'expected_error': 'Mobile number should contain only digits.'
        },
    ]
    
    passed = 0
    total = len(invalid_test_cases)
    
    for case in invalid_test_cases:
        try:
            data = {
                'provider': 'bKash',
                'account_name': 'Test Account',
                'account_number': case['number']
            }
            serializer = ServiceFeeMFSSerializer(data=data)
            
            if not serializer.is_valid():
                # Check if the expected error message is present
                if 'account_number' in serializer.errors:
                    error_message = str(serializer.errors['account_number'][0])
                    if case['expected_error'] in error_message:
                        print(f"✅ {case['number']!r} - PASSED (Error: {error_message})")
                        passed += 1
                    else:
                        print(f"❌ {case['number']!r} - WRONG ERROR: Expected '{case['expected_error']}', Got '{error_message}'")
                else:
                    print(f"❌ {case['number']!r} - NO ERROR ON account_number: {serializer.errors}")
            else:
                print(f"❌ {case['number']!r} - FAILED: Should have been invalid but was accepted")
        
        except Exception as e:
            print(f"❌ {case['number']!r} - ERROR: {e}")
    
    print(f"\nInvalid Numbers Test: {passed}/{total} passed\n")
    return passed == total


def test_edge_cases():
    """Test edge cases"""
    print("=== Testing Edge Cases ===")
    
    edge_cases = [
        {
            'number': '01712345678',  # Valid with leading/trailing spaces
            'account_number': '  01712345678  ',
            'should_pass': True,
            'description': 'Valid number with spaces should be trimmed and pass'
        },
        {
            'number': '01712345678',  # Minimum valid Grameenphone
            'account_number': '01712345678',
            'should_pass': True,
            'description': 'Minimum valid GP number'
        },
        {
            'number': '01999999999',  # Maximum valid Banglalink
            'account_number': '01999999999',
            'should_pass': True,
            'description': 'Maximum valid BL number'
        },
    ]
    
    passed = 0
    total = len(edge_cases)
    
    for case in edge_cases:
        try:
            data = {
                'provider': 'bKash',
                'account_name': 'Test Account',
                'account_number': case['account_number']
            }
            serializer = ServiceFeeMFSSerializer(data=data)
            
            is_valid = serializer.is_valid()
            
            if is_valid == case['should_pass']:
                print(f"✅ {case['description']} - PASSED")
                passed += 1
            else:
                print(f"❌ {case['description']} - FAILED: Expected {'valid' if case['should_pass'] else 'invalid'}, got {'valid' if is_valid else 'invalid'}")
                if not is_valid:
                    print(f"    Errors: {serializer.errors}")
        
        except Exception as e:
            print(f"❌ {case['description']} - ERROR: {e}")
    
    print(f"\nEdge Cases Test: {passed}/{total} passed\n")
    return passed == total


def main():
    """Run all tests"""
    print("🔍 Testing MFS Mobile Number Validation")
    print("=" * 50)
    
    test_results = []
    
    # Run all test suites
    test_results.append(("Valid Numbers", test_valid_numbers()))
    test_results.append(("Invalid Numbers", test_invalid_numbers()))
    test_results.append(("Edge Cases", test_edge_cases()))
    
    # Summary
    print("=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in test_results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 ALL TESTS PASSED! MFS mobile number validation is working correctly.")
    else:
        print("⚠️  SOME TESTS FAILED! Please check the implementation.")
    print("=" * 50)
    
    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)