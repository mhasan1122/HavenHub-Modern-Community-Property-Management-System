// File: FileDropzone.jsx
import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FaTimes, FaCloudUploadAlt } from "react-icons/fa";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const normalizeUrl = (path) => {
  if (!path) return "";
  
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it starts with a slash, it's a relative path from the base URL
  if (path.startsWith('/')) {
    const trimmedBase = baseURL.replace(/\/+$/, "");
    return `${trimmedBase}${path}`;
  }
  
  // Otherwise, construct the full URL
  const trimmedBase = baseURL.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
};

const FileDropzone = ({
  onDrop,
  files = [],
  docLinks = [],
  onRemove,
  onUpdate,
  onImageError,
  disabled = false,
  readOnly = false,
  showRemoveButton = true,
  showUploadButton = true,
  showDropzone = true,
  hideDropzoneMessage = false
}) => {
  const [fileError, setFileError] = useState("");
  const [objectUrls, setObjectUrls] = useState(new Map());
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const clearError = () => setTimeout(() => setFileError(""), 5000);

  // Use ref to track object URLs to avoid stale closure issues
  const objectUrlsRef = React.useRef(new Map());

  // Clean up object URLs when component unmounts
  useEffect(() => {
    const urlsRef = objectUrlsRef;
    return () => {
      urlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      urlsRef.current.clear();
    };
  }, []);

  // Manage object URLs for file previews
  useEffect(() => {
    if (!files || files.length === 0) {
      // Clean up all existing URLs if no files
      objectUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
      setObjectUrls(new Map());
      return;
    }

    const newObjectUrls = new Map();
    
    files.forEach((file, index) => {
      if (file instanceof File && file.type.startsWith('image/')) {
        // Reuse existing URL if the file is the same object
        const existingUrl = objectUrlsRef.current.get(index);
        if (existingUrl && objectUrlsRef.current.get(`file_${index}`) === file) {
          newObjectUrls.set(index, existingUrl);
          newObjectUrls.set(`file_${index}`, file);
        } else {
          const url = URL.createObjectURL(file);
          newObjectUrls.set(index, url);
          newObjectUrls.set(`file_${index}`, file);
        }
      }
    });

    // Clean up old URLs that are no longer needed
    objectUrlsRef.current.forEach((url, key) => {
      if (typeof key === 'number' && !newObjectUrls.has(key)) {
        URL.revokeObjectURL(url);
      }
    });

    objectUrlsRef.current = newObjectUrls;
    setObjectUrls(new Map(newObjectUrls));
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".gif"]
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled: disabled || readOnly,
    onDrop: (acceptedFiles) => {
      const validFiles = acceptedFiles.filter(
        (file) => file.size <= MAX_FILE_SIZE
      );
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE
      );

      if (oversizedFiles.length > 0) {
        setFileError("File size must not exceed 5MB.");
        clearError();
      }

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    },
    onDropRejected: (fileRejections) => {
      const oversized = fileRejections.some((rejection) =>
        rejection.errors.some((err) => err.code === "file-too-large")
      );
      setFileError(
        oversized ? "File size must not exceed 5MB." : "Invalid file type."
      );
      clearError();
    }
  });

  const isImage = (file) => file?.type?.startsWith("image/");

  const handleFileUpdate = (idx, event) => {
    if (disabled || readOnly) return;

    const file = event.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size must not exceed 5MB.");
      clearError();
      return;
    }

    onUpdate(idx, file);
  };

  return (
    <div className="w-full">
      {showDropzone && (
        <div
          {...getRootProps()}
          className={`border-dashed border rounded-lg p-6 w-full ${!disabled && !readOnly ? "cursor-pointer" : "cursor-default"
            } text-center transition-all duration-200 flex flex-col items-center justify-center ${
            isDragActive 
              ? "border-primary bg-surfaceTeal shadow-ring-primary" 
              : "border-borderSecondary bg-stroke hover:border-borderMid hover:bg-white focus-within:border-primary focus-within:bg-white focus-within:shadow-ring-primary"
            }`}
        >
          <input {...getInputProps()} />
          {!hideDropzoneMessage && (
            <>
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-3">
                <FaCloudUploadAlt className="text-white text-2xl" />
              </div>
              <p className="text-sm text-gray-900 font-medium">
                Upload Document
              </p>
            </>
          )}
        </div>
      )}

      {(files.length > 0 || docLinks.length > 0) && (
        <div className={`mt-4 grid grid-cols-5 gap-2 ${!showDropzone ? 'mt-0' : ''}`}>
          {files.map((file, idx) => (
            <div
              key={idx}
              className="relative p-1 border rounded shadow-sm text-left text-xs"
            >
              {showRemoveButton && !disabled && !readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(idx, "file");
                  }}
                  className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:bg-red-100 z-10"
                >
                  <FaTimes className="text-red-500 text-xs" />
                </button>
              )}

              {isImage(file) ? (
                <img
                  src={objectUrls.get(idx) || ''}
                  alt={file.name}
                  className="w-full h-[80px] object-cover rounded mb-1"
                />
              ) : (
                <p className="truncate mt-4 pl-2 text-xs">📄 {file.name}</p>
              )}
            </div>
          ))}

          {docLinks.map((linkObj, idx) => {
            
            // Handle different formats of linkObj
            let url = "";
            if (typeof linkObj === 'string') {
              url = linkObj;
            } else if (linkObj && typeof linkObj === 'object') {
              url = linkObj.url || linkObj;
            }
            
            const fullLink = normalizeUrl(url);
            const isImageLink = /\.(jpeg|jpg|png|gif)$/i.test(fullLink);

            return (
              <div
                key={`link-${idx}`}
                className="relative p-1 border rounded shadow-sm text-left text-xs"
              >
                {showRemoveButton && !disabled && !readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(idx, "docLink");
                    }}
                    className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:bg-red-100 z-10"
                  >
                    <FaTimes className="text-red-500 text-xs" />
                  </button>
                )}

                <div className="relative">
                  {isImageLink ? (
                    <img
                      src={fullLink}
                      alt={`doc-${idx}`}
                      className="w-full h-[80px] object-cover rounded mb-1"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const placeholder = e.target.parentNode.querySelector('.image-placeholder');
                        if (placeholder) {
                          placeholder.style.display = 'flex';
                        }
                        // Call the error handler if provided
                        if (onImageError) {
                          onImageError(fullLink);
                        }
                      }}
                    />
                  ) : (
                    <a
                      href={fullLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-blue-600 hover:underline mt-4 pl-2 text-xs"
                    >
                      📎 {fullLink.split("/").pop() || "Document"}
                    </a>
                  )}

                  {/* Placeholder for failed images */}
                  <div 
                    className="image-placeholder hidden w-full h-[80px] bg-gray-100 border-2 border-dashed border-gray-300 rounded mb-1 flex items-center justify-center text-gray-500 text-xs"
                    style={{ display: 'none' }}
                  >
                    <div className="text-center">
                      <div className="text-lg mb-1">📄</div>
                      <div>File not found</div>
                    </div>
                  </div>

                  {showUploadButton && !disabled && !readOnly && (
                    <input
                      type="file"
                      onChange={(e) => handleFileUpdate(idx, e)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.jpg,.jpeg,.png,.gif"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {fileError && (
        <div className="mt-3 p-2 bg-red-100 text-red-700 border border-red-300 rounded text-sm">
          {fileError}
        </div>
      )}
    </div>
  );
};

export default FileDropzone;
