/**
 * Global Error Reset Middleware
 * Automatically resets Redux state when any service fee management API fails
 * This ensures no stale data is displayed across all pages
 */

import { resetState } from '../slices/serviceFeeManagement/serviceFeeManagementSlice';
import {
  fetchServiceFeeResidents,
  fetchServiceFeeResidentsSingle,
  fetchFilterOptions,
  recordPayment,
  updatePayment,
  deletePayment,
  generateServiceFee
} from '../slices/api/serviceFeeManagement/serviceFeeManagementApi';

/**
 * API actions that should trigger state reset on error
 * Add more actions here as needed
 */
const API_ACTIONS_TO_MONITOR = [
  fetchServiceFeeResidents.rejected,
  fetchServiceFeeResidentsSingle.rejected,
  fetchFilterOptions.rejected,
  recordPayment.rejected,
  updatePayment.rejected,
  deletePayment.rejected,
  generateServiceFee.rejected
];

/**
 * Error reset middleware
 * Listens for any rejected API actions and clears Redux state
 */
export const errorResetMiddleware = store => next => action => {
  // Execute the action first
  const result = next(action);

  // Check if this action is a rejected API call
  if (API_ACTIONS_TO_MONITOR.includes(action.type)) {
    console.warn('API Error detected:', action.type, action.payload);
    // Dispatch resetState to clear stale data
    store.dispatch(resetState());
  }

  return result;
};

export default errorResetMiddleware;
