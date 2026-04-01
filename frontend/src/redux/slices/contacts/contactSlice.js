import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
  createImportantContact,
  deleteImportantContactRequest,
  fetchImportantContacts,
  updateImportantContactRequest,
} from "../../../api/contactsApi";

const initialState = {
  items: [],
  isLoading: false,
  error: null,
  createStatus: "idle",
  createError: null,
  lastCreated: null,
  lastUpdated: null,
  lastDeletedId: null,
  lastMessage: null,
  updateStatus: "idle",
  updateError: null,
  deleteStatus: "idle",
  deleteError: null,
};

const sanitizeErrorMessage = (value) => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeErrorMessage(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return sanitizeErrorMessage(Object.values(value));
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  if (
    stringValue.startsWith("<!DOCTYPE") ||
    stringValue.startsWith("<html") ||
    /<[a-z][\s\S]*>/i.test(stringValue)
  ) {
    return "Something went wrong. Please try again.";
  }

  return stringValue;
};

const normalizeError = (error) => {
  const sources = [
    error?.response?.data?.message,
    error?.response?.data?.detail,
    error?.response?.data,
    error?.message,
  ];

  for (const source of sources) {
    const sanitized = sanitizeErrorMessage(source);
    if (sanitized) {
      return sanitized;
    }
  }

  return "Something went wrong. Please try again.";
};

export const loadImportantContacts = createAsyncThunk(
  "contacts/loadImportantContacts",
  async (_, thunkAPI) => {
    try {
      return await fetchImportantContacts();
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  }
);

export const addImportantContact = createAsyncThunk(
  "contacts/addImportantContact",
  async (payload, thunkAPI) => {
    try {
      return await createImportantContact(payload);
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  }
);

export const updateImportantContact = createAsyncThunk(
  "contacts/updateImportantContact",
  async ({ contactId, payload }, thunkAPI) => {
    try {
      return await updateImportantContactRequest(contactId, payload);
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  }
);

export const deleteImportantContact = createAsyncThunk(
  "contacts/deleteImportantContact",
  async (contactId, thunkAPI) => {
    try {
      return await deleteImportantContactRequest(contactId);
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  }
);

const resetMutationStateReducer = (state) => {
  state.createStatus = "idle";
  state.createError = null;
  state.updateStatus = "idle";
  state.updateError = null;
  state.deleteStatus = "idle";
  state.deleteError = null;
  state.lastCreated = null;
  state.lastUpdated = null;
  state.lastDeletedId = null;
  state.lastMessage = null;
};

const contactSlice = createSlice({
  name: "contacts",
  initialState,
  reducers: {
    resetCreateState: resetMutationStateReducer,
    resetContactsMutationState: resetMutationStateReducer,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadImportantContacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadImportantContacts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(loadImportantContacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(addImportantContact.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
        state.lastCreated = null;
        state.lastMessage = null;
      })
      .addCase(addImportantContact.fulfilled, (state, action) => {
        state.createStatus = "succeeded";
        state.createError = null;
        const contact = action.payload?.contact;
        if (contact) {
          state.items = [contact, ...state.items];
          state.lastCreated = contact;
        }
        state.lastMessage =
          action.payload?.message || "Contact added successfully.";
      })
      .addCase(addImportantContact.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.payload || action.error.message;
      })
      .addCase(updateImportantContact.pending, (state) => {
        state.updateStatus = "loading";
        state.updateError = null;
        state.lastUpdated = null;
        state.lastMessage = null;
      })
      .addCase(updateImportantContact.fulfilled, (state, action) => {
        state.updateStatus = "succeeded";
        state.updateError = null;
        const updatedContact =
          action.payload?.contact || action.payload?.data || action.payload;
        if (updatedContact?.id) {
          state.items = state.items.map((item) =>
            item.id === updatedContact.id ? { ...item, ...updatedContact } : item
          );
          state.lastUpdated = updatedContact;
        }
        state.lastMessage =
          action.payload?.message || "Contact updated successfully.";
      })
      .addCase(updateImportantContact.rejected, (state, action) => {
        state.updateStatus = "failed";
        state.updateError = action.payload || action.error.message;
      })
      .addCase(deleteImportantContact.pending, (state) => {
        state.deleteStatus = "loading";
        state.deleteError = null;
        state.lastDeletedId = null;
        state.lastMessage = null;
      })
      .addCase(deleteImportantContact.fulfilled, (state, action) => {
        state.deleteStatus = "succeeded";
        state.deleteError = null;
        const deletedId = action.meta.arg;
        state.items = state.items.filter((item) => item.id !== deletedId);
        state.lastDeletedId = deletedId;
        state.lastMessage =
          action.payload?.message || "Contact deleted successfully.";
      })
      .addCase(deleteImportantContact.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.deleteError = action.payload || action.error.message;
      });
  },
});

export const { resetCreateState, resetContactsMutationState } = contactSlice.actions;

export default contactSlice.reducer;

