import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Initial State
const initialState = {
  towers: [],
  singleTower: null,
  lastTowerNumber: null,
  successMessage: null,
  error: null,
  loading: false,
};

// Fetch all towers
export const fetchTowers = createAsyncThunk("towers/fetchTowers", async (_, thunkAPI) => {
  try {
    const { data } = await axiosInstance.get("/towers/tower_list/");
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message || "Failed to fetch towers.");
  }
});


export const fetchTowerById = createAsyncThunk("towers/fetchTowerById", async (towerId, thunkAPI) => {
  try {
    const { data } = await axiosInstance.get(`/towers/tower_details/${towerId}/`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      return thunkAPI.rejectWithValue("Tower not found.");
    }
    return thunkAPI.rejectWithValue(error.response?.data?.message || "Failed to fetch tower details.");
  }
});


// Get last tower number
export const getLastTowerNumber = createAsyncThunk("towers/getLastTowerNumber", async (_, thunkAPI) => {
  try {
    const { data } = await axiosInstance.get("/towers/get_last_tower_number/");
    return data.lastTowerNumber ?? 1;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message || "Failed to fetch last tower number.");
  }
});

// Create a new tower
export const createTower = createAsyncThunk("towers/createTower", async (formData, thunkAPI) => {
  try {
    await axiosInstance.post("/towers/create_tower/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return "Tower created successfully.";
  } catch (error) {
    // Handle validation errors from DRF
    if (error.response?.data?.tower_name) {
      return thunkAPI.rejectWithValue(error.response.data.tower_name[0]);
    }
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message || "Failed to create tower.");
  }
});

// Update an existing tower
export const updateTower = createAsyncThunk(
  "towers/updateTower",
  async ({ id, formData }, thunkAPI) => {
    try {
      await axiosInstance.put(`/towers/update_tower/${id}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return "Updated successfully";
    } catch (error) {
      if (error.response?.status === 404) {
        return thunkAPI.rejectWithValue("This tower has been deleted.");
      }
      // Handle validation errors from DRF
      if (error.response?.data?.tower_name) {
        return thunkAPI.rejectWithValue(error.response.data.tower_name[0]);
      }
      return thunkAPI.rejectWithValue(error.response?.data || "Failed to update tower.");
    }
  }
);

// Delete a tower
export const deleteTower = createAsyncThunk("towers/deleteTower", async (towerId, thunkAPI) => {
  try {
    await axiosInstance.delete(`/towers/delete_tower/${towerId}/`);
    return towerId; // Returning the deleted tower ID to update state
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || error.message || "Failed to delete tower.");
  }
});

// Create Slice
const towerSlice = createSlice({
  name: "towers",
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
    resetTowers: (state) => {
      state.towers = [];
      state.singleTower = null;
      state.lastTowerNumber = null;
      state.successMessage = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Towers
      .addCase(fetchTowers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTowers.fulfilled, (state, action) => {
        state.loading = false;
        state.towers = action.payload;
      })
      .addCase(fetchTowers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Single Tower
      .addCase(fetchTowerById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTowerById.fulfilled, (state, action) => {
        state.loading = false;
        state.singleTower = action.payload;
      })
      .addCase(fetchTowerById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Last Tower Number
      .addCase(getLastTowerNumber.fulfilled, (state, action) => {
        state.lastTowerNumber = action.payload;
      })

      // Create Tower
      .addCase(createTower.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTower.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload;
      })
      .addCase(createTower.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Tower
      .addCase(updateTower.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTower.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload;
      })
      .addCase(updateTower.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Tower
      .addCase(deleteTower.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTower.fulfilled, (state, action) => {
        state.loading = false;
        state.towers = state.towers.filter((tower) => tower.id !== action.payload);
        state.successMessage = "Tower deleted successfully.";
      })
      .addCase(deleteTower.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetTowers, clearMessages } = towerSlice.actions;
export default towerSlice.reducer;
