// src/redux/slices/authSlice/authSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { setTokens } from "../../../utils/tokenUtils";

// Update the initial state to rehydrate from localStorage.
const initialState = {
  user: JSON.parse(localStorage.getItem("user")) || null,
  accessToken: localStorage.getItem("access_token") || null,
  refreshToken: localStorage.getItem("refresh_token") || null,
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,
  error: null,
  permissions: JSON.parse(localStorage.getItem("permissions")) || {}
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Update current user data and persist to localStorage
    setUser: (state, action) => {
      const updatedUser = { ...(state.user || {}), ...(action.payload || {}) };
      state.user = updatedUser;
      localStorage.setItem("user", JSON.stringify(updatedUser));
    },
    loginRequest: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.isLoading = false;
      if (action.payload.access_token && action.payload.refresh_token) {
        state.isAuthenticated = true;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.user = {
          ...action.payload.member,
          permission_ids: action.payload.permission_ids,
        };
        setTokens(action.payload.access_token, action.payload.refresh_token);
        localStorage.setItem("user", JSON.stringify(state.user));
      }
      state.error = null;
    },
    loginFailure: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
      state.permissions = {};
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      localStorage.removeItem("permissions");
    },
    setAuthFromLocalStorage: (state) => {
      const user = localStorage.getItem("user");
      if (user) {
        state.user = JSON.parse(user);
        state.isAuthenticated = true;
        state.accessToken = localStorage.getItem("access_token");
        state.refreshToken = localStorage.getItem("refresh_token");
        state.permissions = JSON.parse(localStorage.getItem("permissions")) || {};
      }
    },
    setPasswordRequest: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    setPasswordSuccess: (state) => {
      state.isLoading = false;
      state.error = null;
    },
    setPasswordFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    cachePermission: (state, action) => {
      const { permissionId, granted } = action.payload;
      state.permissions[permissionId] = granted;
      localStorage.setItem("permissions", JSON.stringify(state.permissions));
    },
    clearPermission: (state, action) => {
      const permissionId = action.payload;
      delete state.permissions[permissionId];
      localStorage.setItem("permissions", JSON.stringify(state.permissions));
    },
    clearAllPermissions: (state) => {
      state.permissions = {};
      localStorage.removeItem("permissions");
    }
  }
});

export const {
  setUser,
  loginRequest,
  loginSuccess,
  loginFailure,
  logout,
  setAuthFromLocalStorage,
  setPasswordRequest,
  setPasswordSuccess,
  setPasswordFailure,
  cachePermission,
  clearPermission,
  clearAllPermissions
} = authSlice.actions;

export default authSlice.reducer;
