import { createSlice } from "@reduxjs/toolkit";
import {
  fetchServiceFees,
  fetchServiceFeeById,
  createServiceFee,
  updateServiceFee,
  deleteServiceFee,
  permanentlyDeleteServiceFee,
  validateServiceFee,
  fetchTowers,
  fetchUnitsByTower,
  fetchAllUnits,
  getTowerUnits,
  fetchServiceFeeHistory
} from "../api/serviceFeeApi";

const initialState = {
  // Service fees data
  serviceFees: [],
  selectedServiceFee: null,

  // Loading states
  loading: false,
  creating: false,
  updating: false,
  deleting: false,
  validating: false,

  // Error states
  error: null,
  createError: null,
  updateError: null,
  deleteError: null,
  validationError: null,

  // Success states
  message: null,
  createSuccess: false,
  updateSuccess: false,
  deleteSuccess: false,
  validationSuccess: false,

  // Related data
  towers: [],
  units: [],
  allUnits: [],
  towersLoading: false,
  unitsLoading: false,
  unitsCache: {}, // Cache units by tower ID to prevent re-loading

  // History data
  serviceFeeHistory: [],
  historyLoading: false,
  historyError: null,

  // UI state
  activeTab: 1, // 1: Active, 2: Inactive
};

const serviceFeeSlice = createSlice({
  name: "serviceFees",
  initialState,
  reducers: {
    // Clear error states
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.validationError = null;
    },

    // Clear success states
    clearSuccess: (state) => {
      state.message = null;
      state.createSuccess = false;
      state.updateSuccess = false;
      state.deleteSuccess = false;
      state.validationSuccess = false;
    },

    // Set active tab
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },

    // Clear selected service fee
    clearSelectedServiceFee: (state) => {
      state.selectedServiceFee = null;
    },

    // Reset create state
    resetCreateState: (state) => {
      state.creating = false;
      state.createError = null;
      state.createSuccess = false;
      state.message = null;
    },

    // Reset update state
    resetUpdateState: (state) => {
      state.updating = false;
      state.updateError = null;
      state.updateSuccess = false;
      state.message = null;
    },

    // Clear units and cache
    clearUnits: (state) => {
      state.units = [];
      state.unitsCache = {};
    },

    // Set cached units without loading state
    setCachedUnits: (state, action) => {
      state.units = action.payload;
      state.unitsLoading = false;
    },

    // Clear history states
    clearHistory: (state) => {
      state.serviceFeeHistory = [];
      state.historyLoading = false;
      state.historyError = null;
    },

    // Clear all states
    clearAllStates: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.validationError = null;
      state.message = null;
      state.createSuccess = false;
      state.updateSuccess = false;
      state.deleteSuccess = false;
      state.validationSuccess = false;
      state.selectedServiceFee = null;
      state.serviceFeeHistory = [];
      state.historyLoading = false;
      state.historyError = null;
    },

   /*  updateResidentPayment: (state, action) => {
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
*/
 /* removeResidentPayment: (state, action) => {
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
  },*/
  },
  extraReducers: (builder) => {
    // Fetch Service Fees
    builder
      .addCase(fetchServiceFees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServiceFees.fulfilled, (state, action) => {
        state.loading = false;
        state.serviceFees = action.payload;
        state.error = null;
      })
      .addCase(fetchServiceFees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Fetch Service Fee by ID
    builder
      .addCase(fetchServiceFeeById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServiceFeeById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedServiceFee = action.payload;
        state.error = null;
      })
      .addCase(fetchServiceFeeById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Create Service Fee
    builder
      .addCase(createServiceFee.pending, (state) => {
        state.creating = true;
        state.createError = null;
        state.createSuccess = false;
      })
      .addCase(createServiceFee.fulfilled, (state, action) => {
        state.creating = false;
        state.createSuccess = true;
        state.message = "Service fee has been successfully created.";
        state.serviceFees.unshift(action.payload); // Add to beginning of list
        state.createError = null;
        // Invalidate units cache so assignment flags refresh
        state.unitsCache = {};
      })
      .addCase(createServiceFee.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
        state.createSuccess = false;
      })

    // Update Service Fee
    builder
      .addCase(updateServiceFee.pending, (state) => {
        state.updating = true;
        state.updateError = null;
        state.updateSuccess = false;
      })
      .addCase(updateServiceFee.fulfilled, (state, action) => {
        state.updating = false;
        state.updateSuccess = true;
        state.message = "Service fee has been successfully updated.";
        const index = state.serviceFees.findIndex((fee) => fee.id === action.payload.id);
        if (index !== -1) {
          state.serviceFees[index] = action.payload;
        }
        state.selectedServiceFee = action.payload;
        state.updateError = null;
        // Invalidate units cache so assignment flags refresh
        state.unitsCache = {};
      })
      .addCase(updateServiceFee.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
        state.updateSuccess = false;
      })

    // Delete Service Fee
    builder
      .addCase(deleteServiceFee.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
        state.deleteSuccess = false;
      })
      .addCase(deleteServiceFee.fulfilled, (state, action) => {
        state.deleting = false;
        state.deleteSuccess = true;
        state.message = action.payload.message || "Service fee has been successfully cancelled.";
        // Instead of removing the service fee, mark it as inactive
        const index = state.serviceFees.findIndex((fee) => fee.id === action.payload.id);
        if (index !== -1) {
          state.serviceFees[index] = { ...state.serviceFees[index], is_active: false };
        }
        state.deleteError = null;
      })
      .addCase(deleteServiceFee.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
        state.deleteSuccess = false;
      })

    // Permanently Delete Service Fee
    builder
      .addCase(permanentlyDeleteServiceFee.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
        state.deleteSuccess = false;
      })
      .addCase(permanentlyDeleteServiceFee.fulfilled, (state, action) => {
        state.deleting = false;
        state.deleteSuccess = true;
        state.message = action.payload.message || "Service fee has been permanently deleted.";
        // Remove the service fee from the state array completely
        state.serviceFees = state.serviceFees.filter((fee) => fee.id !== action.payload.id);
        state.deleteError = null;
      })
      .addCase(permanentlyDeleteServiceFee.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
        state.deleteSuccess = false;
      })

    // Validate Service Fee
    builder
      .addCase(validateServiceFee.pending, (state) => {
        state.validating = true;
        state.validationError = null;
        state.validationSuccess = false;
      })
      .addCase(validateServiceFee.fulfilled, (state, action) => {
        state.validating = false;
        state.validationSuccess = true;
        state.validationError = null;
      })
      .addCase(validateServiceFee.rejected, (state, action) => {
        state.validating = false;
        state.validationError = action.payload;
        state.validationSuccess = false;
      })

    // Fetch Towers
    builder
      .addCase(fetchTowers.pending, (state) => {
        state.towersLoading = true;
      })
      .addCase(fetchTowers.fulfilled, (state, action) => {
        state.towersLoading = false;
        state.towers = action.payload;
      })
      .addCase(fetchTowers.rejected, (state, action) => {
        state.towersLoading = false;
        state.error = action.payload;
      })

    // Fetch Units by Tower
    builder
      .addCase(fetchUnitsByTower.pending, (state, action) => {
        // Only show loading if we don't have cached units for this tower
        const towerIds = action.meta.arg?.towerIds || action.meta.arg;
        const excludeId = action.meta.arg?.excludeServiceFeeId || null;
        const baseKey = Array.isArray(towerIds) ? towerIds.sort().join(',') : String(towerIds);
        const cacheKey = excludeId ? `${baseKey}|exclude:${excludeId}` : baseKey;
        if (!state.unitsCache[cacheKey]) {
          state.unitsLoading = true;
        }
      })
      .addCase(fetchUnitsByTower.fulfilled, (state, action) => {
        state.unitsLoading = false;
        state.units = action.payload;
        
        // Cache the units by tower IDs
        const towerIds = action.meta.arg?.towerIds || action.meta.arg;
        const excludeId = action.meta.arg?.excludeServiceFeeId || null;
        const baseKey = Array.isArray(towerIds) ? towerIds.sort().join(',') : String(towerIds);
        const cacheKey = excludeId ? `${baseKey}|exclude:${excludeId}` : baseKey;
        state.unitsCache[cacheKey] = action.payload;
      })
      .addCase(fetchUnitsByTower.rejected, (state, action) => {
        state.unitsLoading = false;
        state.error = action.payload;
      })

    // Fetch All Units
    builder
      .addCase(fetchAllUnits.pending, (state) => {
        state.unitsLoading = true;
      })
      .addCase(fetchAllUnits.fulfilled, (state, action) => {
        state.unitsLoading = false;
        state.allUnits = action.payload;
      })
      .addCase(fetchAllUnits.rejected, (state, action) => {
        state.unitsLoading = false;
        state.error = action.payload;
      })

    // Get Tower Units
    builder
      .addCase(getTowerUnits.pending, (state) => {
        state.unitsLoading = true;
      })
      .addCase(getTowerUnits.fulfilled, (state, action) => {
        state.unitsLoading = false;
        state.units = action.payload;
      })
      .addCase(getTowerUnits.rejected, (state, action) => {
        state.unitsLoading = false;
        state.error = action.payload;
      });

    // Fetch Service Fee History
    builder
      .addCase(fetchServiceFeeHistory.pending, (state) => {
        state.historyLoading = true;
        state.historyError = null;
      })
      .addCase(fetchServiceFeeHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.serviceFeeHistory = action.payload;
        state.historyError = null;
      })
      .addCase(fetchServiceFeeHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.historyError = action.payload;
      });
  },
});

export const {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedServiceFee,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
  updateResidentPayment,
  removeResidentPayment,
  clearUnits,
  clearHistory,
  setCachedUnits,
} = serviceFeeSlice.actions;

export default serviceFeeSlice.reducer;
