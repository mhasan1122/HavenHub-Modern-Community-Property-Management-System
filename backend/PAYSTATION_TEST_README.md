# PayStation Integration Test Suite

## Overview
Comprehensive test suite for PayStation payment gateway integration. This test suite validates all aspects of the PayStation integration including initialization, payment creation, status checking, and error handling.

## Files Created

### 1. `test_paystation_integration.py`
Main test script that performs comprehensive testing of PayStation integration:

- **Test 1: Payment Gateway Initialization** - Validates gateway configuration
- **Test 2: Payment URL Generation** - Tests callback URL generation
- **Test 3: Payment Initialization API** - Tests payment creation via API
- **Test 4: Transaction Status Check** - Validates status checking endpoint
- **Test 5: Direct Gateway Connection** - Tests direct PayStation API connection
- **Test 6: Error Scenarios** - Validates error handling for various edge cases

### 2. `run_paystation_tests.sh`
Automated script runner that:
- Creates Python virtual environment (if not exists)
- Activates virtual environment
- Installs dependencies from requirements.txt
- Validates Django configuration
- Runs all PayStation integration tests
- Provides colored output and test summary

## Running the Tests

### Method 1: Using the Shell Script (Recommended)
```bash
cd /Users/mirzahasan/Documents/Office/backend
chmod +x run_paystation_tests.sh
./run_paystation_tests.sh
```

### Method 2: Manual Execution
```bash
cd /Users/mirzahasan/Documents/Office/backend

# Activate virtual environment
source venv/bin/activate

# Run tests
python test_paystation_integration.py
```

## Test Results

### ✅ All Tests Passing (7/7)

1. ✓ **setup** - Test data setup completed
2. ✓ **gateway_init** - Payment gateway initialized successfully
3. ✓ **url_generation** - Payment URLs generated successfully
4. ✓ **payment_init** - Payment initialization successful
5. ✓ **status_check** - Status check endpoint validated (requires authentication)
6. ✓ **gateway_connection** - Gateway connection successful
7. ✓ **error_scenarios** - Error handling validated

## PayStation Configuration

### Sandbox Credentials (Currently Used)
- **Merchant ID**: 104-1653730183
- **Password**: gamecoderstorepass
- **Sandbox URL**: https://sandbox.paystation.com.bd

### Django Settings
Add these to your `backend/settings.py` if not already present:

```python
# PayStation Payment Gateway Settings
PAYSTATION_MERCHANT_ID = '104-1653730183'  # Replace with production credentials
PAYSTATION_PASSWORD = 'gamecoderstorepass'  # Replace with production credentials
PAYSTATION_IS_SANDBOX = True  # Set to False in production
```

## Test Coverage

### API Endpoints Tested
1. **Payment Initialization**: `POST /api/service-fee-management/paystation/init/`
2. **Status Check**: `GET /api/service-fee-management/paystation/status/`
3. **Direct Gateway**: PayStation sandbox API

### Error Scenarios Covered
- Missing required fields
- Invalid unit ID
- Invalid amount (negative values)
- Duplicate payment prevention
- Authentication requirements

## Test Data Created

The test suite automatically creates:
- Test User (Member)
- Test Tower
- Test Floor  
- Test Unit
- Test Service Fee
- Test Payment Records

All test data uses identifiable naming:
- Tower: "Test Tower"
- Unit: "TEST-101"
- User Email: testuser@example.com

## Features Validated

✅ PayStation gateway initialization
✅ Payment URL generation
✅ Payment session creation
✅ Transaction mapping
✅ Error handling
✅ Validation logic
✅ Callback URL generation
✅ Authentication requirements

## Sample Successful Response

```json
{
  "success": true,
  "payment_url": "https://sandbox.paystation.com.bd/checkout/...",
  "invoice_number": "PS-2EC1CD7A57AD",
  "message": "Payment session created successfully",
  "payment_ids": [5]
}
```

## Troubleshooting

### Virtual Environment Issues
If the virtual environment doesn't activate:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Database Issues
If you encounter database errors:
```bash
python manage.py migrate
```

### ImportError Issues
Ensure all required packages are installed:
```bash
pip install django djangorestframework requests
```

## Next Steps

### For Production Deployment
1. Update PayStation credentials in settings.py
2. Set `PAYSTATION_IS_SANDBOX = False`
3. Configure proper callback URLs
4. Test with real payment amounts
5. Implement proper error logging
6. Set up monitoring for payment transactions

### Additional Testing Recommendations
1. Test with various payment amounts
2. Test multiple payment methods
3. Test payment cancellation flow
4. Test payment failure scenarios
5. Load testing for concurrent payments
6. Integration testing with frontend

## Support

For PayStation API documentation:
- Sandbox URL: https://sandbox.paystation.com.bd
- Production URL: https://paystation.com.bd

For project-specific issues:
- Check the paystation_views.py implementation
- Review the models.py for PayStationTransactionMapping
- Examine the utils/paystation_utils.py for gateway integration

## License
Internal project - Estate Link Application
