import React, { useState, useEffect } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { FaCaretDown } from 'react-icons/fa6';
import { useDispatch } from 'react-redux';
import { fetchLabels } from '../../../../redux/slices/api/announcementApi';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);

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
      // Convert string labels to objects with id and name for consistency
      const labelObjects = result.map((labelName, index) => ({
        id: `db-label-${index}-${labelName}`,
        name: labelName,
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

      // Clear label limit error if we're under the limit (changed to 10)
      if (currentLabels.length < 10 && labelLimitError) {
        setLabelLimitError('');
      }

      // Clear character limit error if we're under the limit
      if (value.length <= 500 && characterLimitError) {
        setCharacterLimitError('');
      }

      // Clear individual label character limit error if all labels are under 50 characters
      const hasLongCharacterLabel = currentLabels.some(label => label.length > 50);
      if (!hasLongCharacterLabel && labelCharacterLimitError) {
        setLabelCharacterLimitError('');
      }

      // Clear word limit error if all labels have 10 words or less
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
    }
  }, [value, labelLimitError, characterLimitError, labelCharacterLimitError, wordLimitError]);

  // Handle selecting existing label
  const handleSelectLabel = (labelName) => {
    const currentLabels = value ? value.split(',').map(l => l.trim()).filter(l => l.length > 0) : [];
    let newLabels;



    if (currentLabels.includes(labelName)) {
      // Remove label if already selected
      newLabels = currentLabels.filter(l => l !== labelName);

      // Clear errors when removing labels since requirements might now be met
      setLabelLimitError('');
      setCharacterLimitError('');
      setLabelCharacterLimitError('');
      setWordLimitError('');
    } else {
      // Check if this label exceeds 50 characters
      if (labelName.length > 50) {
        setLabelCharacterLimitError('Each label cannot exceed 50 characters. Please choose a shorter label.');
        return;
      }

      // Check if this label exceeds 10 words
      const labelWordCount = countWordsInLabel(labelName);
      if (labelWordCount > 10) {
        setWordLimitError('Each label cannot exceed 10 words. Please choose a shorter label.');
        return;
      }

      // Check if adding this label would exceed the 10-label limit
      if (currentLabels.length >= 10) {
        setLabelLimitError('Maximum 10 labels allowed. Please remove a label before adding a new one.');
        return;
      }

      // Check if adding this label would exceed the 500-character limit
      const testLabels = [...currentLabels, labelName];
      const testString = testLabels.join(', ');
      if (testString.length > 500) {
        setCharacterLimitError('Adding this label would exceed the 500-character limit. Please remove some labels first.');
        return;
      }

      // Clear errors when successfully adding a label
      setLabelLimitError('');
      setCharacterLimitError('');
      setLabelCharacterLimitError('');
      setWordLimitError('');

      // Add new label
      newLabels = [...currentLabels, labelName];
    }

    onChange(newLabels.join(', '));
  };

  // Handle creating new label
  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    // Clear previous errors
    setEmojiError('');
    setLabelLimitError('');
    setCharacterLimitError('');
    setLabelCharacterLimitError('');
    setWordLimitError('');

    // Check for emojis
    if (containsEmoji(newLabelName.trim())) {
      setEmojiError('Emojis are not allowed in label');
      return;
    }

    // Check if this label exceeds 50 characters
    if (newLabelName.trim().length > 50) {
      setLabelCharacterLimitError('Each label cannot exceed 50 characters. Please use fewer characters.');
      return;
    }

    // Check if this label exceeds 10 words
    const labelWordCount = countWordsInLabel(newLabelName.trim());
    if (labelWordCount > 10) {
      setWordLimitError('Each label cannot exceed 10 words. Please use fewer words.');
      return;
    }

    // Check if label already exists (case-insensitive)
    const labelExists = existingLabels.some(
      label => label.name.toLowerCase() === newLabelName.trim().toLowerCase()
    );

    if (labelExists) {
      setEmojiError('Label already exists!');
      return;
    }

    // Check if adding this label would exceed the 10-label limit
    const currentLabels = value ? value.split(',').map(l => l.trim()).filter(l => l.length > 0) : [];
    if (currentLabels.length >= 10) {
      setLabelLimitError('Maximum 10 labels allowed. Please remove a label before adding a new one.');
      return;
    }

    // Check if adding this label would exceed the 500-character limit
    const testLabels = [...currentLabels, newLabelName.trim()];
    const testString = testLabels.join(', ');
    if (testString.length > 500) {
      setCharacterLimitError('Adding this label would exceed the 500-character limit. Please remove some labels first.');
      return;
    }

    setIsCreatingLabel(true);
    try {
      // For new labels, we just add them to the current selection
      // The label will be saved to the database when the announcement is created/updated
      const currentLabels = value ? value.split(',').map(l => l.trim()) : [];
      const newLabels = [...currentLabels, newLabelName.trim()];
      onChange(newLabels.join(', '));

      // Add to local state for immediate UI feedback
      const newLabel = {
        id: `temp-label-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: newLabelName.trim(),
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
      };
      setExistingLabels(prev => [...prev, newLabel]);

      setNewLabelName('');
      setShowCreateInput(false);
      setIsDropdownOpen(false);
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

  // Handle deleting a label
  // const handleDeleteLabel = (labelId, labelName) => {
  //   // Remove the label from existing labels
  //   const updatedLabels = existingLabels.filter(label => label.id !== labelId);
  //   setExistingLabels(updatedLabels);
  //   saveLabelsToStorage(updatedLabels);
    
  //   // Also remove from current selection if it's selected
  //   const currentLabels = value ? value.split(',').map(l => l.trim()) : [];
  //   if (currentLabels.includes(labelName)) {
  //     const newLabels = currentLabels.filter(l => l !== labelName);
  //     onChange(newLabels.join(', '));
  //   }
  // };

  // Check if a label is selected
  const isLabelSelected = (labelName) => {
    if (!value) return false;
    return value.split(',').map(l => l.trim()).includes(labelName);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Labels <span className="text-primary">*</span>
      </label>

      {/* Main Label Input/Dropdown */}
      <div className="relative label-selector-dropdown">
        <div
          className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap cursor-pointer ${
            isDropdownOpen ? '!border-primary !bg-white !shadow-ring-primary' : 'bg-white'
          }`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="flex items-center flex-wrap gap-2 min-h-[24px] flex-1">
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
              <span className="text-sm text-gray-500">Select labels...</span>
            )}
          </div>
          <FaCaretDown className={`flex-shrink-0 w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
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
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter new label name..."
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    maxLength={50}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateLabel}
                    disabled={!newLabelName.trim() || isCreatingLabel}
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
                {/* Show error messages */}
                {emojiError && (
                  <div className="px-3 pb-2">
                    <ErrorMessage message={emojiError} />
                  </div>
                )}
                {labelLimitError && (
                  <div className="px-3 pb-2">
                    <ErrorMessage message={labelLimitError} />
                  </div>
                )}
                {characterLimitError && (
                  <div className="px-3 pb-2">
                    <ErrorMessage message={characterLimitError} />
                  </div>
                )}
                {labelCharacterLimitError && (
                  <div className="px-3 pb-2">
                    <ErrorMessage message={labelCharacterLimitError} />
                  </div>
                )}
                {wordLimitError && (
                  <div className="px-3 pb-2">
                    <ErrorMessage message={wordLimitError} />
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
            <div className="py-1 max-h-48 overflow-y-auto">
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
                          className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2 cursor-pointer ${
                            isLabelSelected(label.name) 
                              ? 'bg-primary text-white' 
                              : 'hover:bg-primary hover:text-white'
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

      {/* Label Count, Character Count, and Word Count Info */}
      {/* {value && (
        <div className="mt-2 text-xs flex justify-between">
          <span className={`${value.split(',').length >= 5 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
            Labels: {value.split(',').length}/5
          </span>
          <span className={`${countWordsInLabels(value) > 10 ? 'text-red-500 font-medium' : countWordsInLabels(value) > 8 ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
            Words: {countWordsInLabels(value)}/10 {console.log('Current word count:', countWordsInLabels(value), 'for value:', value)}
          </span>
          <span className={`${value.length > 90 ? 'text-red-500 font-medium' : value.length > 80 ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
            Characters: {value.length}/100
          </span>
        </div>
      )} */}

      {/* Error Messages */}
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
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
    </div>
  );
};

export default LabelSelector;
