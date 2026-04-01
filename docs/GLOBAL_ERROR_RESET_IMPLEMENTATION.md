# Global Redux Error Reset Implementation

## Overview
A global Redux middleware has been implemented to automatically clear stale service fee management data whenever ANY API call fails. This ensures no old/cached data is displayed across **ALL pages** in the application.

## Implementation Details

### 1. **Error Reset Middleware** 
**File:** `frontend/src/redux/middleware/errorResetMiddleware.js`

This middleware monitors all service fee management API actions and automatically triggers a state reset when any fail:

```javascript
// Monitors these API actions:
- fetchServiceFeeResidents.rejected
- fetchServiceFeeResidentsSingle.rejected
- fetchFilterOptions.rejected
- recordPayment.rejected
- updatePayment.rejected
- deletePayment.rejected
- generateServiceFee.rejected
```

When any of these actions fail, the middleware automatically dispatches `resetState()` to clear all stale data from Redux.

### 2. **Redux Store Configuration**
**File:** `frontend/src/redux/store.js`

The middleware is registered in the Redux store configuration:

```javascript
import errorResetMiddleware from "./middleware/errorResetMiddleware";

const store = configureStore({
  reducer: { /* ... */ },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(errorResetMiddleware),  // ← Added here
});
```

### 3. **Simplified Component Code**
**File:** `frontend/src/Features/ServiceFeeManagement/Payments/components/PaymentsTable.jsx`

Components no longer need to manually handle error resets:

```javascript
// BEFORE: Manual error handling
const result = await dispatch(fetchServiceFeeResidents(filterParams));
if (fetchServiceFeeResidents.rejected.match(result)) {
  dispatch(resetState());  // ← Manual
}

// AFTER: Automatic via middleware
await dispatch(fetchServiceFeeResidents(filterParams));  // ← Middleware handles it
```

## How It Works

```
Component dispatches API call
         ↓
API fails and returns rejected action
         ↓
errorResetMiddleware intercepts the action
         ↓
Middleware checks if action matches API_ACTIONS_TO_MONITOR
         ↓
YES → Automatically dispatches resetState()
         ↓
Redux state is cleared globally
         ↓
ALL components using serviceFeeManagement state
receive empty/clean data → no stale display
```

## Benefits

✅ **Global Coverage** - Works across ALL pages that use service fee APIs  
✅ **No Code Duplication** - Error handling in one place (middleware)  
✅ **Automatic** - No manual error checking needed in components  
✅ **Consistent** - Same error behavior everywhere  
✅ **Scalable** - Easy to add more API actions to monitor  

## Affected Pages

All pages that fetch service fee data automatically benefit:

- Payments Table (PaymentsTable.jsx)
- Service Fee Overview (Overview.jsx)
- Reports (Reports.jsx)
- Unit Payment History (UnitPaymentHistoryPage.jsx)
- Unit Ledger (UnitLedgerPage.jsx)
- Unit Receivables (UnitReceivablesPage.jsx)
- Any future pages using `fetchServiceFeeResidents` or other monitored APIs

## Testing

To verify the global error reset:

1. **Trigger an API Error:**
   - Open any service fee page (Payments, Reports, etc.)
   - Manipulate browser network to cause a 500 error
   - Check browser console: `"API Error detected:"`

2. **Verify Redux State Reset:**
   - Redux DevTools should show `serviceFeeManagement.residents = []`
   - No stale data displayed in UI
   - Empty state message should appear

3. **Test Multiple Pages:**
   - Navigate between different service fee pages
   - Error handling works consistently across all pages

## Adding More APIs

To monitor additional API actions, update the middleware:

```javascript
// In errorResetMiddleware.js
const API_ACTIONS_TO_MONITOR = [
  fetchServiceFeeResidents.rejected,
  fetchServiceFeeResidentsSingle.rejected,
  // ... existing actions ...
  someNewApi.rejected  // ← Add new API here
];
```

## Files Modified

1. ✅ **Created:** `frontend/src/redux/middleware/errorResetMiddleware.js`
2. ✅ **Modified:** `frontend/src/redux/store.js` (added middleware import and registration)
3. ✅ **Simplified:** `frontend/src/Features/ServiceFeeManagement/Payments/components/PaymentsTable.jsx` (removed manual error handling)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│          Redux Store Configuration                   │
│                                                      │
│  middleware: getDefaultMiddleware()                 │
│             .concat(errorResetMiddleware)  ← NEW   │
└──────────────┬──────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────┐
│     errorResetMiddleware (src/redux/middleware)      │
│                                                      │
│  Monitors:                                          │
│  - fetchServiceFeeResidents.rejected                │
│  - fetchServiceFeeResidentsSingle.rejected          │
│  - fetchFilterOptions.rejected                      │
│  - recordPayment.rejected                           │
│  - updatePayment.rejected                           │
│  - deletePayment.rejected                           │
│  - generateServiceFee.rejected                      │
│                                                      │
│  Action: Dispatch resetState() on any error        │
└──────────────┬──────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────┐
│    serviceFeeManagementSlice.resetState()            │
│                                                      │
│  Clears: residents, errors, statistics, etc.        │
└──────────────┬──────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────┐
│         All Components Using State                   │
│    (PaymentsTable, Overview, Reports, etc.)         │
│                                                      │
│  Result: No stale data displayed                    │
└─────────────────────────────────────────────────────┘
```

## Summary

The global error reset middleware ensures that whenever ANY service fee management API fails, the Redux state is automatically cleared. This prevents stale data from being displayed to users across all pages in the application, providing a consistent and reliable user experience.

No component needs to manually check for or handle API errors - the middleware handles it automatically.
