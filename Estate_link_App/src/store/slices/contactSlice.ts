import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ContactService } from '../../services/contactService';
import { 
  Contact, 
  CreateContactData, 
  UpdateContactData,
  ContactState
} from '../../types/contact';
import { logout } from './authSlice';

const initialState: ContactState = {
  contacts: [],
  loading: false,
  error: null,
  selectedContact: null,
  hasLoadedOnce: false,
};

// Helper function to get token from store state
const getTokenFromState = (getState: () => any): string | undefined => {
  const state = getState();
  return state.auth?.accessToken || undefined;
};

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await ContactService.getContacts(token);
    return response;
  }
);

export const fetchContactById = createAsyncThunk(
  'contacts/fetchContactById',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await ContactService.getContact(id, token);
    return response;
  }
);

export const createContact = createAsyncThunk(
  'contacts/createContact',
  async (data: CreateContactData, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await ContactService.createContact(data, token);
    return response;
  }
);

export const updateContact = createAsyncThunk(
  'contacts/updateContact',
  async ({ id, data }: { id: number; data: UpdateContactData }, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await ContactService.updateContact(id, data, token);
    return response;
  }
);

export const deleteContact = createAsyncThunk(
  'contacts/deleteContact',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    await ContactService.deleteContact(id, token);
    return id;
  }
);

// Slice
const contactSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setSelectedContact: (state, action: PayloadAction<Contact | null>) => {
      state.selectedContact = action.payload;
    },
    clearErrors: (state) => {
      state.error = null;
    },
    resetState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch contacts
    builder
      .addCase(fetchContacts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.loading = false;
        state.contacts = action.payload;
        state.hasLoadedOnce = true;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch contacts';
      });

    // Fetch contact by ID
    builder
      .addCase(fetchContactById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContactById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedContact = action.payload;
      })
      .addCase(fetchContactById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch contact';
      });

    // Create contact
    builder
      .addCase(createContact.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createContact.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.contacts.unshift(action.payload);
        }
      })
      .addCase(createContact.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create contact';
      });

    // Update contact
    builder
      .addCase(updateContact.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateContact.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const index = state.contacts.findIndex(c => c.id === action.payload.id);
          if (index !== -1) {
            state.contacts[index] = action.payload;
          }
          if (state.selectedContact?.id === action.payload.id) {
            state.selectedContact = action.payload;
          }
        }
      })
      .addCase(updateContact.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update contact';
      });

    // Delete contact
    builder
      .addCase(deleteContact.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteContact.fulfilled, (state, action) => {
        state.loading = false;
        state.contacts = state.contacts.filter(c => c.id !== action.payload);
        if (state.selectedContact?.id === action.payload) {
          state.selectedContact = null;
        }
      })
      .addCase(deleteContact.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete contact';
      });

    // Reset contact state on logout
    builder.addCase(logout, () => initialState);
  },
});

export const {
  setSelectedContact,
  clearErrors,
  resetState,
} = contactSlice.actions;

export default contactSlice.reducer;

