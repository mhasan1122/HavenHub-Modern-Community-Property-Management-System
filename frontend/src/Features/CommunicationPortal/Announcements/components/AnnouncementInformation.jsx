import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import FileUpload from './FileUpload';

/**
 * AnnouncementInformation Component
 * Handles title, description, and attachments
 */
const AnnouncementInformation = ({ control, errors, setValue, watch }) => {
  const [titleWordCount, setTitleWordCount] = useState(0);
  const [descriptionWordCount, setDescriptionWordCount] = useState(0);

  const attachments = watch('attachments') || [];

  // Count words in text
  const countWords = (text) => {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  };

  // Handle title change
  const handleTitleChange = (value, onChange) => {
    if (!value || value.trim() === '') {
      setTitleWordCount(0);
      onChange('');
      return;
    }

    const words = value.trim().split(/\s+/);
    if (words.length <= 10) {
      setTitleWordCount(words.length);
      onChange(value);
    } else {
      // Limit to first 10 words
      const limited = words.slice(0, 10).join(' ');
      setTitleWordCount(10);
      onChange(limited);
    }
  };

  // Handle description change
  const handleDescriptionChange = (value, onChange) => {
    const wordCount = countWords(value);
    setDescriptionWordCount(wordCount);
    onChange(value);
  };

  // Handle file upload
  const handleFileUpload = (newFiles) => {
    const updatedAttachments = [...attachments, ...newFiles];
    setValue('attachments', updatedAttachments);
  };

  // Handle file removal
  const handleFileRemove = (indexToRemove) => {
    const updatedAttachments = attachments.filter((_, index) => index !== indexToRemove);
    setValue('attachments', updatedAttachments);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Title <span className="text-primary">*</span>
        </label>
        <Controller
          name="title"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div>
              <input
                type="text"
                value={value}
                onChange={(e) => handleTitleChange(e.target.value, onChange)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter announcement title..."
                maxLength={200} // Reasonable character limit
              />
              <div className="flex justify-between items-center mt-1">
                <div>
                  {errors.title && (
                    <p className="text-sm text-red-600">{errors.title.message}</p>
                  )}
                </div>
                <p className={`text-xs ${titleWordCount > 10 ? 'text-red-500' : 'text-gray-500'}`}>
                  {titleWordCount}/10 words
                </p>
              </div>
            </div>
          )}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Description <span className="text-primary">*</span>
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div>
              <textarea
                value={value}
                onChange={(e) => handleDescriptionChange(e.target.value, onChange)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-vertical"
                placeholder="Enter announcement description..."
                maxLength={1000} // Reasonable character limit
              />
              <div className="flex justify-between items-center mt-1">
                <div>
                  {errors.description && (
                    <p className="text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>
                <p className={`text-xs ${descriptionWordCount > 100 ? 'text-red-500' : 'text-gray-500'}`}>
                  {descriptionWordCount}/100 words
                </p>
              </div>
            </div>
          )}
        />
      </div>

      {/* Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Attachments
        </label>
        <FileUpload
          files={attachments}
          onUpload={handleFileUpload}
          onRemove={handleFileRemove}
          maxFiles={5}
          acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/gif']}
          maxFileSize={5 * 1024 * 1024} // 5MB
        />
        <p className="text-xs text-gray-500 mt-2">
          You can upload up to 5 images (PNG, JPG, JPEG, GIF). Maximum file size: 5MB each.
        </p>
      </div>
    </div>
  );
};

export default AnnouncementInformation;
