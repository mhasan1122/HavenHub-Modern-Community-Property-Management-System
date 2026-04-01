import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Async action to create a tower
export const createTower = createAsyncThunk(
  "towers/createTower",
  async (towerData, { rejectWithValue }) => {
    try {
      // Get the access token from localStorage
      const token = localStorage.getItem("access_token");

      const response = await fetch("http://127.0.0.1:8000/towers/create_tower/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "", // Ensure token is included
        },
        body: JSON.stringify(towerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData); // Properly reject with API error
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message || "Unable to create the tower. Please try again.");
    }
  }
);

// Async thunk to fetch the count of towers
export const getTowerCount = createAsyncThunk(
  "towers/getTowerCount",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/towers/count_tower/");

      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData);
      }

      const data = await response.json();
      return data.count; // Extracting count from response
    } catch (error) {
      return rejectWithValue(error.message || "Error fetching tower count");
    }
  }
);

const towerSlice = createSlice({
  name: "towers",
  initialState: {
    towers: [],
    towerCount: 0, // Store tower count
    loading: false,
    error: null,
    successMessage: null,
  },
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle Create Tower
      .addCase(createTower.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(createTower.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message || "Tower created successfully!";
      })
      .addCase(createTower.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to create tower.";
      })

      // Handle Get Tower Count
      .addCase(getTowerCount.pending, (state) => {
        state.loading = true;
      })
      .addCase(getTowerCount.fulfilled, (state, action) => {
        state.loading = false;
        state.towerCount = action.payload; // Store tower count
      })
      .addCase(getTowerCount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch tower count.";
      });
  },
});

export const { clearMessages } = towerSlice.actions;
export default towerSlice.reducer;
