import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Initial state
const initialState = {
  selectedUnitDetails: null,
  selectedUnit: null,
  updateUnit: null,
  memberContact:null,
  status: "idle",
  error: null
};

// Fetch unit by ID
export const fetchUnitById = createAsyncThunk(
  "unit/fetchById",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/towers/units_side_details/${id}/`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data || "Error fetching unit side details";
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Fetch unit details
export const unitDetails = createAsyncThunk(
  "unit/details",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/towers/unit_details/${id}/`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data || "Error fetching unit details";
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Update unit
export const unitUpdate = createAsyncThunk(
  "unit/update",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await axiosInstance.put(`/towers/update_unit/${id}/`, data);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data || "Error updating unit";
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);


// Async thunk to call the Django API endpoint
// export const addExistingContact = createAsyncThunk(
//   'contacts/addExistingContact',
//   async (data, { rejectWithValue }) => {
//     try {
//       const response = await axiosInstance.get('/towers/add_existing_contact/', data);
//       console.log('response.data', response.data);
//       return response.data;
//     } catch (error) {
//       return rejectWithValue(error.response.data || 'Something went wrong');
//     }
//   }
// );

export const addExistingContact = createAsyncThunk(
  'contacts/addExistingContact',
  async (id, thunkAPI) => {
    // console.log('🔍 Sending request to:', `${axiosInstance}/towers/add_existing_contact/${id}/`);

    try {
      const response = await axiosInstance.get(`/towers/add_existing_contact/${id}/`, {});

      console.log('response.....data', response.data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || 'Something went wrong');
    }
  }
);


// Create the slice
const unitSlice = createSlice({
  name: "unit",
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnitById.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchUnitById.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.selectedUnit = action.payload;
      })
      .addCase(fetchUnitById.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || action.error.message;
      })


      .addCase(unitUpdate.pending, (state) => {
        state.status = "loading";
      })
      .addCase(unitUpdate.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.updateUnit = action.payload;
      })
      .addCase(unitUpdate.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || action.error.message;
      })


      .addCase(unitDetails.pending, (state) => {
        state.status = "loading";
      })
      .addCase(unitDetails.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.selectedUnitDetails = action.payload;
      })
      .addCase(unitDetails.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || action.error.message;
      })


      .addCase(addExistingContact.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(addExistingContact.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.memberContact = action.payload;
      })
      .addCase(addExistingContact.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      });
  }
});

// Reducer
export default unitSlice.reducer;
