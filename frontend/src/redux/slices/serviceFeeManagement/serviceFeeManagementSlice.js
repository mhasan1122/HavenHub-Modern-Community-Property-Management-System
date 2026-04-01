import { createSlice } from "@reduxjs/toolkit";
import {
  fetchFilterOptions,
  fetchServiceFeeResidents,
  fetchServiceFeeUnitReceivables,
  fetchServiceFeeResidentsSingle,
  recordPayment,
  updatePayment,
  deletePayment,
  deleteBillingTransaction,
  fetchPaymentHistory,
  generateReport,
  sendReminder,
  // New reminder API functions
  fetchReminders,
  fetchReminderById,
  createReminder,
  updateReminder,
  deleteReminder,
  sendReminderManually,
  fetchReminderLogs,
  generateServiceFee,
  fetchUnitLedger,
  fetchUnitOutstandingSummary
} from "../api/serviceFeeManagement/serviceFeeManagementApi";

const initialState = {
  // Residents data (for payments page)
  residents: [],
  residentsStatistics: {},
  residentsLoading: false,
  residentsError: null,

  // Filter options data
  filterOptions: {
    towers: [],
    status_options: [],
    payment_methods: [],
    service_fees: []
  },
  filterOptionsLoading: false,
  filterOptionsError: null,

  // Payment operations
  paymentLoading: false,
  paymentError: null,
  paymentSuccess: false,
  paymentMessage: null,

  // Payment history
  paymentHistory: [],
  paymentHistoryLoading: false,
  paymentHistoryError: null,

  // Reports
  reportData: null,
  reportLoading: false,
  reportError: null,

  // Reminders - Comprehensive state management
  reminders: [],
  remindersLoading: false,
  remindersError: null,

  selectedReminder: null,
  reminderDetailsLoading: false,
  reminderDetailsError: null,

  reminderOperationLoading: false,
  reminderOperationError: null,
  reminderOperationSuccess: false,
  reminderOperationMessage: null,

  reminderLogs: [],
  reminderLogsLoading: false,
  reminderLogsError: null,

  // Legacy reminder state (keeping for backward compatibility)
  reminderLoading: false,
  reminderError: null,
  reminderSuccess: false,
  reminderMessage: null,

  // Generate service fee state
  generateServiceFeeLoading: false,
  generateServiceFeeError: null,
  generateServiceFeeSuccess: false,
  generateServiceFeeMessage: null,
  generateServiceFeeData: null,

  // Unit Ledger
  unitLedger: [],
  unitLedgerBills: [],
  unitLedgerLoading: false,
  unitLedgerError: null,
  unitLedgerPagination: {},
  unitLedgerSummary: {},
  unitLedgerCache: {}, // Keyed by unitId to prevent redundant fetches

  // Unit Outstanding Summary
  outstandingSummary: [],
  outstandingSummaryLoading: false,
  outstandingSummaryError: null,
  outstandingSummaryStats: {},

  // UI state
  selectedResident: null,
  selectedPayment: null,

  // Receivables filters
  receivablesFilters: {
    selectedTowers: [],
    searchQuery: '',
    sortBy: 'tower_name',
    sortOrder: 'asc',
    currentPage: 1
  },
};

