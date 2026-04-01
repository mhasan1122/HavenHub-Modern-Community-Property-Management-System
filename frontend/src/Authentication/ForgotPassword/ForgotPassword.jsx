import { Link, useNavigate } from "react-router-dom";
import EmailInputComponent from "../../Components/FormComponent/EmailInputComponent";
import { FiChevronLeft } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import {
  clearState,
  requestOtp,
  setEmail
} from "../../redux/slices/forgotPasswordSlice/forgotPasswordSlice";
import MessageBox from "../../Components/MessageBox/MessageBox";

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { message, error, loading } = useSelector(
    (state) => state.forgotPassword
  );
  const [email, setEmailState] = useState("");
  const [emailInlineError, setEmailInlineError] = useState(""); // Inline error state for empty email.
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [messageBoxContent, setMessageBoxContent] = useState({
    message: "",
    error: ""
  });

  // Show MessageBox when backend returns a message or error.
  useEffect(() => {
    if (message || error) {
      setMessageBoxContent({ message, error });
      setShowMessageBox(true);
    }
  }, [message, error, dispatch]);

  const clearMessageBox = () => {
    setShowMessageBox(false);
    dispatch(clearState());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Inline validation: if email is empty, show an inline error below the field.
    if (!email.trim()) {
      setEmailInlineError("Email is required");
      return;
    }
    setEmailInlineError("");

    // Validate the email format.
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setMessageBoxContent({
        message: "",
        error: "Please enter a valid email address."
      });
      setShowMessageBox(true);
      return;
    }
    // Dispatch the request OTP action.
    dispatch(requestOtp(email)).then((response) => {
      if (response.meta.requestStatus === "fulfilled") {
        setMessageBoxContent({
          message: response.payload.message || "OTP sent to your email",
          error: ""
        });
        dispatch(setEmail(email));
        navigate("/verifyCode");
      } else {
        // Backend error such as unknown email is shown via MessageBox.
        setMessageBoxContent({
          message: "",
          error:
            response.payload?.error || "Failed to send OTP. Please try again."
        });
        setShowMessageBox(true);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-4 sm:py-8 px-4 sm:px-6 font-sans">
      {showMessageBox && (
        <MessageBox
          message={messageBoxContent.message}
          error={messageBoxContent.error}
          clearMessage={clearMessageBox}
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
            <Link to="/login" className="block mb-2 sm:mb-3 lg:mb-0">
              <p className="flex items-center text-sm sm:text-base lg:text-base text-primary hover:text-primaryHover transition-colors active:scale-95 lg:active:scale-100 min-h-[44px] sm:min-h-0 lg:min-h-0">
                <FiChevronLeft className="font-[800] text-xl sm:text-2xl lg:text-[25px] pr-[2px]" />
                Back to login
              </p>
            </Link>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-[600] py-3 sm:py-4 lg:py-[16px]">
              Forgot your password?
            </h2>
            <p className="text-sm sm:text-base lg:text-base text-gray-500">
              Don't worry, happens to all of us. Enter your email below to
              recover your password.
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <EmailInputComponent
              name="email"
              label={
                <span>
                  Email <span className="text-red-500 text-[20px]">*</span>
                </span>
              }
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmailState(e.target.value);
                // Clear inline error when user starts typing.
                if (emailInlineError) setEmailInlineError("");
              }}
            />
            {/* Inline error message below the email field */}
            {emailInlineError && (
              <div
                className="text-red-500 text-sm sm:text-base lg:text-[0.9rem] text-left mt-1"
                style={{ textAlign: "left" }}
              >
                {emailInlineError}
              </div>
            )}
            <button
              type="submit"
              className="submit-btn bg-[#3D9D9B] w-full h-12 sm:h-14 lg:h-12 text-white rounded-lg lg:rounded font-medium text-base sm:text-lg lg:text-base transition-all duration-200 hover:bg-[#2d7d7b] active:scale-[0.98] lg:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md lg:shadow-none lg:hover:shadow-none mt-4"
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

export default ForgotPassword;
