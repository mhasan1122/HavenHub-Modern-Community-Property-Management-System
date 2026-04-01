import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

const initialState = {
  loading: false,
  error: null,
  successMessage: "",
  members: [],
  memberSearchLoading: false,
  ownerList: { unit: null, owners: [] },
  ownerDetails: null,
  ownerDetailsLoading: false,
  ownerDetailsError: null,
  createdMember: null,
  success: false,
  data: null,
  loadingOwnerDetails: false,
  errorOwnerDetails: null,
  unitOwnership: [],
  unitOwnershipLoading: false,
  unitOwnershipError: null,
  // Unit ownership history state
  ownershipHistory: { unit: null, entries: [] },
  ownershipHistoryLoading: false,
  ownershipHistoryError: null,
  // Pending member/company data (stored locally until owner is saved)
  pendingMemberData: null,
  pendingCompanyData: null
};

export const createOwner = createAsyncThunk(
  "owner/createOwner",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.post(
        "/towers/create_owner/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );
      return data;
    } catch (error) {
      // Return the full error response data if available, otherwise return the error message
      return rejectWithValue(
        error?.response?.data || 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        error.message
      );
    }
  }
);

export const bulkCreateOwner = createAsyncThunk(
  "owner/bulkCreateOwner",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.post(
        "/towers/bulk_create_owner/",
        payload,
        {
          headers: { "Content-Type": "application/json" }
        }
      );
      return data;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data || 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        error.message
      );
    }
  }
);

