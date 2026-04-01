import { createSlice } from "@reduxjs/toolkit";
import {
  createMember,
  fetchMembers,
  fetchMemberById,
  fetchMemberTypes,
  memberUpdate,
  changeOrgMemberStatus,
  fetchHeadingData,
  fetchAddExistingMembers,
  fetchUnitContacts,
} from "./api/memberApi";

const initialState = {
  members: [],
  selectedMember: null,
  memberTypes: [],
  loading: false,
  error: null,
  message: null,
  activeTabs: 1,

  createdMember: null,
  headingData: {
    full_name: "Member Name",
    roles: ["Member Role"],
    id: "N/A",
    photo_low_quality: "/admin.jpg",
  },
};

const memberSlice = createSlice({
  name: "member",
  initialState,
  reducers: {
    setMessage(state, action) {
      state.message = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    clearMessage(state) {
      state.message = null;
      state.error = null;
    },
    setSelectedMember: (state, action) => {
      state.selectedMember = action.payload;
    },
    setActiveTabs(state, action) {
      state.activeTabs = action.payload;
    },
    // New reducer to clear the createdMember state after using it.
    clearCreatedMember(state) {
      state.createdMember = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch All Members
      .addCase(fetchMembers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMembers.fulfilled, (state, action) => {
        state.loading = false;
        state.members = action.payload;
      })
      .addCase(fetchMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Member Types
      .addCase(fetchMemberTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemberTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.memberTypes = action.payload;
      })
      .addCase(fetchMemberTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Member by ID
      .addCase(fetchMemberById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemberById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedMember = action.payload;
      })
      .addCase(fetchMemberById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create Member (old endpoint)
      .addCase(createMember.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(createMember.fulfilled, (state, action) => {
        state.loading = false;
        state.message = "Member created successfully!";
      })
      .addCase(createMember.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to create member.";
      })
     
      // Update Member (memberUpdate)
      .addCase(memberUpdate.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(memberUpdate.fulfilled, (state, action) => {
        state.loading = false;
        state.message = "Member updated successfully!";
        state.selectedMember = action.payload;
      })
      .addCase(memberUpdate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.Error || "Failed to update member.";
      })

      // Change Member Status
      .addCase(changeOrgMemberStatus.pending, (state) => {
        state.statusLoading = true;
      })
      .addCase(changeOrgMemberStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        if (state.selectedMember?.id === action.payload.id) {
          state.selectedMember.is_org_member = action.payload.is_org_member;
        }
      })
      .addCase(changeOrgMemberStatus.rejected, (state, action) => {
        state.statusLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchHeadingData.fulfilled, (state, action) => {
        state.headingData = action.payload;
      })
         // Fetch All Members
         .addCase(fetchAddExistingMembers.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(fetchAddExistingMembers.fulfilled, (state, action) => {
          state.loading = false;
          state.AddExistingCommMember = action.payload;
        })
        .addCase(fetchAddExistingMembers.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
        // Optimized unit contact list endpoint
        .addCase(fetchUnitContacts.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(fetchUnitContacts.fulfilled, (state, action) => {
          state.loading = false;
          state.AddExistingCommMember = action.payload;
        })
        .addCase(fetchUnitContacts.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
  }
});

export const { setMessage, setError, clearMessage, setSelectedMember, setActiveTabs, clearCreatedMember } = memberSlice.actions;

export default memberSlice.reducer;
