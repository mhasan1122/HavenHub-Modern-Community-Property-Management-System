// src/utils/axiosInstance.js
import axios from 'axios';
import { logout } from '../redux/slices/authSlice/authSlice';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenUtils';
import store from '../redux/store';
const BASE_URL = import.meta.env.VITE_BASE_API;

const axiosInstance = axios.create({
  baseURL: BASE_URL,
});

// Request interceptor to add the access token to request headers
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];

// Function to add subscribers for token refresh
function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

// Function to notify subscribers about new token
function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Response interceptor to handle token refresh and logout on failure
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const originalRequest = config;

    if (response && response.status === 401) {
      const refreshToken = getRefreshToken();

      // If no refresh token is available, log the user out
      if (!refreshToken) {
        store.dispatch(logout());
        clearTokens();
        return Promise.reject(new Error('No refresh token available'));
      }

      // If a refresh attempt is already in progress, wait for it to complete
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(`${BASE_URL}/user/token/refresh/`, { refresh: refreshToken });
        const { access } = refreshResponse.data;
        setTokens(access, refreshToken);
        isRefreshing = false;
        onRefreshed(access);
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        store.dispatch(logout());
        clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
