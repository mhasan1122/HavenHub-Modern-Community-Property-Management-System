import { useState, useRef } from "react";
import PropTypes from "prop-types";
import ConfirmationMessageBox from "../../MessageBox/ConfirmationMessageBox";

const ClearForm = ({ onClick, className = "", disabled = false }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isProcessing = useRef(false);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || isProcessing.current) {
      return;
    }
    
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (isProcessing.current) {
      return;
    }
    
    isProcessing.current = true;
    setShowConfirmation(false);
    
    if (onClick) {
      onClick();
      
      // Reset processing flag after a delay
      setTimeout(() => {
        isProcessing.current = false;
      }, 500);
    } else {
      isProcessing.current = false;
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    // Reset processing flag if modal is cancelled
    isProcessing.current = false;
  };

  return (
    <>
      <button
        onClick={handleClick}
        type="button"
        disabled={disabled}
        className={`${
          disabled 
            ? 'bg-disabledInput cursor-not-allowed text-black100' 
            : 'bg-primary text-white hover:bg-primaryHover'
        } px-4 py-3 rounded-8 transition-colors ${className}`}
      >
        Clear Form
      </button>
      <ConfirmationMessageBox
        message={showConfirmation ? "Are you sure you want to clear the form? All entered data will be lost." : null}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

ClearForm.propTypes = {
  onClick: PropTypes.func,
  className: PropTypes.string,
  disabled: PropTypes.bool
};

export default ClearForm;