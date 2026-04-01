import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaUpload, FaTimes, FaImage, FaFilePdf } from 'react-icons/fa';

// Utility function to convert file to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Helper function to check if file is a PDF
const isPDF = (fileName, fileType) => {
  if (fileType) {
    return fileType === 'application/pdf';
  }
  return fileName?.toLowerCase().endsWith('.pdf');
};

// Helper function to get file icon
const getFileIcon = (fileName, fileType) => {
  if (isPDF(fileName, fileType)) {
    return <FaFilePdf className="w-8 h-8 text-red-600" />;
  }
  return <FaImage className="w-8 h-8 text-blue-600" />;
};

/**
 * FileUpload Component for Notice Board
 * Handles multiple file uploads with drag and drop functionality
 * Supports both image files and PDFs for notices
 */
const FileUpload = ({
  onFilesChange,
  maxFiles = 10,
  acceptedTypes = ['image/*', '.pdf'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  existingAttachments = [],
  onRemoveExisting,
  error
}) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setUploadError('');

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setUploadError('File size must be less than 10MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setUploadError('Only image files and PDFs are allowed');
      } else {
        setUploadError('File upload failed');
      }
      return;
    }

    // Check total file count (including existing)
    const totalFiles = existingAttachments.length + uploadedFiles.length + acceptedFiles.length;
    if (totalFiles > maxFiles) {
      setUploadError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    try {
      // Process accepted files and convert to base64
      const processedFiles = await Promise.all(
        acceptedFiles.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            file,
            preview: base64,
            base64: base64,
            name: file.name,
            size: file.size,
            type: file.type,
            id: Date.now() + Math.random()
          };
        })
      );

      const newFiles = [...uploadedFiles, ...processedFiles];
      setUploadedFiles(newFiles);
      onFilesChange(newFiles.map(f => f.file));
    } catch (error) {
      console.error('Error processing files:', error);
      setUploadError('Failed to process files');
    }
  }, [uploadedFiles, maxFiles, onFilesChange, existingAttachments.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.heif', '.svg'],
      'application/pdf': ['.pdf']
    },
    maxSize: maxFileSize,
    multiple: true
  });

  // Handle file removal
  const handleRemoveUploaded = (indexToRemove) => {
    const newFiles = uploadedFiles.filter((_, index) => index !== indexToRemove);
    setUploadedFiles(newFiles);
    onFilesChange(newFiles.map(f => f.file));
  };

  // Clear error after 5 seconds
  React.useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => setUploadError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);

  const totalFiles = existingAttachments.length + uploadedFiles.length;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${error ? 'border-red-300 bg-red-50' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
            <FaUpload className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {isDragActive ? 'Drop files here' : 'Upload Files'}
            </p>
            <p className="text-xs text-gray-500">
              Drag & drop images and PDFs here, or click to select
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Maximum {maxFiles} files, up to 10MB each
            </p>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {(uploadError || error) && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {uploadError || error}
        </div>
      )}

      {/* File Count */}
      {totalFiles > 0 && (
        <div className="text-sm text-gray-600">
          {totalFiles} of {maxFiles} images selected
        </div>
      )}

      {/* Existing Attachments */}
      {existingAttachments.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Files</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {existingAttachments.map((attachment) => (
              <div key={attachment.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {isPDF(attachment.file_name, attachment.file_type) ? (
                    <div className="flex flex-col items-center">
                      <FaFilePdf className="w-8 h-8 text-red-600 mb-1" />
                      <span className="text-xs text-gray-600 text-center px-1">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveExisting(attachment.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {attachment.file_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">New Files</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {uploadedFiles.map((file, index) => (
              <div key={file.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {isPDF(file.name, file.type) ? (
                    <div className="flex flex-col items-center">
                      <FaFilePdf className="w-8 h-8 text-red-600 mb-1" />
                      <span className="text-xs text-gray-600 text-center px-1">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUploaded(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalFiles === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FaImage className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No files selected</p>
          <p className="text-xs">Upload images or PDFs to create a notice</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
