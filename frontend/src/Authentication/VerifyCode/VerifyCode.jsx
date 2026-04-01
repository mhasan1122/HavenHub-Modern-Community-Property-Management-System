import { Link, useNavigate } from "react-router-dom";
import TextInputComponent from "../../Components/FormComponent/TextInputComponent";
import { FiChevronLeft } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { clearState, verifyOtp, resendOtp } from "../../redux/slices/forgotPasswordSlice/forgotPasswordSlice";
import MessageBox from "../../Components/MessageBox/MessageBox";

const VerifyCode = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { message, error, loading, email } = useSelector((state) => state.forgotPassword);
  const [otp, setOtp] = useState("");
  const [otpInlineError, setOtpInlineError] = useState("");
  const [timer, setTimer] = useState(120);
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [messageBoxContent, setMessageBoxContent] = useState({ message: "", error: "" });

  // Redirect to forgot password if email is missing.
  useEffect(() => {
    if (!email) {
      navigate("/forgotPassword");
    }
  }, [email, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setOtpInlineError("Please enter the OTP.");
      return;
    }
    setOtpInlineError("");
    dispatch(verifyOtp({ email, otp })).then((response) => {
      if (response.meta.requestStatus === "fulfilled") {
        // Show success message; on dismiss, navigate to set new password.
        setMessageBoxContent({ message: response.payload.message, error: "" });
        setShowMessageBox(true);
      } else {
        setMessageBoxContent({ message: "", error: response.payload.error || "OTP verification failed." });
        setShowMessageBox(true);
      }
    });
  };

  const handleResend = () => {
    if (!email) {
      setMessageBoxContent({ message: "", error: "Email is missing." });
      setShowMessageBox(true);
      return;
    }
    dispatch(resendOtp(email)).then((response) => {
      if (response.meta.requestStatus === "fulfilled") {
        setTimer(120);
        setMessageBoxContent({ message: response.payload.message, error: "" });
        setShowMessageBox(true);
      } else {
        setMessageBoxContent({ message: "", error: response.payload.error || "Failed to resend OTP." });
        setShowMessageBox(true);
      }
    });
  };

  // Countdown timer for OTP validity.
  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(countdown);
    }
  }, [timer]);

  // If backend sets message or error, display them.
  useEffect(() => {
    if (message || error) {
      setMessageBoxContent({ message, error });
      setShowMessageBox(true);
    }
  }, [message, error]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const clearMessageBox = () => {
    setShowMessageBox(false);
    dispatch(clearState());
    // If the success message is displayed, navigate to set new password.
    if (messageBoxContent.message === "OTP verified. Proceed to reset password") {
      navigate("/setNewPassword");
    }
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
            <Link to="/forgotPassword">
              <p className="flex items-center py-3">
                <FiChevronLeft className="font-[800] text-[25px] pr-[2px]" />
               Back to Forgot Password
              </p>
            </Link>
            <h2 className="text-[44px] font-[600] ">Verify Code</h2>
            <p className="pt-[8px] pb-[8px] text-gray-500 ">An authentication code has been sent to your email.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <TextInputComponent
              name="otp"
              label="Enter Code"
              placeholder="Enter your OTP"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                if (otpInlineError) setOtpInlineError("");
              }}
            />
            {otpInlineError && (
              <div style={{ color: "red", fontSize: "0.9rem", textAlign: "left" }}>
                {otpInlineError}
              </div>
            )}
            <div className="flex justify-between items-center my-[12px]">
              <div>
                <p className="or-text text-left">
                  Didn’t receive a code?{" "}
                  <span className="text-[#FF8682] cursor-pointer" onClick={handleResend}>
                    Resend
                  </span>
                </p>
              </div>
              <div>
                <p className="rounded-full text-[12px] border-[#FF8682] border-[1px] py-[6px] px-[4px]">
                  {formatTime(timer)}
                </p>
              </div>
            </div>
            <button
              type="submit"
              className="submit-btn bg-[#3D9D9B] w-full h-12 text-white rounded"
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

export default VerifyCode;
