import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchCompanySettings,
  fetchCompanySettingsPublic,
  updateCompanySettings,
  fetchCompanyImages,
  uploadCompanyImage,
  updateCompanyImage,
  deleteCompanyImage,
  setActiveImage,
} from "../../../api/companySettingsApi";

// Async thunks
export const getCompanySettings = createAsyncThunk(
  "companySettings/getSettings",
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchCompanySettings();
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const getCompanySettingsPublic = createAsyncThunk(
  "companySettings/getSettingsPublic",
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchCompanySettingsPublic();
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateSettings = createAsyncThunk(
  "companySettings/updateSettings",
  async (formData, { rejectWithValue }) => {
    try {
      const data = await updateCompanySettings(formData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const getCompanyImages = createAsyncThunk(
  "companySettings/getImages",
  async (imageType, { rejectWithValue }) => {
    try {
      const data = await fetchCompanyImages(imageType);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const uploadImage = createAsyncThunk(
  "companySettings/uploadImage",
  async (formData, { rejectWithValue }) => {
    try {
      const data = await uploadCompanyImage(formData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateImage = createAsyncThunk(
  "companySettings/updateImage",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const data = await updateCompanyImage(id, formData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const removeImage = createAsyncThunk(
  "companySettings/removeImage",
  async (id, { rejectWithValue }) => {
    try {
      await deleteCompanyImage(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const setImageActive = createAsyncThunk(
  "companySettings/setImageActive",
  async (id, { rejectWithValue }) => {
    try {
      const data = await setActiveImage(id);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const initialState = {
  settings: null,
  publicSettings: null,
  images: [],
  isLoading: false,
  isUpdating: false,
  isUploading: false,
  isDeleting: false,
  error: null,
};

const companySettingsSlice = createSlice({
  name: "companySettings",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSettings: (state) => {
      state.settings = null;
      state.publicSettings = null;
    },
  },
  extraReducers: (builder) => {
    // Get settings (authenticated)
    builder
      .addCase(getCompanySettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCompanySettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
        state.error = null;
      })
      .addCase(getCompanySettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Get settings (public)
    builder
      .addCase(getCompanySettingsPublic.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCompanySettingsPublic.fulfilled, (state, action) => {
        state.isLoading = false;
        state.publicSettings = action.payload;
        state.error = null;
      })
      .addCase(getCompanySettingsPublic.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Update settings
    builder
      .addCase(updateSettings.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.isUpdating = false;
        state.settings = action.payload;
        state.publicSettings = action.payload; // Update public settings too
        state.error = null;
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    // Get images
    builder
      .addCase(getCompanyImages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCompanyImages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.images = action.payload;
        state.error = null;
      })
      .addCase(getCompanyImages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Upload image
    builder
      .addCase(uploadImage.pending, (state) => {
        state.isUploading = true;
        state.error = null;
      })
      .addCase(uploadImage.fulfilled, (state, action) => {
        state.isUploading = false;
        state.images = [action.payload, ...state.images];
        state.error = null;
      })
      .addCase(uploadImage.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload;
      });

    // Update image
    builder
      .addCase(updateImage.pending, (state) => {
        state.isUploading = true;
        state.error = null;
      })
      .addCase(updateImage.fulfilled, (state, action) => {
        state.isUploading = false;
        const index = state.images.findIndex(img => img.id === action.payload.id);
        if (index !== -1) {
          state.images[index] = action.payload;
        }
        state.error = null;
      })
      .addCase(updateImage.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload;
      });

    // Delete image
    builder
      .addCase(removeImage.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(removeImage.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.images = state.images.filter(img => img.id !== action.payload);
        state.error = null;
      })
      .addCase(removeImage.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });

    // Set image active
    builder
      .addCase(setImageActive.fulfilled, (state, action) => {
        // Update the is_active flag for all images
        state.images = state.images.map(img => ({
          ...img,
          is_active: img.id === action.payload.id
        }));
        // Also update settings
        if (action.payload.image_type === 'logo') {
          state.settings = { ...state.settings, logo_url: action.payload.image_url };
          state.publicSettings = { ...state.publicSettings, logo_url: action.payload.image_url };
        } else if (action.payload.image_type === 'login_image') {
          state.settings = { ...state.settings, login_page_image_url: action.payload.image_url };
          state.publicSettings = { ...state.publicSettings, login_page_image_url: action.payload.image_url };
        }
      });
  },
});

export const { clearError, clearSettings } = companySettingsSlice.actions;
export default companySettingsSlice.reducer;

