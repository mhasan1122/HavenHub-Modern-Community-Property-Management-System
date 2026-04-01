import React, { useRef } from 'react';
import { FaUpload, FaTimes, FaFile, FaImage, FaFilePdf, FaFileWord } from 'react-icons/fa';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';
import { formatFileSize } from '../utils/bulletinUtils';

/**
 * FileUpload Component
 * Handles file upload for bulletin attachments
 */
const FileUpload = ({
  attachments = [],
  onFileUpload,
  onRemoveAttachment,
  fileUploadError,
  isEditing = false,
  attachmentsToDelete = []
}) => {
  const fileInputRef = useRef(null);

  // Get file icon based on file type
  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) {
      return <FaImage className="w-4 h-4 text-blue-600" />;
    } else if (fileType === 'application/pdf') {
      return <FaFilePdf className="w-4 h-4 text-red-600" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FaFileWord className="w-4 h-4 text-blue-600" />;
    }
    return <FaFile className="w-4 h-4 text-gray-600" />;
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFileUpload(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Handle remove attachment
  const handleRemove = (index, attachmentId = null) => {
    onRemoveAttachment(index, attachmentId);
  };

  // Check if attachment is marked for deletion
  const isMarkedForDeletion = (attachmentId) => {
    return attachmentId && attachmentsToDelete.includes(attachmentId);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <FaUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-1">
          Click to upload or drag and drop files here
        </p>
        <p className="text-xs text-gray-500">
          Supported: Images (JPG, PNG, GIF), PDF, Word documents (max 10MB each)
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {fileUploadError && <ErrorMessage message={fileUploadError} />}

      {/* Attached Files List */}
      {attachments && attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Attached Files ({attachments.length})
          </h4>
          
          <div className="space-y-2">
            {attachments.map((attachment, index) => {
              const isExisting = attachment.id; // Existing attachments have IDs
              const isDeleted = isMarkedForDeletion(attachment.id);
              
              return (
                <div
                  key={attachment.id || index}
                  className={`flex items-center gap-3 p-3 border rounded-lg ${
                    isDeleted 
                      ? 'bg-red-50 border-red-200 opacity-50' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {getFileIcon(attachment.file_type || attachment.type)}
                  </div>
                  
                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isDeleted ? 'text-red-600 line-through' : 'text-gray-900'
                    }`}>
                      {attachment.file_name || attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.file_size || attachment.size)}
                      {isExisting && !isDeleted && (
                        <span className="ml-2 text-blue-600">• Uploaded</span>
                      )}
                      {!isExisting && (
                        <span className="ml-2 text-green-600">• New</span>
                      )}
                      {isDeleted && (
                        <span className="ml-2 text-red-600">• Will be deleted</span>
                      )}
                    </p>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(index, attachment.id)}
                    className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
                      isDeleted
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-100'
                        : 'text-red-600 hover:text-red-700 hover:bg-red-100'
                    }`}
                    title={isDeleted ? 'Restore file' : 'Remove file'}
                  >
                    {isDeleted ? (
                      <span className="text-sm">↶</span>
                    ) : (
                      <FaTimes className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Guidelines */}
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>File Guidelines:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Maximum file size: 10MB per file</li>
          <li>Supported formats: JPG, PNG, GIF, PDF, DOC, DOCX</li>
          <li>You can upload multiple files at once</li>
          {isEditing && (
            <li>Changes will be saved when you update the bulletin</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;
