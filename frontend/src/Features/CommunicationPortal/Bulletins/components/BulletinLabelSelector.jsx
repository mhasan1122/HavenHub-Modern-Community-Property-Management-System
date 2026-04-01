import React, { useState, useEffect } from 'react';
import { Plus, Tag, ChevronDown, X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { fetchBulletinLabels } from '../../../../redux/slices/api/bulletinApi';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

// Emoji validation function
const containsEmoji = (text) => {
  if (!text) return false;
  // Regex to detect emojis including various Unicode ranges
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/u;
  return emojiRegex.test(text);
};

// Count words in a single label
const countWordsInLabel = (label) => {
  if (!label || typeof label !== 'string') return 0;
  return label.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * BulletinLabelSelector Component
 * Handles creating new labels with text input and selecting from existing bulletin labels
 * Fetches labels from the bulletin labels database endpoint
 * Design matches exactly with announcement LabelSelector
 */
const BulletinLabelSelector = ({ value, onChange, error }) => {
  const dispatch = useDispatch();
  const [newLabelName, setNewLabelName] = useState('');
  const [existingLabels, setExistingLabels] = useState([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Error states
  const [emojiError, setEmojiError] = useState('');
  const [labelLimitError, setLabelLimitError] = useState('');
  const [characterLimitError, setCharacterLimitError] = useState('');
  const [labelCharacterLimitError, setLabelCharacterLimitError] = useState('');
  const [wordLimitError, setWordLimitError] = useState('');

  // Load existing labels from database
  useEffect(() => {
    const loadLabels = async () => {
      setIsLoadingLabels(true);
      try {
        const result = await dispatch(fetchBulletinLabels());
        if (result.payload) {
          // Transform string labels to objects with id, name, and color
          const transformedLabels = result.payload.map((labelName, index) => ({
            id: index + 1,
            name: labelName,
            color: 'primary' // Default color for bulletin labels - using Tailwind config
          }));
          setExistingLabels(transformedLabels);
        }
      } catch (error) {
        console.error('Error loading bulletin labels:', error);
      } finally {
        setIsLoadingLabels(false);
      }
    };

    loadLabels();
  }, [dispatch]);

  // Handle keyboard events for create input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateLabel();
    } else if (e.key === 'Escape') {
      setShowCreateInput(false);
      setNewLabelName('');
    }
  };

  // Check if a label is currently selected
  const isLabelSelected = (labelName) => {
    if (!value) return false;
    const currentLabels = value.split(',').map(l => l.trim());
    return currentLabels.includes(labelName);
  };

  // Handle selecting/deselecting existing labels
  const handleSelectLabel = (labelName) => {
    if (!value) {
      onChange(labelName);
      return;
    }

    const currentLabels = value.split(',').map(l => l.trim());
    
    if (currentLabels.includes(labelName)) {
      // Remove the label
      const newLabels = currentLabels.filter(l => l !== labelName);
      onChange(newLabels.join(', '));
    } else {
      // Add the label
      const newLabels = [...currentLabels, labelName];
      onChange(newLabels.join(', '));
    }
  };

  // Handle creating new labels
  const handleCreateLabel = () => {
    const trimmedName = newLabelName.trim();
    
    if (!trimmedName) return;

    // Clear all errors first
    setEmojiError('');
    setLabelLimitError('');
    setCharacterLimitError('');
    setLabelCharacterLimitError('');
    setWordLimitError('');

    // Check for emojis
    if (containsEmoji(trimmedName)) {
      setEmojiError('Labels cannot contain emojis');
      return;
    }

    // Check if this label exceeds 50 characters
    if (trimmedName.length > 50) {
      setLabelCharacterLimitError('Each label cannot exceed 50 characters. Please use fewer characters.');
      return;
    }

    // Check if this label exceeds 10 words
    const labelWordCount = countWordsInLabel(trimmedName);
    if (labelWordCount > 10) {
      setWordLimitError('Each label cannot exceed 10 words. Please use fewer words.');
      return;
    }

    // Check if label already exists (case-insensitive)
    const labelExists = existingLabels.some(
      label => label.name.toLowerCase() === trimmedName.toLowerCase()
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
    const testLabels = [...currentLabels, trimmedName];
    const testString = testLabels.join(', ');
    if (testString.length > 500) {
      setCharacterLimitError('Adding this label would exceed the 500-character limit. Please remove some labels first.');
      return;
    }

    setIsCreatingLabel(true);
    try {
      // For new labels, we just add them to the current selection
      // The label will be saved to the database when the bulletin is created/updated
      const currentLabels = value ? value.split(',').map(l => l.trim()) : [];
      const newLabels = [...currentLabels, trimmedName];
      onChange(newLabels.join(', '));

      // Add to local state for immediate UI feedback
      const newLabel = {
        id: `temp-label-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: trimmedName,
        color: 'primary'
      };
      setExistingLabels(prev => [...prev, newLabel]);

      // Reset form
      setNewLabelName('');
      setShowCreateInput(false);
    } catch (error) {
      console.error('Error creating label:', error);
      setEmojiError('Failed to create label. Please try again.');
    } finally {
      setIsCreatingLabel(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Label <span className="text-primary">*</span>
      </label>

      {/* Main Dropdown */}
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

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
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

export default BulletinLabelSelector;
