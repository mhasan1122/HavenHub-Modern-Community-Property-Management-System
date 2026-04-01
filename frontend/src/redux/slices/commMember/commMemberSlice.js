import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// fetch thunk now handles `search` (single string) as well as your array filters
export const fetchCommMembers = createAsyncThunk(
  "commMember/fetchAll",
  async (rawParams = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      // array filters
      ["type", "tower", "unit", "status"].forEach((key) => {
        if (rawParams[key]) {
          if (Array.isArray(rawParams[key])) {
            rawParams[key].forEach((v) => {
              // Extract value from object or use string directly
              const value = typeof v === "object" ? v.value : v;
              params.append(key, value);
            });
          } else {
            // Handle single value (object or string)
            const value = typeof rawParams[key] === "object" ? rawParams[key].value : rawParams[key];
            params.append(key, value);
          }
        }
      });

      // **NEW**: single‐value search
      if (rawParams.search && rawParams.search.length >= 3) {
        params.append("search", rawParams.search);
      }

      const { data } = await axiosInstance.get("/towers/commMemberList/", {
        params
      });

      // Handle both old and new response formats
      const memberData = data.data || data;

      // flatten the three lists into one uniform array
      const ownerList = (memberData.owners || []).map((o) => ({
        id: o.id,
        type: "owner",
        full_name: o.member.full_name,
        general_contact: o.member.general_contact,
        general_email: o.member.general_email,
        occupation: o.member.occupation || "-",
        tower: o.tower_name,
        unit: o.unit_name,
        status: o.member.is_comm_member ? "Active" : "Inactive",
        photo: o.member.photo_low_quality
      }));
      const residentList = (memberData.resident_members || []).map((r) => ({
        id: r.id,
        // Handle both boolean and integer values: false/0 = tenant, true/1 = resident
        type: !r.is_resident_or_tenant ? "resident_tenant" : "resident",
        full_name: r.resident_member.full_name,
        general_contact: r.resident_member.general_contact,
        general_email: r.resident_member.general_email,
        occupation: r.resident_member.occupation || "-",
        tower: r.tower_name,
        unit: r.unit_name,
        status: r.resident_member.is_comm_member ? "Active" : "Inactive",
        photo: r.resident_member.photo_low_quality
      }));
      const staffList = (memberData.unit_staff || []).map((s) => ({
        id: s.id,
        type: "staff",
        full_name: s.member.full_name,
        general_contact: s.member.general_contact,
        general_email: s.member.general_email,
        occupation: s.member.occupation || "-",
        tower: s.tower_name,
        unit: s.unit_name,
        status: s.member.is_comm_member ? "Active" : "Inactive",
        photo: s.member.photo_low_quality
      }));
      return [...ownerList, ...residentList, ...staffList];
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const commMemberSlice = createSlice({
  name: "commMember",
  initialState: { items: [], loading: false, error: null, lastParams: {} },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCommMembers.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.lastParams = action.meta.arg;
      })
      .addCase(fetchCommMembers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCommMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export default commMemberSlice.reducer;
