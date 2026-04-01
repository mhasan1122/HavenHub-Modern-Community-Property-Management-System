import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image } from 'lucide-react';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

// Utility function to convert file to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

/**
 * FileUpload Component
 * Handles multiple image uploads with drag and drop functionality
 * Similar to UnitGeneralInfo file upload
 */
const FileUpload = ({
  files = [],
  onUpload,
  onRemove,
  maxFiles = 5,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
  maxFileSize = 100 * 1024 * 1024 // 5MB
}) => {
  const [error, setError] = useState('');

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setError('');

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File size must be less than 10MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Only image files (PNG, JPG, JPEG, GIF) are allowed');
      } else {
        setError('File upload failed');
      }
      return;
    }

    // Check total file count
    if (files.length + acceptedFiles.length > maxFiles) {
      setError('Please upload five photos to proceed.');
      return;
    }

    try {
      // Process accepted files and convert to base64
      const processedFiles = await Promise.all(
        acceptedFiles.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            file,
            preview: base64, // Use base64 instead of blob URL
            base64: base64,  // Store base64 for saving
            name: file.name,
            size: file.size,
            type: file.type,
            id: Date.now() + Math.random() // Simple ID generation
          };
        })
      );

      onUpload(processedFiles);
    } catch (error) {
      console.error('Error processing files:', error);
      setError('Failed to process files');
    }
  }, [files.length, maxFiles, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {}),
    maxSize: maxFileSize,
    multiple: true
  });

  // Handle file removal
  const handleRemove = (indexToRemove) => {
    // No need to revoke URLs since we're using base64
    onRemove(indexToRemove);
  };

  // Clear error after 5 seconds
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-primary hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {isDragActive ? 'Drop files here' : 'Upload Document'}
            </p>
            <p className="text-xs text-gray-500">
              Drag & drop files here, or click to select
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      <ErrorMessage message={error} />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploaded Files ({files.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map((file, index) => (
              <div
                key={file.id || index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border"
              >
                {/* File Preview */}
                <div className="flex-shrink-0">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
