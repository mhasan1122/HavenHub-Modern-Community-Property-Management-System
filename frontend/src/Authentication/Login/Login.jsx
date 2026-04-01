import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import PasswordInputComponents from "../../Components/FormComponent/PasswordInputComponents";
import CheckboxComponent from "../../Components/FormComponent/CheckboxComponent";
import {
  loginUser,
  checkUserStatus,
  setPasswordUser
} from "../../api/authApi/authApi";
import "./Login.css";
import TextInputComponent from "../../Components/FormComponent/TextInputComponent";
import MessageBox from "../../Components/MessageBox/MessageBox";
import { getCompanySettingsPublic } from "../../redux/slices/companySettingsSlice/companySettingsSlice";

const Login = () => {
  const [activeTab, setActiveTab] = useState(1);
  // "authenticator" can be a username, email, or contact number.
  const [authenticator, setAuthenticator] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [userId, setUserId] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading } = useSelector((state) => state.auth);
  const { publicSettings } = useSelector((state) => state.companySettings);

  // States for messages to be displayed via MessageBox in tabs 1 & 3
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const { isAuthenticated } = useSelector((state) => state.auth);

  // NEW: Inline error states for Set Password tab (activeTab 2)
  const [oldPasswordError, setOldPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState([]);

  // NEW: Inline error state for authenticator (Tab 1) and login password (Tab 3)
  const [authenticatorError, setAuthenticatorError] = useState("");
  const [loginPasswordInlineError, setLoginPasswordInlineError] = useState("");
  
  // Track if user is a first-time user
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/"); // Redirect to dashboard
    }
  }, [isAuthenticated, navigate]);

  // Fetch company settings when moving to password tab (Tab 3)
  useEffect(() => {
    if (activeTab === 3) {
      dispatch(getCompanySettingsPublic());
    }
  }, [activeTab, dispatch]);

  // Helper to convert error objects into a string (for tabs 1 & 3)
  const parseError = (err) => {
    if (typeof err === "object") {
      let messages = [];
      for (let key in err) {
        const value = Array.isArray(err[key]) ? err[key].join(", ") : err[key];
        messages.push(`${key}: ${value}`);
      }
      return messages.join(", ");
    }
    return err;
  };

  useEffect(() => {
    // Retrieve the entire entered credential from localStorage
    const savedAuthenticator = localStorage.getItem("authenticator");
    const savedPassword = localStorage.getItem("loginPassword");
    const savedRememberMe = localStorage.getItem("rememberMe") === "true";

    if (savedRememberMe) {
      setAuthenticator(savedAuthenticator || "");
      setLoginPassword(savedPassword || "");
      setRememberMe(savedRememberMe);
    }
  }, []);

  // Tab 1: Check user status
  const handleCheckStatus = async (e) => {
    e.preventDefault();
    // Inline validation: if authenticator field is empty, show inline error below the field.
    if (!authenticator.trim()) {
      setAuthenticatorError("Authenticator is required.");
      return;
    }
    setAuthenticatorError("");

    // Await the dispatch so the result is available
    // const result = await dispatch(checkUserStatus(authenticator));
    const result = await dispatch(checkUserStatus(authenticator.trim()));

    if (result && result.error) {
      // If credentials are provided but backend returns an error, use MessageBox.
      setErrorMessage(parseError(result.error));
      return;
    }
    if (result) {
      if (result.is_first_login) {
        setUserId(result.user_id);
        setIsFirstTimeUser(true);
        setActiveTab(2); // Move to set password tab
      } else {
        setIsFirstTimeUser(false);
        setActiveTab(3); // Move to login tab
      }
    }
  };

  // Validate password complexity; returns an array of errors (same as Forgot Password flow)
  const validatePassword = (password) => {
    const errors = [];
    if (!password) {
      errors.push("New password is required.");
      return errors;
    }
    if (password.length < 8) errors.push("Password must be at least 8 characters long.");
    if (!/[!@#$%^&*]/.test(password)) errors.push("Password must contain at least one special character (!@#$%^&*).");
    if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter.");
    if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter.");
    if (!/[0-9]/.test(password)) errors.push("Password must contain at least one number.");
    return errors;
  };

  // Updated handler for Tab 2 to show inline errors
  const handleSetPassword = async (e) => {
    e.preventDefault();
    let valid = true;

    // Client-side validations:
    if (!oldPassword) {
      setOldPasswordError("Old Password is required.");
      valid = false;
    }
    if (!newPassword) {
      setNewPasswordError("New Password is required.");
      valid = false;
    }
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password.");
      valid = false;
    }

    // Validate password complexity (same as Forgot Password flow)
    const pwdErrors = validatePassword(newPassword);
    setPasswordErrors(pwdErrors);
    if (pwdErrors.length > 0) {
      valid = false;
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      setConfirmPasswordError("New password and confirmation do not match!");
      valid = false;
    }
    if (!valid) {
      return;
    }

    // Clear inline errors if validations pass
    setOldPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    const result = await dispatch(
      setPasswordUser(userId, newPassword, oldPassword, confirmPassword)
    );
    if (result && result.error) {
      // If API returns error as an object, show each error below its field
      if (typeof result.error === "object") {
        if (result.error.old_password) {
          setOldPasswordError(result.error.old_password.join(", "));
        }
        if (result.error.new_password) {
          setNewPasswordError(result.error.new_password.join(", "));
        }
        if (result.error.confirm_password) {
          setConfirmPasswordError(result.error.confirm_password.join(", "));
        }
      } else {
        // Otherwise, assign a general error to the confirm password field
        setConfirmPasswordError(parseError(result.error));
      }
      return;
    }
    setSuccessMessage("Password changed successfully!");
    setActiveTab(3);
  };

  // Tab 3: Login
  const handleLogin = async (e) => {
    e.preventDefault();
    // Inline validation: if login password is empty, show inline error below the field.
    if (!loginPassword.trim()) {
      setLoginPasswordInlineError("Password is required.");
      return;
    }
    setLoginPasswordInlineError("");

    const login_type = "org";
    // Await the login action to get a response or error
    const result = await dispatch(
      // loginUser(authenticator, loginPassword, navigate, login_type)
      loginUser(authenticator.trim(), loginPassword, navigate, login_type)
    );
    if (result && result.error) {
      // Show backend error using MessageBox
      setErrorMessage(parseError(result.error));
    }

    // Save the authenticator if remember me is checked.
    if (rememberMe) {
      // localStorage.setItem("authenticator", authenticator);
      // localStorage.setItem("loginPassword", loginPassword);
      localStorage.setItem("authenticator", authenticator.trim());
      localStorage.setItem("loginPassword", loginPassword);
      localStorage.setItem("rememberMe", true);
    } else {
      localStorage.removeItem("authenticator");
      localStorage.removeItem("loginPassword");
      localStorage.removeItem("rememberMe");
    }
  };

  // Clear both error and success messages (used in tabs 1 & 3)
  const clearMessage = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  // Get logo and image URLs - dynamic for Tab 3, static for Tab 1
  const logoUrl = activeTab === 3 && publicSettings?.logo_url 
    ? publicSettings.logo_url 
    : "/logo.svg";
  const loginImageUrl = activeTab === 3 && publicSettings?.login_page_image_url 
    ? publicSettings.login_page_image_url 
    : "/login_banner.svg";

  return (
    <div className="login-page min-h-screen flex items-center justify-center py-4 sm:py-8 px-4 sm:px-6">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-12">
        {/* Left Section: Logo + Form */}
        <div className="w-full max-w-md lg:max-w-lg flex flex-col">
          {/* Logo */}
          <div className="login-logo mb-16 lg:mb-20">
            <img
              src={logoUrl}
              alt="Company Logo"
              className="h-12 sm:h-14 lg:h-[63px] w-auto"
              onError={(e) => {
                // Fallback to default logo if image fails to load
                if (e.target.src !== "/logo.svg") {
                  e.target.src = "/logo.svg";
                }
              }}
            />
          </div>
          
          {/* Login Form Container */}
          <div className="login-box w-full">
            <div className="login-title mb-6 lg:mb-8">
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-[600] text-left">Login</h2>
              <p className="pt-2 sm:pt-3 lg:pt-[12px] text-sm sm:text-base lg:text-base text-gray-500 text-left">
                Login to access your Estate Link account
              </p>
            </div>
          {activeTab === 1 && (
            <form onSubmit={handleCheckStatus}>
              {/* <TextInputComponent
                label="User Name / Email"
                name="usernameOrEmail"
                placeholder="Enter your Username, Email or Contact Number"
                value={authenticator}
                onChange={(e) => {
                  setAuthenticator(e.target.value);
                  setAuthenticatorError("");
                }}
              /> */}
              <div className="flex flex-col text-left gap-1">
                <label htmlFor="usernameOrEmail" className="py-2 sm:py-3 lg:py-3 text-sm sm:text-base lg:text-base">
                  User Name / Email / Phone Number
                </label>
                <input
                  type="text"
                  id="usernameOrEmail"
                  name="usernameOrEmail"
                  placeholder="enter your user name / e-mail / phone number"
                  value={authenticator}
                  onChange={(e) => {
                    setAuthenticator(e.target.value);
                    setAuthenticatorError("");
                  }}
                  className="login-field-input min-h-[48px] sm:min-h-[52px] lg:min-h-0 text-base"
                />
              </div>

              {/* Inline error for Tab 1 (left aligned) */}
              {authenticatorError && (
                <div
                  className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] text-left mt-1"
                  style={{
                    textAlign: "left"
                  }}
                >
                  {authenticatorError}
                </div>
              )}
              <div className="pb-4 sm:pb-6 lg:pb-[26px] pt-3 sm:pt-4 lg:pt-[12px] flex flex-col sm:flex-row lg:flex-row justify-between gap-3 sm:gap-0 lg:gap-0">
                <div className="flex items-center">
                  <CheckboxComponent
                    name="rememberMe"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                    borderColor="border-primary"
                    label="Remember me"
                  />
                </div>
                <div className="login-remember flex items-center text-error">
                  <Link to="/forgotPassword" className="text-sm sm:text-base lg:text-base hover:underline">
                    <p>Forgot Password</p>
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn bg-[#3D9D9B] w-full h-12 sm:h-14 lg:h-12 text-white rounded-lg lg:rounded font-medium text-base sm:text-lg lg:text-base transition-all duration-200 hover:bg-[#2d7d7b] active:scale-[0.98] lg:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md lg:shadow-none lg:hover:shadow-none"
                disabled={isLoading}
              >
                Next
              </button>
            </form>
          )}
          {activeTab === 2 && (
            <form onSubmit={handleSetPassword}>
              <PasswordInputComponents
                label="Old Password"
                name="oldPassword"
                placeholder="Old Password"
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  setOldPasswordError("");
                }}
              />
              {oldPasswordError && (
                <div
                  className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] text-left mt-1"
                  style={{
                    textAlign: "left"
                  }}
                >
                  {oldPasswordError}
                </div>
              )}
              <PasswordInputComponents
                label="New Password"
                name="newPassword"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => {
                  const pwd = e.target.value;
                  setNewPassword(pwd);
                  setNewPasswordError("");
                  const errors = validatePassword(pwd);
                  setPasswordErrors(errors);
                  if (confirmPassword && pwd !== confirmPassword) {
                    setConfirmPasswordError("Passwords do not match.");
                  } else {
                    setConfirmPasswordError("");
                  }
                }}
              />
              {passwordErrors.length > 0 && (
                <ul className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] mt-1 list-disc list-inside text-left">
                  {passwordErrors
                    .filter((err) => !(isFirstTimeUser && err === "New password is required."))
                    .map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                </ul>
              )}
              {newPasswordError && (
                <div
                  className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] text-left mt-1"
                  style={{
                    textAlign: "left"
                  }}
                >
                  {newPasswordError}
                </div>
              )}
              <PasswordInputComponents
                label="Re-type New Password"
                name="confirmPassword"
                placeholder="Re-type New Password"
                value={confirmPassword}
                onChange={(e) => {
                  const conf = e.target.value;
                  setConfirmPassword(conf);
                  if (!conf) {
                    setConfirmPasswordError("Confirm password is required.");
                  } else if (newPassword !== conf) {
                    setConfirmPasswordError("Passwords do not match.");
                  } else {
                    setConfirmPasswordError("");
                  }
                }}
              />
              {confirmPasswordError && (
                <div
                  className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] text-left mt-1"
                  style={{
                    textAlign: "left"
                  }}
                >
                  {confirmPasswordError}
                </div>
              )}

              <div className="login-options pb-4 sm:pb-6 lg:pb-[16px] pt-3 sm:pt-4 lg:pt-0 flex justify-between">
                <div className="flex items-center">
                  <CheckboxComponent
                    name="rememberMe"
                    borderColor="border-primary"
                    label="Remember me"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="submit-btn bg-[#3D9D9B] w-full h-12 sm:h-14 lg:h-12 text-white rounded-lg lg:rounded font-medium text-base sm:text-lg lg:text-base transition-all duration-200 hover:bg-[#2d7d7b] active:scale-[0.98] lg:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md lg:shadow-none lg:hover:shadow-none"
                disabled={isLoading}
              >
                Set Password
              </button>
            </form>
          )}
          {activeTab === 3 && (
            <form onSubmit={handleLogin}>
              {/* Back arrow to go back to username/email screen */}
              <div className="mb-4 sm:mb-6 lg:mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(1);
                    setLoginPassword("");
                    setLoginPasswordInlineError("");
                    setErrorMessage("");
                  }}
                  className="flex items-center gap-2 text-primary hover:text-primaryHover transition-colors active:scale-95 lg:active:scale-100 min-h-[44px] sm:min-h-0 lg:min-h-0"
                  title="Back to login"
                >
                  <FaArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4" />
                  <span className="text-sm sm:text-base lg:text-sm font-medium">Back to Login</span>
                </button>
              </div>
              <PasswordInputComponents
                label="Password"
                name="loginPassword"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginPasswordInlineError("");
                }}
              />
              {/* Inline error for Tab 3 (left aligned) */}
              {loginPasswordInlineError && (
                <div
                  className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] text-left mt-1"
                  style={{
                    textAlign: "left"
                  }}
                >
                  {loginPasswordInlineError}
                </div>
              )}
              <div className="login-options pb-4 sm:pb-6 lg:pb-[25px] pt-3 sm:pt-4 lg:pt-[0px] flex flex-col sm:flex-row lg:flex-row justify-between gap-3 sm:gap-0 lg:gap-0">
                <div className="login-remember flex items-center">
                  <CheckboxComponent
                    name="rememberMe"
                    borderColor="border-primary"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                    label="Remember me"
                  />
                </div>
                <div className="login-remember flex items-center text-error">
                  <Link to="/forgotPassword" className="text-sm sm:text-base lg:text-base hover:underline">
                    <p>Forgot Password</p>
                  </Link>
                </div>
              </div>
              <button
                type="submit"
                className="submit-btn bg-[#3D9D9B] w-full h-12 sm:h-14 lg:h-12 text-white rounded-lg lg:rounded font-medium text-base sm:text-lg lg:text-base transition-all duration-200 hover:bg-[#2d7d7b] active:scale-[0.98] lg:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md lg:shadow-none lg:hover:shadow-none"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          )}
          </div>
        </div>
        
        {/* Right Section: Banner */}
        <div className="login-banner hidden lg:flex items-start justify-center bg-[#D1EDEE] rounded-[20px] flex-shrink-0 w-[550px]">
          <img
            src={loginImageUrl}
            alt="Login Banner"
            className="w-full h-full rounded-[20px] object-contain"
            onError={(e) => {
              // Fallback to default image if image fails to load
              if (e.target.src !== "/login_banner.svg") {
                e.target.src = "/login_banner.svg";
              }
            }}
          />
        </div>
      </div>
      {/* MessageBox for backend messages (tabs 1 & 3) */}
      <MessageBox
        message={successMessage}
        error={errorMessage}
        clearMessage={clearMessage}
      />
    </div>
  );
};

export default Login;
