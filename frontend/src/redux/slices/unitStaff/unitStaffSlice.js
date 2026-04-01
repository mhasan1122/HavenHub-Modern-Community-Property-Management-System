// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import axiosInstance from "../../../utils/axiosInstance";

// // for creating unit staff
// export const createUnitStaff = createAsyncThunk(
//   "unitStaff/createUnitStaff",
//   async (unitStaffData, { rejectWithValue }) => {
//     try {
//       const response = await axiosInstance.post(
//         "/towers/create_unit_staff/",
//         unitStaffData
//       );
//       return response.data;
//     } catch (error) {
//       return rejectWithValue(error.response?.data ?? error.message);
//     }
//   }
// );

// // Unit staff list for a particular list
// export const fetchUnitStaff = createAsyncThunk(
//   "unit_staff/fetchUnitStaff",
//   async (unitId, { rejectWithValue }) => {
//     try {
//       const response = await axiosInstance.get(
//         `/towers/unit_staff_list/${unitId}/`
//       );
//       return response.data;
//     } catch (error) {
//       return rejectWithValue(error.response?.data ?? error.message);
//     }
//   }
// );

// // Update unit staff status(fh)
// export const updateUnitStaffStatus = createAsyncThunk(
//   "unitStaff/updateUnitStaffStatus",
//   async ({ id, unit_staff_status }, { rejectWithValue }) => {
//     try {
//       const response = await axiosInstance.patch(
//         `/towers/unit-staff/update-status/${id}/`,
//         { unit_staff_status }
//       );
//       return response.data;
//     } catch (error) {
//       return rejectWithValue(error.response?.data ?? error.message);
//     }
//   }
// );

// const unitStaffSlice = createSlice({
//   name: "unitStaff",
//   initialState: {
//     loading: false,
//     error: null,
//     success: false,
//     data: null,

//     members: [],
//     loadingMembers: false,
//     errorMembers: null,

//     selectedMember: null,
//     loadingMemberDetails: false,
//     errorMemberDetails: null,

//     residents: [],
//     loadingUnitStaffList: false,

//     errorUnitStaffsList: null

//     // updatingResident: false,
//     // updateSuccess: false,
//     // updateError: null,
//   },
//   reducers: {
//     resetUnitStaffState: (state) => {
//       state.loading = false;
//       state.error = null;
//       state.success = false;
//       state.data = null;

//       state.selectedMember = null;
//       state.loadingMemberDetails = false;
//       state.errorMemberDetails = null;

//       state.residents = [];
//       state.loadingUnitStaffList = false;
//       state.errorUnitStaffsList = null;

