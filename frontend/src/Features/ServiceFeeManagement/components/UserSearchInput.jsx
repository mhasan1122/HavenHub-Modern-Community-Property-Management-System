import { useState, useRef, useCallback, useEffect } from 'react';

import { FaSearch, FaTimes } from 'react-icons/fa';
import PropTypes from 'prop-types';
import axiosInstance from '../../../utils/axiosInstance';

const UserSearchInput = ({
  created_by_name = '',
  currentUser = null,
  onSelect,
  onValidationChange,
  placeholder = 'Search user...',
  className = '',
  required = false
}) => {
  const [searchTerm, setSearchTerm] = useState(created_by_name);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [validationError, setValidationError] = useState('');

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const isInitialized = useRef(false);

  // Track last validation state to prevent infinite loops
  const lastValidationState = useRef({ isValid: null, error: null });

  // Helper function to check if the component is valid
  const checkValidation = useCallback((currentSearchTerm, currentIsValid, currentValidationError) => {
    const hasValidationError = !!currentValidationError;
    const isValid = !hasValidationError && (!required || (currentSearchTerm && currentIsValid));

    // Only notify parent if validation state has changed
    if (
      lastValidationState.current.isValid !== isValid ||
      lastValidationState.current.error !== currentValidationError
    ) {
      if (onValidationChange) {
        onValidationChange(isValid, currentValidationError);
      }
      lastValidationState.current = { isValid, error: currentValidationError };
    }

    return isValid;
  }, [required, onValidationChange]);

  // Update search term when created_by_name or currentUser prop changes
  useEffect(() => {
    // 1. If created_by_name is explicitly provided (and not 'N/A'), sync with it.
    if (created_by_name && created_by_name !== 'N/A') {
      if (searchTerm !== created_by_name) {
        setSearchTerm(created_by_name);
        setValidationError('');
      }
      isInitialized.current = true;
      return;
    }

    // 2. If already initialized, respect user's clearing/typing
    if (isInitialized.current) {
      return;
    }

    // 3. Initial Load: Default to currentUser if available
    if (currentUser) {
      let displayName = '';
      let userId = null;

      if (typeof currentUser === 'object' && currentUser !== null) {
        displayName = currentUser.full_name || currentUser.name || '';
        userId = currentUser.id || null;
      } else if (typeof currentUser === 'string') {
        displayName = currentUser;
        userId = null;
      }

      if (displayName) {
        setSearchTerm(displayName);
        setValidationError('');

        const userObject = {
          full_name: displayName,
          name: displayName,
          id: userId || 'auto_selected'
        };

        setSelectedUser(userObject);

        if (onSelect) {
          onSelect(userObject);
        }

        isInitialized.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created_by_name, currentUser?.id, currentUser?.name, currentUser?.full_name]);

  const searchUsers = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setUsers([]);
      setShowDropdown(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `/api/service-fee-management/payments/created-by/?search=${encodeURIComponent(query)}`;
      const response = await axiosInstance.get(url);

      const userData = Array.isArray(response.data) ? response.data : [];
      setUsers(userData);
      setShowDropdown(true);
    } catch {
      setError('Search failed');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear selection when user types
    setSelectedUser(null);

    let newValidationError = '';
    if (required && !value.trim()) {
      newValidationError = 'This field is required';
    }

    setValidationError(newValidationError);
    checkValidation(value, false, newValidationError);

    onSelect(null);
    searchUsers(value);
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    const name = user.full_name || user.name || '';
    setSearchTerm(name);
    setValidationError('');
    setShowDropdown(false);

    checkValidation(name, true, '');
    onSelect(user);
  };

  const handleClear = () => {
    setSearchTerm('');
    setUsers([]);
    setShowDropdown(false);
    setSelectedUser(null);
    setValidationError('');

    if (inputRef.current) {
      inputRef.current.focus();
    }

    onSelect(null);

    if (required) {
      const errorMessage = 'This field is required';
      setValidationError(errorMessage);
      checkValidation('', false, errorMessage);
    } else {
      checkValidation('', true, '');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FaSearch className="h-4 w-4 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full h-[42px] pl-10 pr-10 border rounded-md focus:outline-none focus:ring-2 text-sm text-gray-700 bg-white transition-colors ${error || className?.includes('border-red-500') || validationError
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-primary focus:border-primary'
            } ${className || ''}`}
        />

        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        )}
      </div>

      {validationError && (
        <div className="mt-1 text-xs text-red-600">
          {validationError}
        </div>
      )}

      {showDropdown && searchTerm.trim().length >= 2 && users.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bg-white border border-gray-300 rounded-md shadow-xl z-[9999] max-h-60 overflow-y-auto w-full mt-1"
        >
          {loading ? (
            <div className="p-4 text-center">
              <span className="text-sm text-gray-600">Searching...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <span className="text-sm text-red-600">{error}</span>
            </div>
          ) : users.length > 0 ? (
            <div>
              {users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {user.full_name || user.name || 'Unknown User'}
                  </div>
                  {user.general_email && (
                    <div className="text-xs text-gray-500">
                      {user.general_email}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <span className="text-sm text-gray-500">No users found</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

UserSearchInput.propTypes = {
  created_by_name: PropTypes.string,
  currentUser: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onSelect: PropTypes.func.isRequired,
  onValidationChange: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  required: PropTypes.bool,
};

export default UserSearchInput;