const serviceFeeManagementSlice = createSlice({
  name: "serviceFeeManagement",
  initialState,
  reducers: {
    // Reset all state to initial values (clear old cached data on API error)
    resetState: () => initialState,

    // Clear error states
    clearErrors: (state) => {
      state.residentsError = null;
      state.filterOptionsError = null;
      state.paymentError = null;
      state.paymentHistoryError = null;
      state.reportError = null;
      state.reminderError = null;
      // New reminder error states
      state.remindersError = null;
      state.reminderDetailsError = null;
      state.reminderOperationError = null;
      state.reminderLogsError = null;
      state.outstandingSummaryError = null;
    },

    // Clear success states
    clearSuccess: (state) => {
      state.paymentSuccess = false;
      state.paymentMessage = null;
      state.reminderSuccess = false;
      state.reminderMessage = null;
      // New reminder success states
      state.reminderOperationSuccess = false;
      state.reminderOperationMessage = null;
    },

    // Clear reminder states
    clearReminderStates: (state) => {
      state.remindersError = null;
      state.reminderDetailsError = null;
      state.reminderOperationError = null;
      state.reminderLogsError = null;
      state.reminderOperationSuccess = false;
      state.reminderOperationMessage = null;
    },

    // Set selected reminder
    setSelectedReminder: (state, action) => {
      state.selectedReminder = action.payload;
    },

    // Clear selected reminder
    clearSelectedReminder: (state) => {
      state.selectedReminder = null;
    },

    // Set selected resident
    setSelectedResident: (state, action) => {
      state.selectedResident = action.payload;
    },

    // Set selected payment
    setSelectedPayment: (state, action) => {
      state.selectedPayment = action.payload;
    },

    // Clear selected resident
    clearSelectedResident: (state) => {
      state.selectedResident = null;
    },

    // Clear selected payment
    clearSelectedPayment: (state) => {
      state.selectedPayment = null;
    },

    // Update resident payment in the list
    updateResidentPayment: (state, action) => {
      const updatedPayment = action.payload;

      const index = state.residents.findIndex(sp => {
        return parseInt(sp.resident_id) === parseInt(updatedPayment.resident_id) &&
          parseInt(sp.tower_id) === parseInt(updatedPayment.tower_id) &&
          parseInt(sp.service_fee_id) === parseInt(updatedPayment.service_fee_id) &&
          parseInt(sp.unit_id) === parseInt(updatedPayment.unit_id);
      });

      if (index !== -1) {
        state.residents[index] = { ...state.residents[index], ...updatedPayment };
      } else {
        state.residents.push(updatedPayment);
      }
    },

    // Remove resident payment from the list
    removeResidentPayment: (state, action) => {
      const paymentId = action.payload;
      console.log('=== REDUX REMOVE RESIDENT PAYMENT ===');
      console.log('Removing payment ID:', paymentId);
      console.log('Current residents count before removal:', state.residents.length);

      const index = state.residents.findIndex(sp => {
        return parseInt(sp.payment_id) === parseInt(paymentId);
      });

      console.log('Found payment at index:', index);

      if (index !== -1) {
        console.log('Removing item at index:', index);
        console.log('Item being removed:', state.residents[index]);
        state.residents.splice(index, 1);
        console.log('New residents count after removal:', state.residents.length);
      } else {
        console.log('Payment not found in residents array');
      }

      console.log('=== END REDUX REMOVE ===');
    },

    // Clear payment history
    clearPaymentHistory: (state) => {
      state.paymentHistory = [];
      state.paymentHistoryLoading = false;
      state.paymentHistoryError = null;
    },

    // Clear report data
    clearReportData: (state) => {
      state.reportData = null;
      state.reportLoading = false;
      state.reportError = null;
    },

    // Clear all states
    clearAllStates: (state) => {
      state.residentsError = null;
      state.filterOptionsError = null;
      state.paymentError = null;
      state.paymentHistoryError = null;
      state.reportError = null;
      state.reminderError = null;
      state.paymentSuccess = false;
      state.paymentMessage = null;
      state.reminderSuccess = false;
      state.reminderMessage = null;
      state.selectedResident = null;
      state.selectedPayment = null;
      state.paymentHistory = [];
      state.reportData = null;
    },

    // Set receivables filters
    setReceivablesFilters: (state, action) => {
      state.receivablesFilters = { ...state.receivablesFilters, ...action.payload };
    },

    // Reset receivables filters and clear data for fresh load
    resetReceivablesFilters: (state) => {
      state.receivablesFilters = {
        selectedTowers: [],
        searchQuery: '',
        sortBy: 'tower_name',
        sortOrder: 'asc',
        currentPage: 1
      };
      state.outstandingSummary = [];
      state.outstandingSummaryStats = {};
      state.unitLedgerCache = {};
      state.unitLedger = [];
      state.unitLedgerBills = [];
      state.unitLedgerSummary = {};
    },
  },
  extraReducers: (builder) => {
    // Fetch Filter Options
    builder
      .addCase(fetchFilterOptions.pending, (state) => {
        state.filterOptionsLoading = true;
        state.filterOptionsError = null;
      })
      .addCase(fetchFilterOptions.fulfilled, (state, action) => {
        state.filterOptionsLoading = false;
        state.filterOptions = action.payload;
        state.filterOptionsError = null;
      })
      .addCase(fetchFilterOptions.rejected, (state, action) => {
        state.filterOptionsLoading = false;
        state.filterOptionsError = action.payload;
      })

    // Fetch Service Fee Residents
    builder
      .addCase(fetchServiceFeeResidents.pending, (state) => {
        state.residentsLoading = true;
        state.residentsError = null;
      })
      .addCase(fetchServiceFeeResidents.fulfilled, (state, action) => {
        state.residentsLoading = false;
        state.residents = action.payload.payments || [];
        state.residentsStatistics = action.payload.stats || {};
        state.residentsError = null;
      })
      .addCase(fetchServiceFeeResidents.rejected, (state, action) => {
        state.residentsLoading = false;
        state.residentsError = action.payload;
      })

    // Fetch Service Fee Unit Receivables
    builder
      .addCase(fetchServiceFeeUnitReceivables.pending, (state) => {
        state.residentsLoading = true;
        state.residentsError = null;
      })
      .addCase(fetchServiceFeeUnitReceivables.fulfilled, (state, action) => {
        state.residentsLoading = false;
        state.residents = action.payload.payments || [];
        state.residentsStatistics = action.payload.stats || {};
        state.residentsError = null;
      })
      .addCase(fetchServiceFeeUnitReceivables.rejected, (state, action) => {
        state.residentsLoading = false;
        state.residentsError = action.payload;
      })

    // Fetch Single Service Fee Resident
    builder
      .addCase(fetchServiceFeeResidentsSingle.pending, (state) => {
        state.residentsLoading = true;
        state.residentsError = null;
      })
      .addCase(fetchServiceFeeResidentsSingle.fulfilled, (state, action) => {
        state.residentsLoading = false;

        // Update only the specific item instead of replacing entire array
        const newData = action.payload.payments || [];
        const stats = action.payload.stats || {};

        console.log('=== SINGLE ITEM REDUX UPDATE ===');
        console.log('New data from API:', newData);
        console.log('Current residents count:', state.residents.length);

        if (newData.length > 0) {
          const updatedItem = newData[0];

          // Find the existing item to update
          const index = state.residents.findIndex(sp => {
            return parseInt(sp.resident_id) === parseInt(updatedItem.resident_id) &&
              parseInt(sp.tower_id) === parseInt(updatedItem.tower_id) &&
              parseInt(sp.service_fee_id) === parseInt(updatedItem.service_fee_id) &&
              parseInt(sp.unit_id) === parseInt(updatedItem.unit_id);
          });

          console.log('Found existing item at index:', index);

          if (index !== -1) {
            // Update existing item - replace completely to avoid stale data
            console.log('Updating existing item at index:', index);
            console.log('Old item:', state.residents[index]);
            state.residents[index] = updatedItem;
            console.log('New item:', state.residents[index]);
          } else {
            // Don't add new item after deletion - only update existing items
            console.log('Item not found in array - skipping add (likely after deletion)');
          }
        }

        // Update statistics
        state.residentsStatistics = stats;
        state.residentsError = null;

        console.log('Final residents count:', state.residents.length);
        console.log('Updated statistics:', stats);
        console.log('=== END SINGLE ITEM REDUX UPDATE ===');
      })
      .addCase(fetchServiceFeeResidentsSingle.rejected, (state, action) => {
        state.residentsLoading = false;
        state.residentsError = action.payload;
      })

    // Record Payment
    builder
      .addCase(recordPayment.pending, (state) => {
        state.paymentLoading = true;
        state.paymentError = null;
        state.paymentSuccess = false;
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
        state.paymentLoading = false;
        state.paymentSuccess = true;
        state.paymentMessage = "Payment recorded successfully!";
        state.paymentError = null;

        // Update the resident in the list if it exists
        const payment = action.payload;
        const index = state.residents.findIndex(resident =>
          resident.resident_id === payment.resident_id &&
          resident.unit_id === payment.unit_id &&
          resident.service_fee_id === payment.service_fee_id
        );

        if (index !== -1) {
          state.residents[index] = { ...state.residents[index], ...payment };
        }
      })
      .addCase(recordPayment.rejected, (state, action) => {
        state.paymentLoading = false;
        state.paymentError = action.payload;
        state.paymentSuccess = false;
      })

    // Update Payment
    builder
      .addCase(updatePayment.pending, (state) => {
        state.paymentLoading = true;
        state.paymentError = null;
        state.paymentSuccess = false;
      })
      .addCase(updatePayment.fulfilled, (state, action) => {
        state.paymentLoading = false;
        state.paymentSuccess = true;
        state.paymentMessage = "Payment updated successfully!";
        state.paymentError = null;

        // Update the resident in the list
        const payment = action.payload;
        const index = state.residents.findIndex(resident =>
          resident.payment_id === payment.payment_id
        );

        if (index !== -1) {
          state.residents[index] = { ...state.residents[index], ...payment };
        }
      })
      .addCase(updatePayment.rejected, (state, action) => {
        state.paymentLoading = false;
        state.paymentError = action.payload;
        state.paymentSuccess = false;
      })

    // Delete Payment
    builder
      .addCase(deletePayment.pending, (state) => {
        state.paymentLoading = true;
        state.paymentError = null;
        state.paymentSuccess = false;
      })
      .addCase(deletePayment.fulfilled, (state, action) => {
        state.paymentLoading = false;
        state.paymentSuccess = true;
        state.paymentMessage = action.payload.message || "Payment deleted successfully!";
        state.paymentError = null;

        // Remove the payment from the list
        const paymentId = action.payload.payment_id;
        state.residents = state.residents.filter(resident =>
          resident.payment_id !== paymentId
        );
      })
      .addCase(deletePayment.rejected, (state, action) => {
        state.paymentLoading = false;
        state.paymentError = action.payload;
        state.paymentSuccess = false;
      })

    // Delete Billing Transaction
    builder
      .addCase(deleteBillingTransaction.pending, (state) => {
        state.paymentLoading = true;
        state.paymentError = null;
        state.paymentSuccess = false;
      })
      .addCase(deleteBillingTransaction.fulfilled, (state, action) => {
        state.paymentLoading = false;
        state.paymentSuccess = true;
        state.paymentMessage = action.payload.message || "Payment transaction deleted successfully!";
        state.paymentError = null;

        // Remove the payment from the list using billing_pk
        const billing_pk = action.payload.billing_pk;
        state.residents = state.residents.filter(resident =>
          resident.billing_pk !== billing_pk
        );
      })
      .addCase(deleteBillingTransaction.rejected, (state, action) => {
        state.paymentLoading = false;
        state.paymentError = action.payload;
        state.paymentSuccess = false;
      })

    // Fetch Payment History
    builder
      .addCase(fetchPaymentHistory.pending, (state) => {
        state.paymentHistoryLoading = true;
        state.paymentHistoryError = null;
      })
      .addCase(fetchPaymentHistory.fulfilled, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistory = action.payload;
        state.paymentHistoryError = null;
      })
      .addCase(fetchPaymentHistory.rejected, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistoryError = action.payload;
      })

    // Generate Report
    builder
      .addCase(generateReport.pending, (state) => {
        state.reportLoading = true;
        state.reportError = null;
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.reportLoading = false;
        state.reportData = action.payload;
        state.reportError = null;
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.reportLoading = false;
        state.reportError = action.payload;
      })

    // Send Reminder (Legacy)
    builder
      .addCase(sendReminder.pending, (state) => {
        state.reminderLoading = true;
        state.reminderError = null;
        state.reminderSuccess = false;
      })
      .addCase(sendReminder.fulfilled, (state, action) => {
        state.reminderLoading = false;
        state.reminderSuccess = true;
        state.reminderMessage = action.payload.message || "Reminder sent successfully!";
        state.reminderError = null;
      })
      .addCase(sendReminder.rejected, (state, action) => {
        state.reminderLoading = false;
        state.reminderError = action.payload;
        state.reminderSuccess = false;
      })

    // ==================== NEW REMINDER REDUCERS ====================

    // Fetch Reminders
    builder
      .addCase(fetchReminders.pending, (state) => {
        state.remindersLoading = true;
        state.remindersError = null;
      })
      .addCase(fetchReminders.fulfilled, (state, action) => {
        state.remindersLoading = false;
        state.reminders = action.payload;
        state.remindersError = null;
      })
      .addCase(fetchReminders.rejected, (state, action) => {
        state.remindersLoading = false;
        state.remindersError = action.payload;
      })

    // Fetch Reminder By ID
    builder
      .addCase(fetchReminderById.pending, (state) => {
        state.reminderDetailsLoading = true;
        state.reminderDetailsError = null;
      })
      .addCase(fetchReminderById.fulfilled, (state, action) => {
        state.reminderDetailsLoading = false;
        state.selectedReminder = action.payload;
        state.reminderDetailsError = null;
      })
      .addCase(fetchReminderById.rejected, (state, action) => {
        state.reminderDetailsLoading = false;
        state.reminderDetailsError = action.payload;
      })

    // Create Reminder
    builder
      .addCase(createReminder.pending, (state) => {
        state.reminderOperationLoading = true;
        state.reminderOperationError = null;
        state.reminderOperationSuccess = false;
      })
      .addCase(createReminder.fulfilled, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationSuccess = true;
        state.reminderOperationMessage = "Reminder created successfully!";
        state.reminderOperationError = null;

        // Add new reminder to the list
        state.reminders.unshift(action.payload);
      })
      .addCase(createReminder.rejected, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationError = action.payload;
        state.reminderOperationSuccess = false;
      })

    // Update Reminder
    builder
      .addCase(updateReminder.pending, (state) => {
        state.reminderOperationLoading = true;
        state.reminderOperationError = null;
        state.reminderOperationSuccess = false;
      })
      .addCase(updateReminder.fulfilled, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationSuccess = true;
        state.reminderOperationMessage = "Reminder updated successfully!";
        state.reminderOperationError = null;

        // Update reminder in the list
        const updatedReminder = action.payload;
        const index = state.reminders.findIndex(reminder => reminder.id === updatedReminder.id);
        if (index !== -1) {
          state.reminders[index] = updatedReminder;
        }

        // Update selected reminder if it matches
        if (state.selectedReminder && state.selectedReminder.id === updatedReminder.id) {
          state.selectedReminder = updatedReminder;
        }
      })
      .addCase(updateReminder.rejected, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationError = action.payload;
        state.reminderOperationSuccess = false;
      })

    // Delete Reminder
    builder
      .addCase(deleteReminder.pending, (state) => {
        state.reminderOperationLoading = true;
        state.reminderOperationError = null;
        state.reminderOperationSuccess = false;
      })
      .addCase(deleteReminder.fulfilled, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationSuccess = true;
        state.reminderOperationMessage = action.payload.message || "Reminder deleted successfully!";
        state.reminderOperationError = null;

        // Remove reminder from the list
        const reminderId = action.payload.id;
        state.reminders = state.reminders.filter(reminder => reminder.id !== reminderId);

        // Clear selected reminder if it was deleted
        if (state.selectedReminder && state.selectedReminder.id === reminderId) {
          state.selectedReminder = null;
        }
      })
      .addCase(deleteReminder.rejected, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationError = action.payload;
        state.reminderOperationSuccess = false;
      })

    // Send Reminder Manually
    builder
      .addCase(sendReminderManually.pending, (state) => {
        state.reminderOperationLoading = true;
        state.reminderOperationError = null;
        state.reminderOperationSuccess = false;
      })
      .addCase(sendReminderManually.fulfilled, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationSuccess = true;
        state.reminderOperationMessage = "Reminder sent successfully!";
        state.reminderOperationError = null;

        // Update reminder stats if provided
        if (action.payload && action.payload.total_sent) {
          const reminderId = action.meta.arg; // The reminderId passed to the thunk
          const index = state.reminders.findIndex(reminder => reminder.id === reminderId);
          if (index !== -1) {
            state.reminders[index].total_sent = action.payload.total_sent;
            state.reminders[index].last_sent = action.payload.last_sent;
          }
        }
      })
      .addCase(sendReminderManually.rejected, (state, action) => {
        state.reminderOperationLoading = false;
        state.reminderOperationError = action.payload;
        state.reminderOperationSuccess = false;
      })

    // Fetch Reminder Logs
    builder
      .addCase(fetchReminderLogs.pending, (state) => {
        state.reminderLogsLoading = true;
        state.reminderLogsError = null;
      })
      .addCase(fetchReminderLogs.fulfilled, (state, action) => {
        state.reminderLogsLoading = false;
        state.reminderLogs = action.payload;
        state.reminderLogsError = null;
      })
      .addCase(fetchReminderLogs.rejected, (state, action) => {
        state.reminderLogsLoading = false;
        state.reminderLogsError = action.payload;
      })

      // Generate service fee
      .addCase(generateServiceFee.pending, (state) => {
        state.generateServiceFeeLoading = true;
        state.generateServiceFeeError = null;
        state.generateServiceFeeSuccess = false;
      })
      .addCase(generateServiceFee.fulfilled, (state, action) => {
        state.generateServiceFeeLoading = false;
        state.generateServiceFeeSuccess = true;
        state.generateServiceFeeMessage = action.payload.message;
        state.generateServiceFeeData = action.payload.data;
      })
      .addCase(generateServiceFee.rejected, (state, action) => {
        state.generateServiceFeeLoading = false;
        state.generateServiceFeeError = action.payload?.message || 'Failed to generate service fee';
      })

      // Fetch Unit Ledger
      .addCase(fetchUnitLedger.pending, (state) => {
        state.unitLedgerLoading = true;
        state.unitLedgerError = null;
      })
      .addCase(fetchUnitLedger.fulfilled, (state, action) => {
        state.unitLedgerLoading = false;
        const results = action.payload.results || [];
        const unitId = action.meta.arg.unit_id;

        // Save to specific cache to allow back-and-forth between units
        if (unitId) {
          state.unitLedgerCache[unitId] = {
            results,
            bills: action.payload.bills || [],
            summary: action.payload.summary || {},
            pagination: action.payload.pagination || {}
          };
        }

        state.unitLedger = results;
        state.unitLedgerBills = action.payload.bills || [];
        state.unitLedgerPagination = action.payload.pagination || {};
        state.unitLedgerSummary = action.payload.summary || {};
        state.unitLedgerError = null;
      })
      .addCase(fetchUnitLedger.rejected, (state, action) => {
        state.unitLedgerLoading = false;
        state.unitLedgerError = action.payload?.message || 'Failed to fetch unit ledger';
      })

      // Fetch Unit Outstanding Summary
      .addCase(fetchUnitOutstandingSummary.pending, (state) => {
        state.outstandingSummaryLoading = true;
        state.outstandingSummaryError = null;
      })
      .addCase(fetchUnitOutstandingSummary.fulfilled, (state, action) => {
        state.outstandingSummaryLoading = false;
        // Support both aggregated "data" and raw "results" (fallback for consolidated ledger API)
        state.outstandingSummary = action.payload.data || action.payload.results || [];
        state.outstandingSummaryStats = action.payload.summary || {};
        state.outstandingSummaryError = null;
      })
      .addCase(fetchUnitOutstandingSummary.rejected, (state, action) => {
        state.outstandingSummaryLoading = false;
        state.outstandingSummaryError = action.payload || 'Failed to fetch outstanding summary';
      });
  },
});

export const {
  resetState,
  clearErrors,
  clearSuccess,
  clearReminderStates,
  setSelectedResident,
  setSelectedPayment,
  setSelectedReminder,
  clearSelectedResident,
  clearSelectedPayment,
  clearSelectedReminder,
  updateResidentPayment,
  removeResidentPayment,
  clearPaymentHistory,
  clearReportData,
  clearAllStates,
  setReceivablesFilters,
  resetReceivablesFilters,
} = serviceFeeManagementSlice.actions;

export default serviceFeeManagementSlice.reducer;