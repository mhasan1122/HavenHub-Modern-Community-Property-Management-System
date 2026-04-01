import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus } from 'react-icons/fa';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

/**
 * LabelSelector Component
 * Allows adding and managing multiple labels for bulletins
 */
const LabelSelector = ({
  register,
  errors,
  watch,
  setValue,
  trigger,
  labelError,
  isEditing = false,
  bulletin = null
}) => {
  const [labels, setLabels] = useState([]);
  const [currentLabel, setCurrentLabel] = useState('');
  const [labelErrors, setLabelErrors] = useState([]);

  // Initialize labels from bulletin data when editing
  useEffect(() => {
    if (isEditing && bulletin?.label) {
      const existingLabels = bulletin.label.split(',').map(l => l.trim()).filter(l => l);
      setLabels(existingLabels);
      setValue('label', existingLabels.join(', '));
    }
  }, [isEditing, bulletin, setValue]);

  // Update form value when labels change
  useEffect(() => {
    const labelString = labels.join(', ');
    setValue('label', labelString);
    trigger('label');
  }, [labels, setValue, trigger]);

  // Validate individual label
  const validateLabel = (label) => {
    const errors = [];
    
    // Check for emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    if (emojiRegex.test(label)) {
      errors.push('Labels cannot contain emojis');
    }
    
    // Check word count (max 10 words per label)
    const wordCount = label.trim().split(/\s+/).length;
    if (wordCount > 10) {
      errors.push('Each label must be 10 words or less');
    }
    
    // Check if label already exists
    if (labels.includes(label.trim())) {
      errors.push('This label already exists');
    }
    
    return errors;
  };

  // Add new label
  const addLabel = () => {
    const trimmedLabel = currentLabel.trim();
    
    if (!trimmedLabel) return;
    
    // Check maximum labels limit
    if (labels.length >= 10) {
      setLabelErrors(['Maximum 10 labels allowed']);
      return;
    }
    
    // Validate label
    const validationErrors = validateLabel(trimmedLabel);
    if (validationErrors.length > 0) {
      setLabelErrors(validationErrors);
      return;
    }
    
    // Check total character limit
    const newLabelString = [...labels, trimmedLabel].join(', ');
    if (newLabelString.length > 200) {
      setLabelErrors(['Total label length cannot exceed 200 characters']);
      return;
    }
    
    // Add label
    setLabels(prev => [...prev, trimmedLabel]);
    setCurrentLabel('');
    setLabelErrors([]);
  };

  // Remove label
  const removeLabel = (index) => {
    setLabels(prev => prev.filter((_, i) => i !== index));
    setLabelErrors([]);
  };

  // Handle input key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel();
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    setCurrentLabel(e.target.value);
    setLabelErrors([]);
  };

  return (
    <div className="space-y-3">
      {/* Input for new label */}
      <div className="flex gap-2">
        <input
          type="text"
          value={currentLabel}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Add a label..."
          className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            labelErrors.length > 0 ? 'border-red-500' : 'border-gray-300'
          }`}
          maxLength={50}
        />
        <button
          type="button"
          onClick={addLabel}
          disabled={!currentLabel.trim() || labels.length >= 10}
          className={`px-3 py-2 rounded-lg flex items-center gap-1 ${
            currentLabel.trim() && labels.length < 10
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <FaPlus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Current labels display */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map((label, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm"
            >
              <span>{label}</span>
              <button
                type="button"
                onClick={() => removeLabel(index)}
                className="text-blue-600 hover:text-blue-800"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Label count and character count */}
      {/* <div className="text-xs text-gray-500 flex justify-between">
        <span>{labels.length}/10 labels</span>
        <span>{labels.join(', ').length}/200 characters</span>
      </div> */}

      {/* Error messages */}
      {labelErrors.length > 0 && (
        <div className="space-y-1">
          {labelErrors.map((error, index) => (
            <ErrorMessage key={index} message={error} />
          ))}
        </div>
      )}
      
      {(errors.label || labelError) && (
        <ErrorMessage message={errors.label?.message || labelError} />
      )}

      {/* Hidden input for form validation */}
      <input type="hidden" {...register('label')} />

      {/* Help text */}
      <div className="text-xs text-gray-500">
        Press Enter or click Add to add a label. Maximum 10 labels, 10 words per label.
      </div>
    </div>
  );
};

export default LabelSelector;
