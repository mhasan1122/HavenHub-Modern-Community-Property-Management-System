import { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import {
  removeImage,
  getCompanySettings,
} from "../../../redux/slices/companySettingsSlice/companySettingsSlice";
import MessageBox from "../../../Components/MessageBox/MessageBox";
// Images upload in original size, displayed at 193.64×50px in header via CSS

const CompanyImageTable = ({
  images = [],
  allImages = [],
  imageType,
  isLoading = false,
  onUploadClick,
  previewUrl = null,
  onRemovePreview,
  markedForDeletion = false,
  onMarkForDeletion,
}) => {
  const dispatch = useDispatch();
  const [modalMessage, setModalMessage] = useState({
    message: "",
    error: ""
  });

  const hasImages = Array.isArray(images) && images.length > 0;
  // Since we only allow one image at a time, get the first (and only) image
  const currentImage = hasImages ? images[0] : null;
  
  // Show preview if available, otherwise show uploaded image
  const displayPreview = previewUrl !== null;
  // Show upload area if: no preview, AND (no current image OR image is marked for deletion)
  const showUploadArea = !displayPreview && (!currentImage || markedForDeletion);

  const handleMarkForDeletion = () => {
    if (onMarkForDeletion) {
      onMarkForDeletion();
    }
  };

  const handleClearMessage = () => {
    setModalMessage({ message: "", error: "" });
  };

  const uploadLabel = imageType === 'logo' ? 'Upload Logo' : 'Upload Login Page Image';

  return (
    <>
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500">Loading images...</p>
        </div>
      )}

      {!isLoading && showUploadArea && (
        <div 
          onClick={onUploadClick}
          className="relative w-full py-6 sm:py-8 rounded-lg flex flex-col items-center border border-dashed border-gray-300 cursor-pointer hover:border-primary hover:bg-gray-50 transition-all"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center mb-2 sm:mb-3">
            <svg 
              className="w-6 h-6 sm:w-8 sm:h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
          </div>
          <p className="text-xs sm:text-sm font-medium text-gray-700 text-center px-2">{uploadLabel}</p>
        </div>
      )}

      {!isLoading && displayPreview && (
        <div className="flex justify-center">
          <div className="relative rounded-lg border border-gray-200 bg-white p-3 sm:p-4 flex flex-col items-center w-full max-w-xs">
            {/* Preview Badge */}
            {/* <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded z-10">
              Preview
            </div> */}
            
            {/* Image Preview */}
            <div className="relative w-full max-w-[12rem] sm:max-w-[14rem] aspect-[3/2] flex items-center justify-center rounded-md mb-2">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-contain rounded-md"
              />
              
              {/* Remove Preview Button */}
              <button
                type="button"
                onClick={onRemovePreview}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shadow-lg hover:bg-red-600 transition-all z-10 text-sm sm:text-base"
                aria-label="Remove Preview"
              >
                &#10006;
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !displayPreview && currentImage && !markedForDeletion && (
        <div className="flex justify-center">
          <div className="relative rounded-lg border border-gray-200 bg-white p-3 sm:p-4 flex flex-col items-center w-full max-w-xs">
            {/* Image Preview */}
            <div className="relative w-full max-w-[12rem] sm:max-w-[14rem] aspect-[3/2] flex items-center justify-center rounded-md mb-2">
              <img
                src={currentImage.image_url}
                alt={imageType === 'logo' ? 'Company Logo' : 'Login Page Image'}
                className="w-full h-full object-contain rounded-md"
              />
              
              {/* Remove/Delete Button */}
              <button
                type="button"
                onClick={handleMarkForDeletion}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shadow-lg hover:bg-red-600 transition-all z-10 text-sm sm:text-base"
                aria-label="Mark for Deletion"
              >
                &#10006;
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageBox
        message={modalMessage.message}
        error={modalMessage.error}
        clearMessage={handleClearMessage}
      />
    </>
  );
};

CompanyImageTable.propTypes = {
  images: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      image_type: PropTypes.string.isRequired,
      image_url: PropTypes.string,
      is_active: PropTypes.bool,
      created_at: PropTypes.string,
    })
  ),
  allImages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      image_type: PropTypes.string.isRequired,
      image_url: PropTypes.string,
      is_active: PropTypes.bool,
      created_at: PropTypes.string,
    })
  ),
  imageType: PropTypes.oneOf(['logo', 'login_image']).isRequired,
  isLoading: PropTypes.bool,
  onUploadClick: PropTypes.func,
  previewUrl: PropTypes.string,
  onRemovePreview: PropTypes.func,
  markedForDeletion: PropTypes.bool,
  onMarkForDeletion: PropTypes.func,
};

export default CompanyImageTable;

