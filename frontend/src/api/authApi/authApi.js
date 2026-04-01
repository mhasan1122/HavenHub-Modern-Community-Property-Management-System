// src/api/authApi/authApi.js
import axios from "axios";
import {
  loginRequest,
  loginSuccess,
  loginFailure,
  logout,
  setPasswordRequest,
  setPasswordSuccess,
  setPasswordFailure
} from "../../redux/slices/authSlice/authSlice";
import {
  setTokens,
  clearTokens,
  getRefreshToken
} from "../../utils/tokenUtils";

const API_URL = import.meta.env.VITE_BASE_API + "/user";

// Updated Login Action: Now dispatches member and permission_ids along with tokens.
export const loginUser = (authenticator, password, navigate, login_type) => async (dispatch) => {
  dispatch(loginRequest());
  try {
    const response = await axios.post(`${API_URL}/login/`, {
      authenticator,
      password,
      login_type
    });
    // Destructure the full payload from the backend
    const { access_token, refresh_token, member, permission_ids } = response.data;
    setTokens(access_token, refresh_token);
    // Optionally store member if needed:
    localStorage.setItem("member", JSON.stringify(member));
    dispatch(
      loginSuccess({
        access_token,
        refresh_token,
        member,
        permission_ids
      })
    );
    navigate("/");
    return response.data; // Return full data if needed
  } catch (error) {
    const err = error.response?.data || "Login failed";
    dispatch(loginFailure(err));
    return { error: err }; // Return error so the component can display it
  }
};

export const checkUserStatus = (authenticator) => async (dispatch) => {
  dispatch(loginRequest());
  try {
    const response = await axios.post(`${API_URL}/check_status/`, {
      authenticator
    });
    dispatch(loginSuccess({}));
    return response.data;
  } catch (error) {
    const err = error.response?.data || "Status check failed";
    dispatch(loginFailure(err));
    return { error: err };
  }
};

export const setPasswordUser =
  (userId, newPassword, oldPassword, confirmPassword) => async (dispatch) => {
    dispatch(setPasswordRequest());
    try {
      const response = await axios.post(`${API_URL}/set_password/`, {
        user_id: userId,
        new_password: newPassword,
        old_password: oldPassword,
        confirm_password: confirmPassword
      });
      dispatch(setPasswordSuccess());
      return response.data;
    } catch (error) {
      const err = error.response?.data || "Set password failed";
      dispatch(setPasswordFailure(err));
      return { error: err };
    }
  };



//  * Logs out the current user by calling the backend logout API,
//  * clearing local storage tokens, updating the Redux store, and navigating to the login page.
export const logoutUser = (navigate) => async (dispatch) => {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await axios.post(`${API_URL}/logout/`, {
        refresh_token: refreshToken
      });
    }
  } catch (error) {
    console.error("Logout failed", error.response?.data || error.message);
  } finally {
    clearTokens();
    localStorage.clear();
    dispatch(logout());
    navigate("/login");
  }
};
