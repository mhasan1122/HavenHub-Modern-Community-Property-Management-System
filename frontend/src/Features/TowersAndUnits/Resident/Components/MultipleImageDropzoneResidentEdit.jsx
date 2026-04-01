import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";
import { FaCloudUploadAlt } from "react-icons/fa";

const acceptedFileTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf"
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MultipleImageDropzoneResidentEdit = ({ onUpload, initialFiles = [], onRemove }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const prevInitialFilesRef = useRef(null);

  // Initialize with existing files - sync with initialFiles prop
  useEffect(() => {
    // Create a stable key for comparison
    const currentKey = JSON.stringify((initialFiles || []).map(f => ({ 
      id: f.id, 
      name: f.name, 
      isExisting: f.isExisting,
      size: f.size 
    })));
    
    // Only update if initialFiles actually changed
    if (prevInitialFilesRef.current !== currentKey) {
      prevInitialFilesRef.current = currentKey;
      
      const newFiles = (initialFiles || []).map((file) => {
        // Preserve all properties including uploadId for new files
        const fileObj = {
          ...file,
          preview: file.isExisting
            ? file.url
            : (file.preview || (file.type?.startsWith("image/") && file instanceof File
              ? URL.createObjectURL(file)
              : null)),
          // Ensure type is set for existing files if missing
          type: file.type || (file.url?.match(/\.(jpeg|jpg|png)$/i) ? "image/jpeg" : "application/pdf"),
        };
        // Explicitly preserve uploadId if it exists (for new files)
        if (file.uploadId) {
          fileObj.uploadId = file.uploadId;
        }
        return fileObj;
      });
      
      setFiles(newFiles);
    }
  }, [initialFiles]);

  const onDrop = useCallback(
    (acceptedFiles) => {
      // Validate file types
      const validTypeFiles = acceptedFiles.filter((file) =>
        acceptedFileTypes.includes(file.type)
      );
      if (validTypeFiles.length !== acceptedFiles.length) {
        setError("Only PDF, PNG, JPG, and JPEG files are allowed.");
        return;
      }

      // Validate file sizes
      const sizeValidFiles = validTypeFiles.filter((file) => file.size <= MAX_FILE_SIZE);
      if (sizeValidFiles.length !== validTypeFiles.length) {
        setError("Files larger than 5MB are not allowed.");
        return;
      }

      setError(""); // Clear any previous errors

      // Create preview for images (and placeholder for PDFs)
      const newFiles = sizeValidFiles.map((file) => {
        const fileWithMetadata = Object.assign(file, {
          preview: file.type === "application/pdf" ? null : URL.createObjectURL(file),
          isExisting: false,
          // Add a unique identifier for new files to help with removal
          uploadId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        return fileWithMetadata;
      });

      setFiles((prev) => [...prev, ...newFiles]);
      onUpload(newFiles);
    },
    [onUpload]
  );

  const removeFile = useCallback(
    (index) => {
      const fileToRemove = files[index];
      
      // Update local state immediately for better UX
      setFiles((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        return updated;
      });

      // Call parent's onRemove handler to update form state
      if (onRemove) {
        onRemove(fileToRemove);
      }

      // Clean up object URL for new files
      if (!fileToRemove.isExisting && fileToRemove.preview && fileToRemove.preview.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
    },
    [files, onRemove]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptedFileTypes.join(","),
    onDrop,
    multiple: true,
  });

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (!file.isExisting && file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-dashed border rounded-lg p-6 cursor-pointer text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[200px] ${isDragActive ? "border-primary bg-surfaceTeal" : "border-gray-300"}`}
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
        {files.map((file, index) => (
          <div key={file.isExisting ? `existing-${file.id}` : `new-${file.uploadId || file.name}-${index}`} className="relative">
            {(file.type?.startsWith("image/") && file.preview) ? (
              <img
                src={file.preview}
                alt="Preview"
                className="w-full h-32 object-cover rounded-md"
              />
            ) : (
              <div className="w-full h-32 flex items-center justify-center bg-gray-200 rounded-md">
                <p className="text-sm text-gray-600">PDF File</p>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFile(index);
              }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultipleImageDropzoneResidentEdit;
