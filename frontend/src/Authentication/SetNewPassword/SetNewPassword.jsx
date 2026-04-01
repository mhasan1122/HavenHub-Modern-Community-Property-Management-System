import { useDispatch, useSelector } from "react-redux";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearState, setNewPassword } from "../../redux/slices/forgotPasswordSlice/forgotPasswordSlice";
import PasswordInputComponents from "../../Components/FormComponent/PasswordInputComponents";
import MessageBox from "../../Components/MessageBox/MessageBox";

const SetNewPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { email, loading } = useSelector((state) => state.forgotPassword);

  // Local state for the password fields.
  const [newPassword, setNewPasswordState] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Inline error messages.
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  // API success/error messages.
  const [successMessage, setSuccessMessage] = useState("");
  const [apiError, setApiError] = useState("");
  // Controls display of MessageBox.
  const [showMessageBox, setShowMessageBox] = useState(false);

  // Redirect if email is missing.
  useEffect(() => {
    if (!email) {
      navigate("/forgotPassword");
    }
  }, [email, navigate]);

  // Validate password complexity; returns an array of errors.
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

  // Handle changes in the new password field.
  const handleNewPasswordChange = (e) => {
    const pwd = e.target.value;
    setNewPasswordState(pwd);
    const errors = validatePassword(pwd);
    setPasswordErrors(errors);
    if (confirmPassword && pwd !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  };

  // Handle changes in the confirm password field.
  const handleConfirmPasswordChange = (e) => {
    const conf = e.target.value;
    setConfirmPassword(conf);
    if (!conf) {
      setConfirmPasswordError("Confirm password is required.");
    } else if (newPassword !== conf) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  };

  // Submit handler.
  const handleSubmit = (e) => {
    e.preventDefault();
    const pwdErrors = validatePassword(newPassword);
    setPasswordErrors(pwdErrors);

    let confError = "";
    if (!confirmPassword) {
      confError = "Confirm password is required.";
    } else if (newPassword !== confirmPassword) {
      confError = "Passwords do not match.";
    }
    setConfirmPasswordError(confError);

    // If inline errors exist, do not dispatch API call.
    if (pwdErrors.length > 0 || confError) {
      return;
    }

    dispatch(setNewPassword({ email, new_password: newPassword })).then((response) => {
      if (response.meta.requestStatus === "fulfilled") {
        setSuccessMessage("Your password has been successfully updated.");
        setApiError("");
        setShowMessageBox(true);
      } else {
        setApiError(response.payload.error || "Unable to set the new password. Please try again.");
        setSuccessMessage("");
        setShowMessageBox(true);
      }
    });
  };

  // When MessageBox is dismissed.
  const clearMessage = () => {
    dispatch(clearState());
    setShowMessageBox(false);
    // On success, navigate to login.
    if (successMessage) {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-4 sm:py-8 px-4 sm:px-6 font-sans">
      {showMessageBox && (
        <MessageBox
          message={successMessage}
          error={apiError}
          clearMessage={clearMessage}
        />
      )}
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-12">
        {/* Left Section: Logo + Form */}
        <div className="w-full max-w-md lg:max-w-lg flex flex-col">
          {/* Logo */}
          <div className="login-logo mb-16 lg:mb-20">
            <img
              src="/logo.svg"
              alt="Company Logo"
              className="h-12 sm:h-14 lg:h-[63px] w-auto"
              onError={(e) => {
                if (e.target.src !== "/logo.svg") {
                  e.target.src = "/logo.svg";
                }
              }}
            />
          </div>
          
          {/* Form Container */}
          <div className="login-box w-full">
          <div className="text-left mb-0">
            <h2 className="text-[44px] font-[600] py-[16px]">Set a Password</h2>
            <p className="pb-[15px] text-left">
              Your previous password has been reset. Please set a new password for your account.
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <PasswordInputComponents
                name="new_password"
                label="Create Password"
                placeholder="Create password"
                value={newPassword}
                onChange={handleNewPasswordChange}
              />
              {passwordErrors.length > 0 && (
                <ul className="text-red-500 text-sm mt-1 list-disc list-inside text-left">
                  {passwordErrors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="login-field ">
              <PasswordInputComponents
                name="confirm_password"
                label="Re-enter Password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
              />
              {confirmPasswordError && (
                <p className="text-red-500 text-sm mt-1 text-left">{confirmPasswordError}</p>
              )}
            </div>
            <button
              type="submit"
              className="submit-btn bg-[#3D9D9B] w-full h-12 text-white rounded  my-3"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </form>
          </div>
        </div>
        
        {/* Right Section: Banner */}
        <div className="login-banner hidden lg:flex items-start justify-center bg-[#D1EDEE] rounded-[20px] flex-shrink-0 w-[550px]">
          <img
            src="/login_banner.svg"
            alt="Login Banner"
            className="w-full h-full rounded-[20px] object-contain"
            onError={(e) => {
              if (e.target.src !== "/login_banner.svg") {
                e.target.src = "/login_banner.svg";
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SetNewPassword;
