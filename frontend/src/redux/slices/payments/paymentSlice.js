import { createSlice } from "@reduxjs/toolkit";
import {
  fetchPayments,
  fetchPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  fetchResidentPaymentHistory,
  bulkUpdatePayments,
  fetchPaymentStats
} from "../api/paymentApi";

const initialState = {
  // Payments data
  payments: [],
  selectedPayment: null,
  residentPaymentHistory: [],
  paymentStats: {
    totalPayments: 0,
    totalAmount: 0,
    completedCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    completedAmount: 0,
    pendingAmount: 0,
  },

  // Pagination
  pagination: {
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  },

  // Loading states
  loading: false,
  creating: false,
  updating: false,
  deleting: false,
  loadingHistory: false,
  loadingStats: false,

  // Error states
  error: null,
  createError: null,
  updateError: null,
  deleteError: null,
  historyError: null,
  statsError: null,

  // Success states
  createSuccess: false,
  updateSuccess: false,
  deleteSuccess: false,

  // Filters
  filters: {
    status: '',
    method: '',
    residentId: '',
    unitId: '',
    towerId: '',
    serviceMonth: '',
    serviceYear: '',
    fromDate: '',
    toDate: '',
    search: '',
    ordering: '-created_at',
  },

  // UI state
  selectedPaymentIds: [],
  bulkAction: null,
};

const paymentSlice = createSlice({
  name: "payments",
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.historyError = null;
      state.statsError = null;
    },
    
    clearSuccessStates: (state) => {
      state.createSuccess = false;
      state.updateSuccess = false;
      state.deleteSuccess = false;
    },
    clearPaymentItems: (state) => {
      state.payments = [];
      console.log('Payments cleared in state'); 
    },
    clearSelectedPayment: (state) => {
      state.selectedPayment = null;
    },

    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    clearFilters: (state) => {
      state.filters = {
        status: '',
        method: '',
        residentId: '',
        unitId: '',
        towerId: '',
        serviceMonth: '',
        serviceYear: '',
        fromDate: '',
        toDate: '',
        search: '',
        ordering: '-created_at',
      };
    },

    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },

    setSelectedPaymentIds: (state, action) => {
      state.selectedPaymentIds = action.payload;
    },

    togglePaymentSelection: (state, action) => {
      const paymentId = action.payload;
      const index = state.selectedPaymentIds.indexOf(paymentId);
      if (index > -1) {
        state.selectedPaymentIds.splice(index, 1);
      } else {
        state.selectedPaymentIds.push(paymentId);
      }
    },

    clearPaymentSelection: (state) => {
      state.selectedPaymentIds = [];
    },

    setBulkAction: (state, action) => {
      state.bulkAction = action.payload;
    },
  },

  extraReducers: (builder) => {
    // Fetch Payments
    builder
      .addCase(fetchPayments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.loading = false;
        console.log('Redux payload:', action.payload);
        console.log('Payments from payload:', action.payload.payments);
        console.log('Pagination from payload:', action.payload.pagination);
        state.payments = action.payload.payments || action.payload;
        state.pagination = action.payload.pagination || state.pagination;
        console.log('Final state.payments:', state.payments);
        console.log('Final state.pagination:', state.pagination);
        state.error = null;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload || 'Failed to fetch payments';
      });

    // Fetch Payment by ID
    builder
      .addCase(fetchPaymentById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPaymentById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedPayment = action.payload;
        state.error = null;
      })
      .addCase(fetchPaymentById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload || 'Failed to fetch payment';
      });

    // Create Payment
    builder
      .addCase(createPayment.pending, (state) => {
        state.creating = true;
        state.createError = null;
        state.createSuccess = false;
      })
      .addCase(createPayment.fulfilled, (state, action) => {
        state.creating = false;
        state.payments.unshift(action.payload);

        state.createSuccess = action.payload?.message || 'Payment created successfully';
        state.createError = null;
      })
      .addCase(createPayment.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload?.message || action.payload || 'Failed to create payment';
        state.createSuccess = false;
      });

    // Update Payment
    builder
      .addCase(updatePayment.pending, (state) => {
        state.updating = true;
        state.updateError = null;
        state.updateSuccess = false;
      })
      .addCase(updatePayment.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.payments.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.payments[index] = action.payload;
        }
        if (state.selectedPayment?.id === action.payload.id) {
          state.selectedPayment = action.payload;
        }
        state.updateSuccess = action.payload?.message || 'Payment updated successfully';
        state.updateError = null;
      })
      .addCase(updatePayment.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload?.message || action.payload || 'Failed to update payment';
        state.updateSuccess = false;
      });

    // Delete Payment
    builder
      .addCase(deletePayment.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
        state.deleteSuccess = false;
      })
      .addCase(deletePayment.fulfilled, (state, action) => {
        state.deleting = false;
        state.payments = state.payments.filter(p => p.id !== action.payload.paymentId);
        if (state.selectedPayment?.id === action.payload.paymentId) {
          state.selectedPayment = null;
        }
        state.deleteSuccess = true;
        state.deleteError = null;
      })
      .addCase(deletePayment.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload?.message || action.payload || 'Failed to delete payment';
        state.deleteSuccess = false;
      });

    // Fetch Resident Payment History
    builder
      .addCase(fetchResidentPaymentHistory.pending, (state) => {
        state.loadingHistory = true;
        state.historyError = null;
      })
      .addCase(fetchResidentPaymentHistory.fulfilled, (state, action) => {
        state.loadingHistory = false;
        state.residentPaymentHistory = action.payload.payments || [];
        state.historyError = null;
      })
      .addCase(fetchResidentPaymentHistory.rejected, (state, action) => {
        state.loadingHistory = false;
        state.historyError = action.payload?.message || action.payload || 'Failed to fetch payment history';
      });

    // Bulk Update Payments
    builder
      .addCase(bulkUpdatePayments.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(bulkUpdatePayments.fulfilled, (state, action) => {
        state.updating = false;
        // Update payments in the state
        action.payload.forEach(updatedPayment => {
          const index = state.payments.findIndex(p => p.id === updatedPayment.id);
          if (index !== -1) {
            state.payments[index] = updatedPayment;
          }
        });
        state.updateSuccess = true;
        state.selectedPaymentIds = [];
        state.updateError = null;
      })
      .addCase(bulkUpdatePayments.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload?.message || action.payload || 'Failed to bulk update payments';
      });

    // Fetch Payment Stats
    builder
      .addCase(fetchPaymentStats.pending, (state) => {
        state.loadingStats = true;
        state.statsError = null;
      })
      .addCase(fetchPaymentStats.fulfilled, (state, action) => {
        state.loadingStats = false;
        state.paymentStats = action.payload;
        state.statsError = null;
      })
      .addCase(fetchPaymentStats.rejected, (state, action) => {
        state.loadingStats = false;
        state.statsError = action.payload?.message || action.payload || 'Failed to fetch payment stats';
      });
  },
});

export const {
  clearErrors,
  clearSuccessStates,
  clearSelectedPayment,
  setFilters,
  clearFilters,
  setPagination,
  setSelectedPaymentIds,
  togglePaymentSelection,
  clearPaymentSelection,
  setBulkAction,
  clearPaymentItems
} = paymentSlice.actions;

export default paymentSlice.reducer;
