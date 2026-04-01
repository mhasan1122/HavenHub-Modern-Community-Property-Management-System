import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import pageNotFoundSvg from "@assets/error-pages/page_not_found.svg";

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    // Try to go back in history, or navigate to home
    if (window.history.length > 1) {
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
            src={pageNotFoundSvg}
            alt="Page Not Found"
            className="max-w-md w-full h-auto"
          />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Page Not Found</h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
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

export default NotFound;

