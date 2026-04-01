import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import confirmation from "../../assets/confimation-icon.png";

const ConfirmationMessageBox = ({ message, error, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", showCancel = true, isLoading = false, isSuccess = false }) => {
  const [confirmed, setConfirmed] = useState(false);
  const prevMessageRef = useRef(message);
  const prevErrorRef = useRef(error);

  // Reset confirmed state when modal opens (message/error transitions from falsy to truthy)
  useEffect(() => {
    const hasMessage = !!(message || error);
    const hadMessage = !!(prevMessageRef.current || prevErrorRef.current);
    
    // If modal is opening (wasn't showing, now is showing), reset confirmed state
    if (hasMessage && !hadMessage) {
      setConfirmed(false);
    }
    
    // Update refs for next render
    prevMessageRef.current = message;
    prevErrorRef.current = error;
  }, [message, error]);

  // Helper function to safely render messages or errors
  const renderContent = (content) => {
    if (!content) return "";
    // If content is a React element (JSX), return it as-is
    if (typeof content === "object" && content.$$typeof) {
      return content;
    }
    // If it's a plain object with values, join them
    if (typeof content === "object") {
      return Object.values(content).flat().join(", ");
    }
    return content;
  };

  const displayContent = renderContent(message) || renderContent(error);

  const modalContent = (
    <>
      {(message || error) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[99999] backdrop-blur-sm"></div>
      )}
      {(message || error) && (
        <div className="fixed inset-0 flex items-center justify-center z-[99999]">
          <div className="h-[352px] w-[410px] bg-white border border-gray-300 rounded-16 shadow-md flex flex-col items-center justify-center p-7">
            {isSuccess ? (
              <div className="relative flex items-center justify-center w-[76.53px] h-[76.53px] bg-[#BEFEC7] rounded-[43.7333px] mb-4">
                <svg
                  width="38.27"
                  height="38.27"
                  viewBox="0 0 38.27 38.27"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <path
                    d="M 8.5 19.135 L 15.5 26.135 L 29.5 12.135"
                    fill="none"
                    stroke="#00A81C"
                    strokeWidth="2.73333"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : (
              <div
                className={`${
                  error ? "text-red-600" : "text-primary"
                } rounded-full p-4`}
              >
                <img
                  src={confirmation}
                  className="text-5xl"
                  alt="confirmation icon"
                />
              </div>
            )}
            <h2 className="text-xl font-semibold text-center text-gray-800">
              {error ? "Error" : isSuccess ? "Success!" : "Are you sure ?"}
            </h2>
            <div className="text-center text-base text-gray-600 mt-1">
              {displayContent}
            </div>
            {isSuccess || !showCancel ? (
              <button
                onClick={onCancel}
                disabled={isLoading}
                className={`bg-primary w-full text-white py-2 px-6 mt-6 rounded-lg ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Please wait...' : 'OK'}
              </button>
            ) : (
              <div className="flex gap-4 w-full mt-6">
                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className={`border border-primary text-primary flex-1 py-2 px-6 rounded-lg ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`bg-primary flex-1 text-white py-2 px-6 rounded-lg ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Deleting...' : confirmText}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  // Use portal to render at document body level to ensure it covers everything including header and sidebar
  return (message || error) ? createPortal(modalContent, document.body) : null;
};

export default ConfirmationMessageBox;
