import axios from "axios";
import { setTokens, getAccessToken, getRefreshToken } from "./../utils/tokenUtils";

const BASE_URL = "http://localhost:8000";

// Created By Firoj Hasan
const reactInstance = axios.create({
  baseURL: BASE_URL,
});

reactInstance.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Created By Firoj Hasan
reactInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        if (reactInstance.onLogout) {
          reactInstance.onLogout(); // Call provided logout function
        }
        return Promise.reject("No refresh token available");
      }

      try {
        const response = await axios.post(`${BASE_URL}/user/token/refresh/`, { refresh: refreshToken });
        const { access } = response.data;
        setTokens(access, refreshToken);
        originalRequest.headers["Authorization"] = `Bearer ${access}`;

        return axios(originalRequest);
      } catch (refreshError) {
        if (reactInstance.onLogout) {
          reactInstance.onLogout(); // Call provided logout function
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Allow setting a logout function dynamically
reactInstance.onLogout = null;

export default reactInstance;
