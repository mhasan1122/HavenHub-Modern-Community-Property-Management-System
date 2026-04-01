# Implementation Plan: 6-Month Navigation in Generate Bills Wizard

## Overview
The goal is to allow users to navigate through different 6-month windows when selecting a month for bill generation. Currently, the wizard only shows the next 6 months from the current date.

## Proposed Changes

### 1. GenerateBillsWizard.jsx
- Add `monthOffset` state to track the starting month of the displayed 6-month window.
- Update `getAvailableMonths` to use `monthOffset` when calculating dates.
- Implement `handlePrev6Months` and `handleNext6Months` functions to increment/decrement `monthOffset` by 6.
- Pass navigation handlers and the current offset to `SelectMonthStep`.

### 2. SelectMonthStep.jsx
- Add navigation buttons (Left/Right arrows) next to the "Select Billing Month" title.
- These buttons will trigger the navigation handlers passed from the parent.
- Update the layout to accommodate these controls.

## User Interface Details
- **Navigation Arrows**: Use `BsChevronLeft` and `BsChevronRight` icons.
- **Columns**: Maintain the 2-column layout (3 months on left, 3 months on right).
- **Navigation**:
  - `Previous` shift the window back by 6 months.
  - `Next` shifts the window forward by 6 months.

## Technical Considerations
- Ensure that the `availableMonths` array is recalculated whenever `monthOffset` changes.
- The `selectedMonth` should persist even when navigating windows, unless the user selects a new one.
