

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// ── Async Thunks ────────────────────────────────────────────────────────────────

// Fetch all vehicles
// export const fetchAllVehicles = createAsyncThunk(
//   "vehicle/fetchAllVehicles",
//   async (_, { rejectWithValue }) => {
//     try {
//       const res = await axiosInstance.get("/towers/vehicles/");
//       return res.data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data || "Failed to fetch vehicles");
//     }
//   }
// );

export const fetchAllVehicles = createAsyncThunk(
  "vehicle/fetchAllVehicles",
  async (filters = {}, { rejectWithValue }) => {
    try {
     const params = new URLSearchParams();
if (filters.tower) params.append('tower', filters.tower); // filters.tower = "mm1,mm2"
if (filters.unit) params.append('unit', filters.unit); // filters.unit = "u1,u2"
      if (filters.status) params.append('status', filters.status);
      if (filters.numberplate) params.append('numberplate', filters.numberplate);

      const url = `/towers/vehicles/?${params.toString()}`;
      const res = await axiosInstance.get(url);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || "Failed to fetch vehicles");
    }
  }
);


// Fetch vehicles by unit
export const fetchVehiclesByUnit = createAsyncThunk(
  "vehicle/fetchVehiclesByUnit",
  async (unitId, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get(`/towers/vehicles/unit/${unitId}/`);
      console.log("fetchVehiclesByUnit API response:", res.data);  
      return res.data.data;  
    } catch (err) {
      console.error("fetchVehiclesByUnit error:", err);
      return rejectWithValue(err.response?.data || "Failed to fetch vehicles by unit");
    }
  }
);


// Create a new vehicle
export const createVehicle = createAsyncThunk(
  "vehicle/createVehicle",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post("/towers/vehicles/create/", formData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.errors || "Failed to create vehicle");
    }
  }
);

// Update an existing vehicle
export const updateVehicle = createAsyncThunk(
  "vehicle/updateVehicle",
  async ({ vehicleId, formData }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.put(
        `/towers/vehicles/update/${vehicleId}/`,
        formData
      );
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.errors || "Failed to update vehicle");
    }
  }
);

// Delete a vehicle
export const deleteVehicle = createAsyncThunk(
  "vehicle/deleteVehicle",
  async (vehicleId, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/towers/vehicles/delete/${vehicleId}/`);
      return vehicleId;
    } catch (err) {
      return rejectWithValue("Failed to delete vehicle");
    }
  }
);

// vehicleSlice.js
export const toggleVehicleStatus = createAsyncThunk(
  "vehicle/toggleStatus",
  async (vehicleId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(`/towers/vehicles/${vehicleId}/toggle-status/`);
      return { vehicleId, status: response.data.status };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to toggle status.");
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────────────

const vehicleSlice = createSlice({
  name: "vehicle",
  initialState: {
    vehiclesList: [],    // all vehicles
    unitVehicles: [],    // vehicles by unit
    loading: false,
    error: null,
    successMessage: null,
  },
  reducers: {
    resetVehicleState(state) {
      state.vehiclesList = [];
      state.unitVehicles = [];
      state.loading = false;
      state.error = null;
      state.successMessage = null;
    },
    clearVehicleMessages(state) {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch All
      .addCase(fetchAllVehicles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllVehicles.fulfilled, (state, action) => {
          console.log("Reducer fetchVehiclesByUnit.fulfilled, payload:", action.payload);

        state.loading = false;
        state.vehiclesList = action.payload;
      })
      .addCase(fetchAllVehicles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch By Unit
      .addCase(fetchVehiclesByUnit.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVehiclesByUnit.fulfilled, (state, action) => {
        state.loading = false;
        state.unitVehicles = action.payload;
      })
      .addCase(fetchVehiclesByUnit.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create
      .addCase(createVehicle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createVehicle.fulfilled, (state, action) => {
        state.loading = false;
        state.vehiclesList.push(action.payload);
        state.successMessage = "Vehicle created successfully.";
      })
      .addCase(createVehicle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update
      .addCase(updateVehicle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // .addCase(updateVehicle.fulfilled, (state, action) => {
      //   state.loading = false;
      //   const updated = action.payload;
      //   state.vehiclesList = state.vehiclesList.map((v) =>
      //     v.id === updated.id ? updated : v
      //   );
      //   state.successMessage = "Vehicle updated successfully.";
      // })
      .addCase(updateVehicle.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        state.vehiclesList = state.vehiclesList.map((v) =>
          v.id === updated.id ? updated : v
        );
        state.unitVehicles = state.unitVehicles.map((v) =>
          v.id === updated.id ? updated : v
        );
        state.successMessage = "Vehicle updated successfully.";
      })

      .addCase(updateVehicle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete
      .addCase(deleteVehicle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteVehicle.fulfilled, (state, action) => {
        state.loading = false;
        state.vehiclesList = state.vehiclesList.filter(
          (v) => v.id !== action.payload
        );
        state.successMessage = "Vehicle deleted successfully.";
      })
      .addCase(deleteVehicle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

  
    .addCase(toggleVehicleStatus.fulfilled, (state, action) => {
  const { vehicleId, status } = action.payload;

  // Update in vehiclesList
  state.vehiclesList = state.vehiclesList.map((v) =>
    v.id === vehicleId ? { ...v, status } : v
  );

  // Also update in unitVehicles
  state.unitVehicles = state.unitVehicles.map((v) =>
    v.id === vehicleId ? { ...v, status } : v
  );

  // No success message
})


    .addCase(toggleVehicleStatus.rejected, (state, action) => {
      state.error = action.payload;
    });


  },
});

export const { resetVehicleState, clearVehicleMessages } = vehicleSlice.actions;
export default vehicleSlice.reducer;
