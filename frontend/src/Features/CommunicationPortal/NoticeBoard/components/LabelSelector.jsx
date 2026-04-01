import React, { useState, useEffect } from 'react';
import { Plus, Tag, ChevronDown, X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { fetchLabels } from '../../../../redux/slices/api/noticeApi';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

// Emoji validation function
const containsEmoji = (text) => {
  if (!text) return false;
  // Regex to detect emojis including various Unicode ranges
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/u;
  return emojiRegex.test(text);
};

/**
 * LabelSelector Component
 * Handles creating new labels with text input and selecting from existing ones
 * Now fetches labels from the database instead of localStorage
 */
const LabelSelector = ({ value, onChange, error }) => {
  const dispatch = useDispatch();
  const [newLabelName, setNewLabelName] = useState('');
  const [existingLabels, setExistingLabels] = useState([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [emojiError, setEmojiError] = useState('');
  const [labelLimitError, setLabelLimitError] = useState('');
  const [characterLimitError, setCharacterLimitError] = useState('');
  const [labelCharacterLimitError, setLabelCharacterLimitError] = useState('');
  const [wordLimitError, setWordLimitError] = useState('');
  const [duplicateLabelError, setDuplicateLabelError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);

  // Debug when value changes
  useEffect(() => {
    console.log('🏷️ LabelSelector - Value changed:', { value, type: typeof value });
  }, [value]);

  // Helper function to count words in a single label
  const countWordsInLabel = (label) => {
    if (!label || label.trim() === '') return 0;
    const words = label.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };

  // Load labels from database
  const loadExistingLabels = async () => {
    setIsLoadingLabels(true);
    try {
      const result = await dispatch(fetchLabels()).unwrap();

      // Ensure we have unique labels and filter out any empty ones
      const uniqueLabels = [...new Set(result.filter(label => label && label.trim()))];

      // Convert string labels to objects with id and name for consistency
      const labelObjects = uniqueLabels.map((labelName, index) => ({
        id: `db-label-${index}-${labelName}`,
        name: labelName.trim(),
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
      }));
      setExistingLabels(labelObjects);
    } catch (error) {
      console.error('Error loading labels from database:', error);
      setExistingLabels([]);
    } finally {
      setIsLoadingLabels(false);
    }
  };

  // Load existing labels on component mount
  useEffect(() => {
    loadExistingLabels();
  }, [dispatch]);

  // Reload labels when dropdown opens to ensure we have the latest data
  useEffect(() => {
    if (isDropdownOpen) {
      loadExistingLabels();
    }
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.label-selector-dropdown')) {
        setIsDropdownOpen(false);
        setShowCreateInput(false);
        setNewLabelName('');
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Auto-clear validation errors when conditions are met
  useEffect(() => {
    if (value) {
      const currentLabels = value.split(',').map(l => l.trim()).filter(l => l.length > 0);

      // Only clear label limit error if we're significantly under the limit
      if (currentLabels.length <= 8 && labelLimitError) {
        setLabelLimitError('');
      }

      // Only clear character limit error if we're significantly under the limit
      if (value.length <= 450 && characterLimitError) {
        setCharacterLimitError('');
      }

      // Clear individual label character limit error only when no labels are too long
      const hasLongCharacterLabel = currentLabels.some(label => label.length > 50);
      if (!hasLongCharacterLabel && labelCharacterLimitError) {
        setLabelCharacterLimitError('');
      }

      // Clear word limit error only when no labels have too many words
      const hasLongLabel = currentLabels.some(label => countWordsInLabel(label) > 10);
      if (!hasLongLabel && wordLimitError) {
        setWordLimitError('');
      }
    } else {
      // Clear all errors if no labels are selected
      setLabelLimitError('');
      setCharacterLimitError('');
      setLabelCharacterLimitError('');
      setWordLimitError('');
      setDuplicateLabelError('');
      setEmojiError('');
    }
  }, [value, labelLimitError, characterLimitError, labelCharacterLimitError, wordLimitError]);

  // Handle selecting existing label
  const handleSelectLabel = (labelName) => {
    console.log('🏷️ LabelSelector - handleSelectLabel called:', { labelName, currentValue: value });
    
    if (!value) {
      console.log('🏷️ LabelSelector - Setting first label:', labelName);
      onChange(labelName);
      return;
    }

    const currentLabels = value.split(',').map(l => l.trim());

    if (currentLabels.includes(labelName)) {
      // Remove the label
      const newLabels = currentLabels.filter(l => l !== labelName);
      const newValue = newLabels.join(', ');
      console.log('🏷️ LabelSelector - Removing label:', { labelName, newValue });
      onChange(newValue);

      // Clear errors when removing labels since requirements might now be met
      setLabelLimitError('');
      setCharacterLimitError('');
      setLabelCharacterLimitError('');
      setWordLimitError('');
      setDuplicateLabelError('');
    } else {
      // Check for duplicate label (case-insensitive)
      const labelExists = currentLabels.some(
        label => label.toLowerCase() === labelName.toLowerCase()
      );
      if (labelExists) {
        setDuplicateLabelError('Label already exists!');
        return;
      }

      // Check if adding this label would exceed limits
      const testLabels = [...currentLabels, labelName];
      const testString = testLabels.join(', ');

      // Check label count limit
      if (testLabels.length > 10) {
        setLabelLimitError('Maximum 10 labels allowed. Please remove a label before adding a new one.');
        return;
      }

      // Check character limit
     if (testString.length > 500) {
        // Calculate remaining characters more accurately
        // Account for the fact that we're adding a new label with comma and space
        const currentLabels = value ? value.split(',').map(l => l.trim()).filter(l => l.length > 0) : [];
        const currentLength = value ? value.length : 0;
        const newLabelLength = labelName.length;
        const separatorLength = currentLabels.length > 0 ? 2 : 0; // ", " for separator
        const remainingChars = 500 - currentLength - newLabelLength - separatorLength;
        setCharacterLimitError(`Adding this label would exceed the 500-character limit. You can only add ${Math.max(0, remainingChars)} more characters.`);
        return;
      }

      // If all checks pass, add the label
      console.log('🏷️ LabelSelector - Adding label:', { labelName, newValue: testString });
      onChange(testString);
    }
  };

  // Handle creating new label
  const handleCreateLabel = async () => {
    console.log('🏷️ LabelSelector - handleCreateLabel called:', { newLabelName, currentValue: value });
    
    if (!newLabelName.trim()) return;

    // Clear previous errors
    setEmojiError('');
    setLabelLimitError('');
    setCharacterLimitError('');
    setLabelCharacterLimitError('');
    setWordLimitError('');
    setDuplicateLabelError('');

    // Check for emojis
    if (containsEmoji(newLabelName.trim())) {
      setEmojiError('Labels cannot contain emojis');
      return;
    }

    // Check individual label length
    if (newLabelName.trim().length > 50) {
      setLabelCharacterLimitError('Each label cannot exceed 50 characters. Please use fewer characters.');
      return;
    }

    // Check word count for the new label
    const labelWordCount = countWordsInLabel(newLabelName.trim());
    if (labelWordCount > 10) {
      setWordLimitError('Each label cannot exceed 10 words. Please use fewer words.');
      return;
    }

    // Check for duplicate label (case-insensitive)
    const labelExists = existingLabels.some(
      label => label.name.toLowerCase() === newLabelName.trim().toLowerCase()
    );
    if (labelExists) {
      setDuplicateLabelError('Label already exists!');
      return;
    }

    // Get current labels
    const currentLabels = value ? value.split(',').map(l => l.trim()).filter(l => l.length > 0) : [];

    // Check label count limit (10 labels)
    if (currentLabels.length >= 10) {
      setLabelLimitError('Maximum 10 labels allowed. Please remove a label before adding a new one.');
      return;
    }

    // Calculate what the new value would be
    const testLabels = [...currentLabels, newLabelName.trim()];
    const testString = testLabels.join(', ');

    // Check total character limit (500 characters)
    if (testString.length > 500) {
      const remainingChars = 500 - (value ? value.length : 0);
      setCharacterLimitError(`Adding this label would exceed the 500-character limit. You can only add ${remainingChars} more characters.`);
      return;
    }

    // If all validations pass, create the label
    setIsCreatingLabel(true);
    try {
      console.log('🏷️ LabelSelector - Creating new label:', { newValue: testString });
      onChange(testString);

      // Add to local state for immediate UI feedback
      const newLabel = {
        id: `temp-label-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: newLabelName.trim(),
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
      };
      setExistingLabels(prev => [...prev, newLabel]);

      setNewLabelName('');
      setShowCreateInput(false);
    } catch (error) {
      console.error('Error creating label:', error);
    } finally {
      setIsCreatingLabel(false);
    }
  };

  // Handle key press for creating label
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateLabel();
    }
  };

  // Check if a label is selected
  const isLabelSelected = (labelName) => {
    if (!value) return false;
    return value.split(',').map(l => l.trim()).includes(labelName);
  };

  // Calculate how many characters can be added for a new label
  const currentTotalCharacters = value ? value.length : 0;
  const maxNewLabelLength = Math.min(50, 500 - currentTotalCharacters);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Labels <span className="text-primary">*</span>
      </label>

      {/* Main Label Input/Dropdown */}
      <div className="relative label-selector-dropdown">
        <div
          className={`w-full px-3 py-2 border rounded-md focus:outline-none cursor-pointer flex items-center justify-between transition-all duration-200 ${
            isDropdownOpen ? 'border-primary bg-white shadow-ring-primary' : 'border-borderSecondary bg-stroke'
          } hover:border-borderMid hover:bg-white`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="flex items-center flex-wrap gap-2 min-h-[24px]">
            {value ? (
              value.split(',').map((labelName, index) => (
                <span
                  key={index}
                  className="inline-flex items-center bg-primary text-white text-sm px-3 py-1 rounded-full"
                >
                  {labelName.trim()}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentLabels = value.split(',').map(l => l.trim());
                      const newLabels = currentLabels.filter((_, i) => i !== index);
                      onChange(newLabels.join(', '));

                      // Clear validation errors when removing labels since requirements might now be met
                      setLabelLimitError('');
                      setCharacterLimitError('');
                      setLabelCharacterLimitError('');
                      setWordLimitError('');
                    }}
                    className="ml-2 text-white focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-gray-500">Select labels...</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ml-2 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Current Counts Display */}
        {value && (
          <div className="mt-2 text-xs flex justify-between text-gray-500">
            <span className={value.split(',').length >= 10 ? 'text-red-500 font-medium' : ''}>
              {/* Labels: {value.split(',').length}/10 */}
            </span>
            <span className={value.length > 500 ? 'text-red-500 font-medium' : ''}>
              {/* Characters: {value.length}/500 */}
            </span>
          </div>
        )}

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            {/* Create New Label Input */}
            {showCreateInput ? (
              <div className="p-3 border-b border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => {
                      setNewLabelName(e.target.value);
                      // Clear all errors when typing
                      setEmojiError('');
                      setLabelLimitError('');
                      setCharacterLimitError('');
                      setLabelCharacterLimitError('');
                      setWordLimitError('');
                      setDuplicateLabelError('');
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter new label name..."
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    maxLength={maxNewLabelLength}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateLabel}
                    disabled={!newLabelName.trim() || isCreatingLabel || newLabelName.length > maxNewLabelLength}
                    className="px-2 py-1 bg-primary text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingLabel ? '...' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateInput(false);
                      setNewLabelName('');
                    }}
                    className="px-2 py-1 text-gray-500 "
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Character count for new label */}
                {showCreateInput && (
                  <div className="text-xs text-right mt-1">
                    <span className={newLabelName.length > maxNewLabelLength ? 'text-red-500' : 'text-gray-500'}>
                      {/* {newLabelName.length}/{maxNewLabelLength} characters */}
                    </span>
                    {/* {maxNewLabelLength < 50 && (
                      <span className="text-red-500 ml-2">(You can only add {maxNewLabelLength} more characters)</span>
                    )} */}
                  </div>
                )}
                {/* Show error messages */}
                {emojiError && (
                  <div className="mt-2">
                    <ErrorMessage message={emojiError} />
                  </div>
                )}
                {labelLimitError && (
                  <div className="mt-2">
                    <ErrorMessage message={labelLimitError} />
                  </div>
                )}
                {characterLimitError && (
                  <div className="mt-2">
                    <ErrorMessage message={`Adding this label would exceed the 500-character limit. You can only add ${maxNewLabelLength} more characters.`} />
                  </div>
                )}
                {labelCharacterLimitError && (
                  <div className="mt-2">
                    <ErrorMessage message={labelCharacterLimitError} />
                  </div>
                )}
                {wordLimitError && (
                  <div className="mt-2">
                    <ErrorMessage message={wordLimitError} />
                  </div>
                )}
                {duplicateLabelError && (
                  <div className="mt-2">
                    <ErrorMessage message={duplicateLabelError} />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateInput(true)}
                  className="w-full flex items-center space-x-2 px-2 py-2 text-sm text-primary rounded"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Label</span>
                </button>
              </div>
            )}

            {/* Search Input for Existing Labels */}
            {existingLabels.length > 0 && (
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search labels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            )}

            {/* Existing Labels */}
            <div className="py-1">
              {isLoadingLabels ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  Loading labels...
                </div>
              ) : existingLabels.length > 0 ? (
                (() => {
                  const filteredLabels = existingLabels.filter(label =>
                    searchTerm === "" ||
                    label.name.toLowerCase().includes(searchTerm.toLowerCase())
                  );

                  return filteredLabels.length > 0 ? (
                    filteredLabels.map((label, index) => (
                      <div key={label.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectLabel(label.name)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2  ${
                            isLabelSelected(label.name) ? 'bg-primary text-white ' : 'text-gray-900'
                          }`}
                        >
                          <Tag className="w-4 h-4" style={{ color: isLabelSelected(label.name) ? 'white' : label.color }} />
                          <span>{label.name}</span>
                        </button>
                        {index < filteredLabels.length - 1 && <div className="h-px bg-gray-200 mx-3" />}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      No labels found matching "{searchTerm}"
                    </div>
                  );
                })()
              ) : (
                <div className="p-3 text-sm text-gray-500 text-center">
                  No labels available. Create your first label above.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mt-1">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Validation Error Messages */}
      {labelLimitError && (
        <div className="mt-1">
          <ErrorMessage message={labelLimitError} />
        </div>
      )}
      {characterLimitError && (
        <div className="mt-1">
          <ErrorMessage message={characterLimitError} />
        </div>
      )}
      {labelCharacterLimitError && (
        <div className="mt-1">
          <ErrorMessage message={labelCharacterLimitError} />
        </div>
      )}
      {wordLimitError && (
        <div className="mt-1">
          <ErrorMessage message={wordLimitError} />
        </div>
      )}
      {duplicateLabelError && (
        <div className="mt-1">
          <ErrorMessage message={duplicateLabelError} />
        </div>
      )}
      {emojiError && (
        <div className="mt-1">
          <ErrorMessage message={emojiError} />
        </div>
      )}
    </div>
  );
};

export default LabelSelector;