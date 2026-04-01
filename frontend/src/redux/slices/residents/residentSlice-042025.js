import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../../utils/axiosInstance';

// 1) Create a new resident
export const createResident = createAsyncThunk(
  'resident/createResident',
  async (residentData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/towers/create_resident/', residentData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);
export const updateResident = createAsyncThunk(
  'resident/updateResident',
  async ({ residentId, formData }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/towers/resident_info_edit/${residentId}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// 2) Fetch existing members
export const fetchExistingMembers = createAsyncThunk(
  'resident/fetchExistingMembers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/towers/list_members/');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);
export const fetchAddExistingMembers = createAsyncThunk(
  'resident/fetchAddExistingMembers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/towers/add_existing_member/');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// 3) Fetch a single member’s details
export const fetchMemberDetails = createAsyncThunk(
  'resident/fetchMemberDetails',
  async (memberId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/user/get_member_details/${memberId}/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// 4) Fetch residents list for a particular unit
export const fetchResidents = createAsyncThunk(
  'resident/fetchResidents',
  async (unitId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/towers/residents_list/${unitId}/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// NEW: 5) Fetch details for a specific resident based on unit id and resident id
export const fetchResidentDetails = createAsyncThunk(
  'resident/fetchResidentDetails',
  async ({ unitId, residentId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/towers/resident_details/${unitId}/${residentId}/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

export const inactivateResidents = createAsyncThunk(
  'resident/inactivateResidents',
  async (residentIds, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/towers/inactivate_residents/', { resident_ids: residentIds });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

const residentSlice = createSlice({
  name: 'resident',
  initialState: {
    loading: false,
    error: null,
    success: false,
    data: null,

    members: [],
    loadingMembers: false,
    errorMembers: null,

    selectedMember: null,
    loadingMemberDetails: false,
    errorMemberDetails: null,

    residents: [],
    loadingResidentsList: false,
    errorResidentsList: null,

    updatingResident: false,
    updateSuccess: false,
    updateError: null,

    // NEW: State to hold the details of a specific resident
    residentDetails: null,
    loadingResidentDetails: false,
    errorResidentDetails: null,

    // New state for deletion/inactivation
    loadingInactivate: false,
    errorInactivate: null,
    successInactivate: false,
  },
  reducers: {
    resetResidentState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;

      state.selectedMember = null;
      state.loadingMemberDetails = false;
      state.errorMemberDetails = null;

      state.residents = [];
      state.loadingResidentsList = false;
      state.errorResidentsList = null;

      // Reset the resident details fields too.
      state.residentDetails = null;
      state.loadingResidentDetails = false;
      state.errorResidentDetails = null;
    },
    // New reducer to reset the inactivation success flag.
    resetInactivateSuccess: (state) => {
      state.successInactivate = false;
    }
  },
  extraReducers: (builder) => {
    // createResident
    builder
      .addCase(createResident.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createResident.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(createResident.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // fetchExistingMembers
     // fetchExistingMembers (for Add Resident flow)
     builder
     .addCase(fetchExistingMembers.pending, (state) => {
       state.loadingMembers = true;
       state.errorMembers = null;
     })
     .addCase(fetchExistingMembers.fulfilled, (state, action) => {
       state.loadingMembers = false;
       // Map owners: force member_type_name as "owner"
       const owners = (action.payload.owners || []).map(ownerItem => {
         const m = ownerItem.member;
         return {
           ...m,
           unit_name: ownerItem.unit_name,
           floor_no: ownerItem.floor_no,
           tower_name: ownerItem.tower_name,
           member_type: m.member_type_edit.id,
           member_type_name: "owner",
         };
       });
       const ownerIds = new Set(owners.map(o => o.id));
       // Map organization members
       const orgMembers = (action.payload.org_members || [])
         .filter(m => !ownerIds.has(m.id))
         .map(m => ({
           ...m,
           member_type: m.member_type_edit.id,
           member_type_name: m.member_type_edit.member_type_name,
         }));
       state.members = [...owners, ...orgMembers];
     })
     .addCase(fetchExistingMembers.rejected, (state, action) => {
       state.loadingMembers = false;
       state.errorMembers = action.payload;
     });

   // NEW: fetchAddExistingMembers (for Add Member Form usage)
   builder
     .addCase(fetchAddExistingMembers.pending, (state) => {
       state.loadingMembers = true;
       state.errorMembers = null;
     })
     .addCase(fetchAddExistingMembers.fulfilled, (state, action) => {
       state.loadingMembers = false;
       // Map owners exactly as before.
       const owners = (action.payload.owners || []).map(ownerItem => {
         const m = ownerItem.member;
         return {
           ...m,
           unit_name: ownerItem.unit_name,
           floor_no: ownerItem.floor_no,
           tower_name: ownerItem.tower_name,
           member_type: m.member_type_edit.id,
           member_type_name: "owner",
         };
       });
       // Map organization members as provided.
       const orgMembers = (action.payload.org_members || []).map(m => ({
         ...m,
         member_type: m.member_type_edit.id,
         member_type_name: m.member_type_edit.member_type_name,
       }));
       // Map resident members and force their member type to "resident".
       const residentMembers = (action.payload.resident_members || []).map(item => {
         const m = item.resident_member;
         return {
           ...m,
           unit_name: item.unit_name,
           floor_no: item.floor_no,
           tower_name: item.tower_name,
           member_type: m.member_type_edit.id,
           member_type_name: "resident",
         };
       });
       state.members = [...owners, ...orgMembers, ...residentMembers];
     })
     .addCase(fetchAddExistingMembers.rejected, (state, action) => {
       state.loadingMembers = false;
       state.errorMembers = action.payload;
     });
      builder
      // Cases for updating resident
      .addCase(updateResident.pending, (state) => {
        state.updatingResident = true;
        state.updateError = null;
        state.updateSuccess = false;
      })
      .addCase(updateResident.fulfilled, (state, action) => {
        state.updatingResident = false;
        state.updateSuccess = true;
        // Optionally update the residentDetails in state with fresh data.
        state.residentDetails = action.payload;
      })
      .addCase(updateResident.rejected, (state, action) => {
        state.updatingResident = false;
        state.updateError = action.payload;
      });

    // fetchMemberDetails
    builder
      .addCase(fetchMemberDetails.pending, (state) => {
        state.loadingMemberDetails = true;
        state.errorMemberDetails = null;
        state.selectedMember = null;
      })
      .addCase(fetchMemberDetails.fulfilled, (state, action) => {
        state.loadingMemberDetails = false;
        state.selectedMember = action.payload;
      })
      .addCase(fetchMemberDetails.rejected, (state, action) => {
        state.loadingMemberDetails = false;
        state.errorMemberDetails = action.payload;
      });

    // fetchResidents
    builder
      .addCase(fetchResidents.pending, (state) => {
        state.loadingResidentsList = true;
        state.errorResidentsList = null;
      })
      .addCase(fetchResidents.fulfilled, (state, action) => {
        state.loadingResidentsList = false;
        // Store the full payload (residents list)
        state.residents = action.payload;
      })
      .addCase(fetchResidents.rejected, (state, action) => {
        state.loadingResidentsList = false;
        state.errorResidentsList = action.payload;
      });

    // NEW: fetchResidentDetails
    builder
      .addCase(fetchResidentDetails.pending, (state) => {
        state.loadingResidentDetails = true;
        state.errorResidentDetails = null;
        state.residentDetails = null;
      })
      .addCase(fetchResidentDetails.fulfilled, (state, action) => {
        state.loadingResidentDetails = false;
        state.residentDetails = action.payload;
      })
      .addCase(fetchResidentDetails.rejected, (state, action) => {
        state.loadingResidentDetails = false;
        state.errorResidentDetails = action.payload;
      });

    // inactivateResidents
    builder
      .addCase(inactivateResidents.pending, (state) => {
        state.loadingInactivate = true;
        state.errorInactivate = null;
        state.successInactivate = false;
      })
      .addCase(inactivateResidents.fulfilled, (state, action) => {
        state.loadingInactivate = false;
        state.successInactivate = true;
        // Optionally, update state.residents by marking inactivated residents as inactive.
        if (state.residents && state.residents.length > 0) {
          state.residents = state.residents.map(resident =>
            action.meta.arg.includes(resident.id)
              ? { ...resident, is_active: false }
              : resident
          );
        }
      })
      .addCase(inactivateResidents.rejected, (state, action) => {
        state.loadingInactivate = false;
        state.errorInactivate = action.payload;
        state.successInactivate = false;
      });
  },
});

export const { resetResidentState, resetInactivateSuccess } = residentSlice.actions;
export default residentSlice.reducer;