export const updateOwner = createAsyncThunk(
  "owner/updateOwner",
  async ({ ownerId, formData }, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.put(
        `/towers/update_owner/${ownerId}/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );
      return data;
    } catch (error) {
      // Return the full error response data if available, otherwise return the error message
      return rejectWithValue(
        error?.response?.data || 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        error.message
      );
    }
  }
);

export const deleteOwner = createAsyncThunk(
  "owner/deleteOwner",
  async (ownerId, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.delete(
        `/towers/delete_owner/${ownerId}/`
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message);
    }
  }
);

export const fetchOwnerDetails = createAsyncThunk(
  "owner/fetchOwnerDetails",
  async ({ unitId, ownerId }, { rejectWithValue }) => {
    const { data } = await axiosInstance.get(
      `/towers/owner_details/${unitId}/${ownerId}/`
    );
    return data;
  }
);

export const fetchUnitOwnershipByMember = createAsyncThunk(
  "owner/fetchUnitOwnershipByMember",
  async (memberId, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.get(
        `/towers/unit_ownership_by_member/${memberId}/`
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message);
    }
  }
);

export const fetchUnitOwnershipHistory = createAsyncThunk(
  "owner/fetchUnitOwnershipHistory",
  async (unitId, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.get(
        `/towers/unit_ownership_history/${unitId}/`
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message);
    }
  }
);

export const addExistingMemberForOwner = createAsyncThunk(
  "contacts/addExistingMemberForOwner",
  async (data, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        "/towers/add_existing_member_for_owner/",
        data
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data || "Something went wrong");
    }
  }
);

export const searchMembers = createAsyncThunk(
  "owner/searchMembers",
  async (searchTerm, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.get(
        `/towers/add_owner_search/?search=${searchTerm}`
      );
      return data?.member_data || [];
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message);
    }
  }
);

export const fetchOwnerList = createAsyncThunk(
  "owner/fetchOwnerList",
  async (unitId, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.get(
        `/towers/owner_list_of_unit/${unitId}/`
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message);
    }
  }
);

export const CreatememberForUnit = createAsyncThunk(
  "members/createForUnit",
  async (formData, thunkAPI) => {
    try {
      for (let pair of formData.entries()) {
        console.log(pair[0] + ": " + pair[1]);
      }

      const response = await axiosInstance.post(
        "/user/create_member_for_unit/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

const ownerSlice = createSlice({
  name: "owner",
  initialState,
  reducers: {
    clearMessage: (state) => {
      state.error = null;
      state.successMessage = "";
      state.success = false;
      state.message = null;
    },
    setSuccessMessage: (state, action) => {
      state.successMessage = action.payload;
    },
    clearMemberSearch: (state) => {
      state.members = [];
      state.memberSearchLoading = false;
    },
    clearOwnerState: (state) => {
      Object.assign(state, initialState);
    },
    setCreatedMember: (state, action) => {
      state.createdMember = action.payload;
    },
    clearCreatedMember: (state) => {
      state.createdMember = null;
    },
    clearOwnerDetails: (state) => {
      state.ownerDetails = null;
      state.ownerDetailsLoading = false;
      state.ownerDetailsError = null;
    },
    clearOwnershipHistory: (state) => {
      state.ownershipHistory = { unit: null, entries: [] };
      state.ownershipHistoryLoading = false;
      state.ownershipHistoryError = null;
    },
    setPendingMemberData: (state, action) => {
      state.pendingMemberData = action.payload;
    },
    clearPendingMemberData: (state) => {
      state.pendingMemberData = null;
    },
    setPendingCompanyData: (state, action) => {
      state.pendingCompanyData = action.payload;
    },
    clearPendingCompanyData: (state) => {
      state.pendingCompanyData = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOwner.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(createOwner.fulfilled, (state, action) => {
        state.loading = false;
        // Only set success message if one doesn't already exist
        // This prevents duplicate messages during batch operations
        if (!state.successMessage) {
          state.successMessage =
            action.payload?.message || "Owner created successfully";
        }
        
        // Dispatch custom event to trigger notification refresh
        console.log('[OwnerSlice] Owner created successfully, dispatching ownerUpdated event');
        window.dispatchEvent(new Event('ownerUpdated'));
      })

      .addCase(createOwner.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Bulk create owner cases
      .addCase(bulkCreateOwner.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(bulkCreateOwner.fulfilled, (state, action) => {
        state.loading = false;
        const created = action.payload?.created || 0;
        state.successMessage = created === 1 
          ? "Owner created successfully" 
          : `${created} owners created successfully`;
        
        // Dispatch custom event to trigger notification refresh
        console.log('[OwnerSlice] Bulk owners created successfully, dispatching ownerUpdated event');
        window.dispatchEvent(new Event('ownerUpdated'));
      })

      .addCase(bulkCreateOwner.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateOwner.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(updateOwner.fulfilled, (state, action) => {
        state.loading = false;
        // Only set success message if one doesn't already exist
        // This prevents duplicate messages during batch operations
        if (!state.successMessage) {
          state.successMessage =
            action.payload?.message || "Owner updated successfully";
        }
        if (action.payload?.data) {
          state.ownerDetails = action.payload.data;
        }
        
        // Dispatch custom event to trigger notification refresh
        console.log('[OwnerSlice] Owner updated successfully, dispatching ownerUpdated event');
        window.dispatchEvent(new Event('ownerUpdated'));
      })

      .addCase(updateOwner.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(deleteOwner.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteOwner.fulfilled, (state, action) => {
        state.loading = false;
        // Only set success message if one doesn't already exist
        // This prevents duplicate messages during batch operations
        if (!state.successMessage) {
          state.successMessage =
            action.payload?.message || "Owner deleted successfully";
        }
        
        // Dispatch custom event to trigger notification refresh
        console.log('[OwnerSlice] Owner deleted successfully, dispatching ownerUpdated event');
        window.dispatchEvent(new Event('ownerUpdated'));
      })
      .addCase(deleteOwner.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(searchMembers.pending, (state) => {
        state.memberSearchLoading = true;
        state.error = null;
      })

      .addCase(searchMembers.fulfilled, (state, action) => {
        state.memberSearchLoading = false;
        state.members = action.payload;
      })

      .addCase(searchMembers.rejected, (state, action) => {
        state.memberSearchLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchOwnerList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchOwnerList.fulfilled, (state, action) => {
        state.loading = false;
        state.ownerList = action.payload;
      })

      .addCase(fetchOwnerList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(CreatememberForUnit.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })

      .addCase(CreatememberForUnit.fulfilled, (state, action) => {
        state.loading = false;
        state.message =
          action.payload.message || "Member created successfully!";

        state.createdMember = {
          id: action.payload.member.id,
          full_name: action.payload.member.full_name
        };
      })

      .addCase(CreatememberForUnit.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to create member.";
      })

      .addCase(addExistingMemberForOwner.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })

      .addCase(addExistingMemberForOwner.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.memberContact = action.payload;
      })

      .addCase(addExistingMemberForOwner.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      })

      .addCase(fetchOwnerDetails.pending, (state) => {
        state.ownerDetailsLoading = true;
        state.ownerDetailsError = null;
        state.ownerDetails = null;
      })

      .addCase(fetchOwnerDetails.fulfilled, (state, action) => {
        state.ownerDetailsLoading = false;
        state.ownerDetails = action.payload;
      })

      .addCase(fetchOwnerDetails.rejected, (state, action) => {
        state.ownerDetailsLoading = false;
        state.ownerDetailsError = action.payload;
      })

      .addCase(fetchUnitOwnershipByMember.pending, (state) => {
        state.unitOwnershipLoading = true;
        state.unitOwnershipError = null;
      })

      .addCase(fetchUnitOwnershipByMember.fulfilled, (state, action) => {
        state.unitOwnershipLoading = false;
        state.unitOwnership = action.payload;
      })

      .addCase(fetchUnitOwnershipByMember.rejected, (state, action) => {
        state.unitOwnershipLoading = false;
        state.unitOwnershipError = action.payload;
      })

      // Unit ownership history
      .addCase(fetchUnitOwnershipHistory.pending, (state) => {
        state.ownershipHistoryLoading = true;
        state.ownershipHistoryError = null;
      })

      .addCase(fetchUnitOwnershipHistory.fulfilled, (state, action) => {
        state.ownershipHistoryLoading = false;
        state.ownershipHistory = action.payload;
      })

      .addCase(fetchUnitOwnershipHistory.rejected, (state, action) => {
        state.ownershipHistoryLoading = false;
        state.ownershipHistoryError = action.payload;
      });
  }
});

export const {
  clearMessage,
  setSuccessMessage,
  clearMemberSearch,
  clearOwnerState,
  setCreatedMember,
  clearCreatedMember,
  clearOwnerDetails,
  clearOwnershipHistory,
  setPendingMemberData,
  clearPendingMemberData,
  setPendingCompanyData,
  clearPendingCompanyData
} = ownerSlice.actions;

export default ownerSlice.reducer;
