
import React, { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";
import { FaCloudUploadAlt } from "react-icons/fa";

const acceptedFileTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf"
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MultipleImageDropzoneResident = ({ onUpload, files: propFiles, onRemove }) => {
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");

  // Generate previews when files change
  useEffect(() => {
    const newPreviews = propFiles.map(file => {
      if (file instanceof File) {
        return file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      } else {
        return file; // Assume existing URL
      }
    });
    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach(preview => {
        if (preview && preview.startsWith('blob:')) {
          URL.revokeObjectURL(preview);
        }
      });
    };
  }, [propFiles]);

  const handleDrop = useCallback((acceptedFiles) => {
    setError("");
    const validFiles = acceptedFiles.filter(file => 
      acceptedFileTypes.includes(file.type) && file.size <= MAX_FILE_SIZE
    );
    
    if (validFiles.length !== acceptedFiles.length) {
      setError("Invalid files: Only PDF/Images under 5MB allowed.");
      return;
    }
    
    onUpload(validFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptedFileTypes.reduce((acc, cur) => ({ ...acc, [cur]: [] }), {}),
    onDrop: handleDrop,
    multiple: true,
    maxSize: MAX_FILE_SIZE
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-dashed border rounded-lg p-6 cursor-pointer text-center transition-all duration-200 flex flex-col items-center justify-center ${isDragActive ? "border-primary bg-surfaceTeal" : "border-gray-300"}`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-3">
          <FaCloudUploadAlt className="text-white text-2xl" />
        </div>
        <p className="text-sm text-gray-900 font-medium">
          Upload Document
        </p>
      </div>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <div className="mt-4 grid grid-cols-3 gap-4">
        {propFiles.map((file, index) => {
          const preview = previews[index];
          return (
            <div key={index} className="relative">
              {preview ? (
                preview.startsWith('blob:') || 
                typeof preview === 'string' ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-md"
                  />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center bg-gray-200 rounded-md">
                    <p className="text-sm text-gray-600">PDF File</p>
                  </div>
                )
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-gray-200 rounded-md">
                  <p className="text-sm text-gray-600">PDF File</p>
                </div>
              )}
              <button
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultipleImageDropzoneResident;
