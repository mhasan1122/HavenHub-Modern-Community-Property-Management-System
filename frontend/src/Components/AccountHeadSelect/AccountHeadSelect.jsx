import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaSearch, FaTimes, FaChevronDown, FaSpinner } from 'react-icons/fa';

/**
 * AccountHeadSelect - A searchable dropdown component for selecting account heads
 * 
 * Features:
 * - Search functionality with real-time filtering
 * - Dropdown list with keyboard navigation
 * - Clear selection button
 * - Responsive design
 * - Accessibility support (ARIA attributes)
 * - Visual indication of selected account
 * 
 * @component
 * @example
 * const accounts = [
 *   { id: 1, accountCode: '1001', accountName: 'Cash in Hand' },
 *   { id: 2, accountCode: '1002', accountName: 'Bank Account' }
 * ];
 * 
 * <AccountHeadSelect
 *   accountHeads={accounts}
 *   value={selectedAccountId}
 *   onChange={(account) => setSelectedAccountId(account.id)}
 *   placeholder="Select Account"
 *   label="Account Head"
 *   required
 * />
 */
const AccountHeadSelect = ({
  accountHeads = [],
  value = null,
  onChange,
  placeholder = 'Select Account',
  label = '',
  required = false,
  disabled = false,
  error = '',
  className = '',
  showCode = true,
  clearable = true,
  autoFocus = false,
  name = '',
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Find selected account from value prop
  useEffect(() => {
    if (value && accountHeads.length > 0) {
      const account = accountHeads.find(acc => acc.id === value);
      if (account) {
        setSelectedAccount(account);
      }
    } else if (!value) {
      setSelectedAccount(null);
    }
  }, [value, accountHeads]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Filter accounts based on search term
  const filteredAccounts = accountHeads.filter(account => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();
    const accountCode = (account.accountCode || '').toLowerCase();
    
    return accountName.includes(searchLower) || accountCode.includes(searchLower);
  });

  // Handle account selection
  const handleSelect = (account) => {
    setSelectedAccount(account);
    setIsOpen(false);
    setSearchTerm('');
    setFocusedIndex(-1);
    
    if (onChange) {
      onChange(account);
    }
  };

  // Handle clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedAccount(null);
    setSearchTerm('');
    setFocusedIndex(-1);
    
    if (onChange) {
      onChange(null);
    }
  };

  // Toggle dropdown
  const handleToggle = () => {
    if (disabled || loading) return;
    
    if (!isOpen) {
      setIsOpen(true);
      // Focus input when opening
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    } else {
      setIsOpen(false);
      setSearchTerm('');
      setFocusedIndex(-1);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredAccounts.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && filteredAccounts[focusedIndex]) {
          handleSelect(filteredAccounts[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.children[focusedIndex];
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  // Format display text
  const getDisplayText = () => {
    if (selectedAccount) {
      if (showCode && selectedAccount.accountCode) {
        return `${selectedAccount.accountCode} - ${selectedAccount.accountName}`;
      }
      return selectedAccount.accountName;
    }
    return '';
  };

  return (
    <div className={`account-head-select ${className}`} ref={containerRef}>
      {/* Label */}
      {label && (
        <label 
          className="block text-sm font-medium text-gray-700 mb-2"
          htmlFor={name || 'account-head-select'}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Main Select Box */}
      <div className="relative">
        <div
          className={`
            w-full px-3 py-2 border rounded-md
            focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500
            ${disabled || loading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${isOpen ? 'ring-2 ring-blue-500' : ''}
          `}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="account-dropdown"
          aria-label={label || 'Account Head Select'}
          tabIndex={disabled || loading ? -1 : 0}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Display Value or Placeholder */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <span className="text-gray-400 truncate block flex items-center gap-2">
                  <FaSpinner className="animate-spin" size={14} />
                  Loading accounts...
                </span>
              ) : selectedAccount ? (
                <span className="text-gray-900 truncate block">
                  {getDisplayText()}
                </span>
              ) : (
                <span className="text-gray-400 truncate block">
                  {placeholder}
                </span>
              )}
            </div>

            {/* Icons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {clearable && selectedAccount && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  aria-label="Clear selection"
                  tabIndex={-1}
                >
                  <FaTimes size={14} />
                </button>
              )}
              <FaChevronDown 
                className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                size={14}
              />
            </div>
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div 
            className="absolute z-50 mt-1 min-w-full bg-white border border-gray-300 rounded-md shadow-lg"
            id="account-dropdown"
            role="listbox"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <FaSearch 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                  size={14}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFocusedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search accounts..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus={autoFocus}
                  aria-label="Search accounts"
                />
              </div>
            </div>

            {/* Account List */}
            <div 
              ref={dropdownRef}
              className="max-h-60 overflow-y-auto"
              style={{ scrollbarWidth: 'thin' }}
            >
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <FaSpinner className="animate-spin" size={16} />
                    <span>Loading accounts...</span>
                  </div>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No accounts found
                </div>
              ) : (
                filteredAccounts.map((account, index) => (
                  <div
                    key={account.id}
                    onClick={() => handleSelect(account)}
                    className={`
                      px-4 py-2 cursor-pointer transition-colors
                      ${index === focusedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      ${selectedAccount?.id === account.id ? 'bg-blue-100 hover:bg-blue-100' : ''}
                    `}
                    role="option"
                    aria-selected={selectedAccount?.id === account.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {account.accountName}
                        </div>
                        {showCode && account.accountCode && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Code: {account.accountCode}
                          </div>
                        )}
                      </div>
                      {selectedAccount?.id === account.id && (
                        <div className="flex-shrink-0 text-blue-600">
                          <svg 
                            className="w-4 h-4" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path 
                              fillRule="evenodd" 
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                              clipRule="evenodd" 
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

AccountHeadSelect.propTypes = {
  /** Array of account head objects with id, accountCode, and accountName */
  accountHeads: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      accountCode: PropTypes.string,
      accountName: PropTypes.string.isRequired,
    })
  ).isRequired,
  /** Currently selected account ID */
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Callback when account is selected or cleared - receives the account object or null */
  onChange: PropTypes.func,
  /** Placeholder text when no account is selected */
  placeholder: PropTypes.string,
  /** Label text displayed above the select */
  label: PropTypes.string,
  /** Whether the field is required */
  required: PropTypes.bool,
  /** Whether the select is disabled */
  disabled: PropTypes.bool,
  /** Error message to display */
  error: PropTypes.string,
  /** Additional CSS classes */
  className: PropTypes.string,
  /** Whether to show account code in display and options */
  showCode: PropTypes.bool,
  /** Whether to show clear button */
  clearable: PropTypes.bool,
  /** Whether to auto-focus search input when opened */
  autoFocus: PropTypes.bool,
  /** Name attribute for the component */
  name: PropTypes.string,
  /** Whether accounts are being loaded */
  loading: PropTypes.bool,
};

export default AccountHeadSelect;
