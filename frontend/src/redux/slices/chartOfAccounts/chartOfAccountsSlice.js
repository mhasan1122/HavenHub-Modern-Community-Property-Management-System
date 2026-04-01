import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../../utils/axiosInstance';
import { enableMapSet } from 'immer';

// Enable MapSet plugin for Immer to work with Set objects
enableMapSet();

// Async thunks for CRUD operations
export const fetchAccounts = createAsyncThunk(
  'chartOfAccounts/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/accounts/accounts/');
      // Handle both paginated and direct array responses
      const accountsData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      return accountsData;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createAccount = createAsyncThunk(
  'chartOfAccounts/createAccount',
  async (accountData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/accounts/accounts/', accountData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateAccount = createAsyncThunk(
  'chartOfAccounts/updateAccount',
  async ({ id, accountData }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(`/api/accounts/accounts/${id}/`, accountData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteAccount = createAsyncThunk(
  'chartOfAccounts/deleteAccount',
  async (id, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/api/accounts/accounts/${id}/`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const moveAccount = createAsyncThunk(
  'chartOfAccounts/moveAccount',
  async ({ id, parentAccount }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(`/api/accounts/accounts/${id}/`, {
        parentAccount: parentAccount || null
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Initial state
const initialState = {
  accounts: [],
  loading: false,
  error: null,
  operationLoading: false,
  successMessage: null,
  expandedNodes: new Set(),
  userExpandedAll: false,
  selectedAccount: null,
  showAddModal: false,
  showEditModal: false,
  showDeleteConfirmation: false,
  accountToDelete: null,
  showMoveModal: false,
  accountToMove: null,
  selectedNewParent: null,
  showMoveConfirmation: false,
  // Additional UI state
  viewMode: 'tree', // 'table' or 'tree'
  currentPage: 1,
  itemsPerPage: 10,
  // Search and filter state
  searchQuery: '',
  filters: {},
};

const chartOfAccountsSlice = createSlice({
  name: 'chartOfAccounts',
  initialState,
  reducers: {
    // UI State Reducers
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    setExpandedNodes: (state, action) => {
      state.expandedNodes = new Set(action.payload);
    },
    setUserExpandedAll: (state, action) => {
      state.userExpandedAll = action.payload;
    },
    toggleNode: (state, action) => {
      const nodeId = action.payload;
      if (state.expandedNodes.has(nodeId)) {
        state.expandedNodes.delete(nodeId);
      } else {
        state.expandedNodes.add(nodeId);
      }
      // If user manually collapses a node and userExpandedAll is true, reset the userExpandedAll flag
      if (state.userExpandedAll) {
        state.userExpandedAll = false;
      }
    },
    expandAll: (state) => {
      const allIds = new Set();
      const collectIds = (nodes) => {
        nodes.forEach((node) => {
          allIds.add(node.id);
          if (node.children && node.children.length > 0) {
            collectIds(node.children);
          }
        });
      };
      // Build tree to get all IDs
      const tree = buildTree(state.accounts);
      collectIds(tree);
      state.expandedNodes = allIds;
      state.userExpandedAll = true;
    },
    collapseAll: (state) => {
      state.expandedNodes = new Set();
      state.userExpandedAll = false;
    },
    // Modal State Reducers
    setShowAddModal: (state, action) => {
      state.showAddModal = action.payload;
      if (!action.payload) {
        state.selectedAccount = null;
      }
    },
    setShowEditModal: (state, action) => {
      state.showEditModal = action.payload;
      if (!action.payload) {
        state.selectedAccount = null;
      }
    },
    setShowDeleteConfirmation: (state, action) => {
      state.showDeleteConfirmation = action.payload;
    },
    setAccountToDelete: (state, action) => {
      state.accountToDelete = action.payload;
    },
    setShowMoveModal: (state, action) => {
      state.showMoveModal = action.payload;
      if (!action.payload) {
        state.accountToMove = null;
        state.selectedNewParent = null;
      }
    },
    setAccountToMove: (state, action) => {
      state.accountToMove = action.payload;
    },
    setSelectedNewParent: (state, action) => {
      state.selectedNewParent = action.payload;
    },
    setShowMoveConfirmation: (state, action) => {
      state.showMoveConfirmation = action.payload;
    },
    // Set selected account for editing
    setSelectedAccount: (state, action) => {
      state.selectedAccount = action.payload;
    },
    // Clear state
    clearError: (state) => {
      state.error = null;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
    // Set search query
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    // Set filters
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    // Clear filters
    clearFilters: (state) => {
      state.filters = {};
      state.searchQuery = '';
    },
  },
  extraReducers: (builder) => {
    // Fetch accounts
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
        state.currentPage = 1; // Reset to first page when data changes
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create account
    builder
      .addCase(createAccount.pending, (state) => {
        state.operationLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(createAccount.fulfilled, (state, action) => {
        state.operationLoading = false;
        state.successMessage = 'Account created successfully!';
        // Add the new account to the state
        state.accounts.push(action.payload);
        state.showAddModal = false;
      })
      .addCase(createAccount.rejected, (state, action) => {
        state.operationLoading = false;
        state.error = action.payload;
      });

    // Update account
    builder
      .addCase(updateAccount.pending, (state) => {
        state.operationLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
        state.operationLoading = false;
        state.successMessage = 'Account updated successfully!';
        // Update the account in the state
        const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
        if (index !== -1) {
          state.accounts[index] = action.payload;
        }
        state.showEditModal = false;
      })
      .addCase(updateAccount.rejected, (state, action) => {
        state.operationLoading = false;
        state.error = action.payload;
      });

    // Delete account
    builder
      .addCase(deleteAccount.pending, (state) => {
        state.operationLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(deleteAccount.fulfilled, (state, action) => {
        state.operationLoading = false;
        state.successMessage = 'Account deleted successfully!';
        // Remove the account from the state
        state.accounts = state.accounts.filter(acc => acc.id !== action.payload);
        state.showDeleteConfirmation = false;
        state.accountToDelete = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.operationLoading = false;
        state.error = action.payload;
      });

    // Move account
    builder
      .addCase(moveAccount.pending, (state) => {
        state.operationLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(moveAccount.fulfilled, (state, action) => {
        state.operationLoading = false;
        state.successMessage = 'Account moved successfully!';
        // Update the account in the state
        const index = state.accounts.findIndex(acc => acc.id === action.payload.id);
        if (index !== -1) {
          state.accounts[index] = action.payload;
        }
        state.showMoveModal = false;
        state.showMoveConfirmation = false;
        state.accountToMove = null;
        state.selectedNewParent = null;
      })
      .addCase(moveAccount.rejected, (state, action) => {
        state.operationLoading = false;
        state.error = action.payload;
      });
  }
});

// Helper function to build tree from flat list (used in expandAll)
const buildTree = (accountsList) => {
  const map = {};
  const tree = [];

  // Create map of accounts
  accountsList.forEach((account) => {
    map[account.id] = { ...account, children: [] };
  });

  // Build tree
  accountsList.forEach((account) => {
    if (account.parentAccount) {
      if (map[account.parentAccount]) {
        map[account.parentAccount].children.push(map[account.id]);
      }
    } else {
      tree.push(map[account.id]);
    }
  });

  return tree;
};

export const {
  setViewMode,
  setCurrentPage,
  setExpandedNodes,
  setUserExpandedAll,
  toggleNode,
  expandAll,
  collapseAll,
  setShowAddModal,
  setShowEditModal,
  setShowDeleteConfirmation,
  setAccountToDelete,
  setShowMoveModal,
  setAccountToMove,
  setSelectedNewParent,
  setShowMoveConfirmation,
  setSelectedAccount,
  clearError,
  clearSuccessMessage,
  setSearchQuery,
  setFilters,
  clearFilters,
} = chartOfAccountsSlice.actions;

export default chartOfAccountsSlice.reducer;