//       // Reset the resident details fields too.
//       // state.residentDetails = null;
//       // state.loadingResidentDetails = false;
//       // state.errorResidentDetails = null;
//     }
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(createUnitStaff.pending, (state) => {
//         state.loading = true;
//         state.error = null;
//         state.success = false;
//       })
//       .addCase(createUnitStaff.fulfilled, (state, action) => {
//         state.loading = false;
//         state.success = true;
//         state.data = action.payload;
//       })
//       .addCase(createUnitStaff.rejected, (state, action) => {
//         state.loading = false;
//         state.error = action.payload;
//       });
//     // fetchUnitStaff List
//     builder
//       .addCase(fetchUnitStaff.pending, (state) => {
//         state.loadingUnitStaffList = true;
//         state.errorUnitStaffsList = null;
//       })
//       .addCase(fetchUnitStaff.fulfilled, (state, action) => {
//         state.loadingUnitStaffList = false;

//         state.residents = action.payload;
//       })
//       .addCase(fetchUnitStaff.rejected, (state, action) => {
//         state.loadingUnitStaffList = false;
//         state.errorUnitStaffsList = action.payload;
//       })

//       // updateUnitStaffStatus
//       .addCase(updateUnitStaffStatus.pending, (state) => {
//         state.loading = true;
//         state.error = null;
//       })
//       .addCase(updateUnitStaffStatus.fulfilled, (state, action) => {
//         state.loading = false;
//         state.success = true;

//         // Update the unit staff status in the state if needed
//         const updatedId = action.payload.data.id;
//         const updatedStatus = action.payload.data.unit_staff_status;
//         const index = state.residents.findIndex((r) => r.id === updatedId);
//         if (index !== -1) {
//           state.residents[index].unit_staff_status = updatedStatus;
//         }
//       })
//       .addCase(updateUnitStaffStatus.rejected, (state, action) => {
//         state.loading = false;
//         state.error = action.payload;
//       });
//   }
// });

// export const { resetUnitStaffState } = unitStaffSlice.actions;
// export default unitStaffSlice.reducer;
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// for creating unit staff
export const createUnitStaff = createAsyncThunk(
  "unitStaff/createUnitStaff",
  async (unitStaffData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        "/towers/create_unit_staff/",
        unitStaffData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// Unit staff list for a particular list
export const fetchUnitStaff = createAsyncThunk(
  "unitStaff/fetchUnitStaff",
  async (unitId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `/towers/unit_staff_list/${unitId}/`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// Update unit staff status
export const updateUnitStaffStatus = createAsyncThunk(
  "unitStaff/updateUnitStaffStatus",
  async ({ id, unit_staff_status }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(
        `/towers/unit-staff/update-status/${id}/`,
        { unit_staff_status }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

export const bulkDeleteUnitStaff = createAsyncThunk(
  "unitStaff/bulkDeleteUnitStaff",
  async (ids, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(
        "/towers/unit-staff/bulk-delete/",
        { data: { ids } }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// Fetch unit staff history
export const fetchUnitStaffHistory = createAsyncThunk(
  "unitStaff/fetchUnitStaffHistory",
  async (unitId, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.get(
        `/towers/unit_staff_history/${unitId}/`
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message);
    }
  }
);

const unitStaffSlice = createSlice({
  name: "unitStaff",
  initialState: {
    loading: false,
    error: null,
    message: null,
    showMessage: false,
    success: false,
    data: null,

    residents: [],
    loadingUnitStaffList: false,
    errorUnitStaffsList: null,
    
    // Unit staff history state
    staffHistory: { unit: null, entries: [] },
    staffHistoryLoading: false,
    staffHistoryError: null
  },
  reducers: {
    resetUnitStaffState: (state) => {
      state.loading = false;
      state.error = null;
      state.message = null;
      state.showMessage = false;
      state.success = false;
      state.data = null;
      state.residents = [];
      state.loadingUnitStaffList = false;
      state.errorUnitStaffsList = null;
    },
    clearStaffHistory: (state) => {
      state.staffHistory = { unit: null, entries: [] };
      state.staffHistoryLoading = false;
      state.staffHistoryError = null;
    },
    clearMessage: (state) => {
      // state.message = null;
      // state.error = null;
      //    state.showMessage = false;
      state.message = null;
      state.error = null;
      state.showMessage = false;
    },
    setShowMessage: (state, action) => {
      state.showMessage = action.payload;
    },
   
  },
  extraReducers: (builder) => {
    builder
      .addCase(createUnitStaff.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
        state.showMessage = false;
        state.success = false;
      })

      .addCase(createUnitStaff.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
        state.error = null; // ✅
        state.message =
          action.payload.message || "Unit staff created successfully";
        state.showMessage = true;
        
        // Dispatch event for instant notification update
        window.dispatchEvent(new Event('unitStaffAdded'));
      })
      // .addCase(createUnitStaff.fulfilled, (state, action) => {
      //   state.loading = false;
      //   state.success = true;
      //   state.data = action.payload;
      // })
      .addCase(createUnitStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // fetchUnitStaff List
      .addCase(fetchUnitStaff.pending, (state) => {
        state.loadingUnitStaffList = true;
        state.errorUnitStaffsList = null;
      })
      // .addCase(fetchUnitStaff.pending, (state) => {
      //   state.loadingUnitStaffList = true;
      // })

      .addCase(fetchUnitStaff.fulfilled, (state, action) => {
        state.loadingUnitStaffList = false;
        state.residents = action.payload;
      })
      .addCase(fetchUnitStaff.rejected, (state, action) => {
        state.loadingUnitStaffList = false;
        state.errorUnitStaffsList = action.payload;
      })

      // updateUnitStaffStatus
      .addCase(updateUnitStaffStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
        state.showMessage = false;
      })
      .addCase(updateUnitStaffStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload.message || "Status updated successfully";
        state.showMessage = true;
        const updatedId = action.payload.data.id;
        const updatedStatus = action.payload.data.unit_staff_status;
        const index = state.residents.findIndex((r) => r.id === updatedId);
        if (index !== -1) {
          state.residents[index].unit_staff_status = updatedStatus;
        }
        
        // Dispatch event for instant notification update
        window.dispatchEvent(new Event('unitStaffUpdated'));
      })
      .addCase(updateUnitStaffStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.showMessage = true;
      })

      builder
      .addCase(bulkDeleteUnitStaff.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
        state.showMessage = false;
        state.success = false;
      })
      .addCase(bulkDeleteUnitStaff.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload.message || "Unit staff deleted successfully.";
        state.showMessage = true;

        // optionally remove deleted items from the residents list:
        if (action.meta.arg && Array.isArray(action.meta.arg)) {
          state.residents = state.residents.filter(
            r => !action.meta.arg.includes(r.id)
          );
        }
        
        // Dispatch event for instant notification update
        window.dispatchEvent(new Event('unitStaffRemoved'));
      })
      .addCase(bulkDeleteUnitStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.showMessage = true;
      })

      // Unit staff history
      .addCase(fetchUnitStaffHistory.pending, (state) => {
        state.staffHistoryLoading = true;
        state.staffHistoryError = null;
      })
      .addCase(fetchUnitStaffHistory.fulfilled, (state, action) => {
        state.staffHistoryLoading = false;
        state.staffHistory = action.payload;
      })
      .addCase(fetchUnitStaffHistory.rejected, (state, action) => {
        state.staffHistoryLoading = false;
        state.staffHistoryError = action.payload;
      });
  }
});

export const { resetUnitStaffState, clearMessage, setShowMessage, clearStaffHistory } =
  unitStaffSlice.actions;
export default unitStaffSlice.reducer;
