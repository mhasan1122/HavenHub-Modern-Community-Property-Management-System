import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import PropTypes from "prop-types";
import allOtherErrorsSvg from "@assets/error-pages/all_other_errors.svg";

const GenericError = ({ error = null, resetErrorBoundary = null }) => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    // Try to reset error boundary if provided, otherwise navigate back
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-2xl w-full px-4 py-8 text-center">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <img
            src={allOtherErrorsSvg}
            alt="Error"
            className="max-w-md w-full h-auto"
          />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Something Went Wrong</h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            {error?.message || "An unexpected error occurred. Please try again later."}
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

GenericError.propTypes = {
  error: PropTypes.shape({
    message: PropTypes.string,
  }),
  resetErrorBoundary: PropTypes.func,
};

export default GenericError;