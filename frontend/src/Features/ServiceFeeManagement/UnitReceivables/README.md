# Unit Receivables Module

This module handles all unit receivables and ledger management functionality for the Service Fee Management system.

## Structure

```
UnitReceivables/
├── components/
│   ├── UnitReceivables.jsx        # Main receivables list (default export)
│   ├── UnitLedger.jsx             # Unit transaction ledger with advance payments
│   ├── UnitDetails.jsx            # Unit details component
│   └── UnitPaymentHistory.jsx     # Payment history for units
├── index.js                       # Module exports
└── README.md                      # This file
```

## Components

### UnitReceivables (Default Export)
- Main component for the Unit Receivables page
- Displays all units with outstanding balances
- Provides filtering by tower and search functionality
- Shows summary statistics (total units, outstanding amount, unpaid bills)
- Sortable table with pagination

### UnitLedger
- Complete financial ledger for a specific unit
- Shows all transactions with debit/credit accounting
- Displays running balance
- **NEW**: Includes advance payment tracking
  - Advance Total
  - Advance Available
  - Advance Applied
- Financial summary cards
- Unpaid bills modal

### UnitDetails
- Placeholder for unit details view
- To be implemented

### UnitPaymentHistory
- Wrapper for UnitPaymentHistory component
- Displays payment history for units

## Features

### Advance Payment Integration
The ledger now tracks advance payments with:
- **Debit (Dr)**: Bills, penalties (what the unit owes)
- **Credit (Cr)**: Payments, waivers, advances (what reduces the debt)
- Running balance calculation
- Visual indicators for advance payment status
- Available amount display

## Usage

### In pages folder (Recommended)
```javascript
// pages/UnitReceivablesPage.jsx
import UnitReceivables from '../Features/ServiceFeeManagement/UnitReceivables';

const UnitReceivablesPage = () => {
  return <UnitReceivables />;
};

export default UnitReceivablesPage;
```

### Direct component import
```javascript
import { UnitLedger, UnitDetails } from './Features/ServiceFeeManagement/UnitReceivables';
```

## Related Components
- `UnpaidBillsModal` - Modal for viewing unpaid bills
- `ModernLoadingAnimation` - Loading state
- `TableSkeleton` - Table loading skeleton

## API Endpoints
- `fetchUnitOutstandingSummary` - Get units with outstanding balances
- `fetchUnitLedger` - Get complete transaction ledger for a unit
- `fetchFilterOptions` - Get filter options (towers, etc.)

## Redux State
- `serviceFeeManagement.outstandingSummary` - Outstanding units data
- `serviceFeeManagement.unitLedger` - Unit ledger transactions
- `serviceFeeManagement.unitLedgerSummary` - Financial summary including advance payments
- `unit.selectedUnitDetails` - Selected unit details

## Pattern
This module follows the same structure as `BillingManagement`:
- Main component in `components/` folder
- Default export in `index.js`
- Single page wrapper in `pages/` folder
