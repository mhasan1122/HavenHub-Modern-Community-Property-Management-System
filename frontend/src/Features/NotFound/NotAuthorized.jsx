import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { clearTokens } from "../../utils/tokenUtils";
import { logout } from "../../redux/slices/authSlice/authSlice";
import { FaArrowLeft } from "react-icons/fa";
import accessDeniedSvg from "@assets/error-pages/access_denied.svg";

const NotAuthorized = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const handleGoBack = () => {
    // Redirect to the appropriate route based on authentication state
    if (isAuthenticated) {
      // User is logged in but lacks permissions, redirect to dashboard
      navigate("/");
    } else {
      // User is not logged in, clear any stale data and redirect to login
      dispatch(logout()); // Dispatch logout action to clear Redux state
      clearTokens(); // Clear tokens from localStorage
      navigate("/login");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-2xl w-full px-4 py-8 text-center">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <img
            src={accessDeniedSvg}
            alt="Access Denied"
            className="max-w-md w-full h-auto"
          />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            You do not have the required permissions to view this page.
          </p>

          {/* Go Back Button */}
          <div className="pt-6">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg text-base font-semibold hover:bg-primaryHover transition-colors duration-200"
            >
              <FaArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotAuthorized;