import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { fetchMembers } from '../../../redux/slices/api/memberApi';
import { IoSearch } from 'react-icons/io5';
import { FaCaretDown } from 'react-icons/fa6';
import { X } from 'lucide-react';
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";

/**
 * OrgMemberSelector Component
 * Provides a searchable dropdown for selecting organization members by Contact Name
 */
const OrgMemberSelector = ({ value, onChange, error, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const dropdownRef = useRef(null);
  
  const dispatch = useDispatch();
  const { members, loading } = useSelector((state) => state.member);

  // Fetch members on component mount
  useEffect(() => {
    dispatch(fetchMembers({ search: '' }));
  }, [dispatch]);

  // Sync selected member with external value
  useEffect(() => {
    if (value && members.length > 0) {
      const member = members.find(m => m.id.toString() === value.toString());
      if (member) {
        setSelectedMember(member);
      } else {
        setSelectedMember(null);
      }
    } else if (!value) {
      setSelectedMember(null);
    }
  }, [value, members]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter members based on search term and active organization member status
  // Search by full_name (Contact Name)
  const filteredMembers = members.filter(member =>
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    member.is_org_member === true // Only show active organization members
  );

  // Handle member selection
  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    setIsOpen(false);
    setSearchTerm('');
    
    // Call onChange with member ID
    if (onChange) {
      onChange(member.id);
    }
  };

  // Clear selection
  const clearSelection = (e) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedMember(null);
    if (onChange) {
      onChange(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main dropdown trigger */}
      <div
        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${
          disabled ? 'bg-disabledInput cursor-not-allowed text-black100' : 'cursor-pointer'
        } ${error ? 'border-error' : isOpen && !disabled ? '!border-primary !bg-white !shadow-ring-primary' : !disabled ? 'bg-white' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex-1 truncate">
          {selectedMember ? (
            <div className="flex items-center justify-between w-full">
              <span className={`text-sm ${disabled ? "text-gray-500" : "text-gray-900"}`}>
                {selectedMember.full_name}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500">Search by Contact Name...</span>
          )}
        </div>
        {!disabled && <FaCaretDown className={`flex-shrink-0 w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </div>

      {/* Dropdown content */}
      {isOpen && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Contact Name..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
              <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary" />
            </div>
          </div>

          {/* Member list */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm ? 'No organization members found matching your search' : 'No organization members available'}
              </div>
            ) : (
              <div className="py-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="px-3 py-2 hover:bg-primary hover:text-white cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleMemberSelect(member)}
                  >
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {member.full_name}
                      </div>
                      {member.general_email && (
                        <div className="text-xs text-gray-500">
                          {member.general_email}
                        </div>
                      )}
                      {member.phone_number && (
                        <div className="text-xs text-gray-500">
                          {member.phone_number}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <ErrorMessage message={error} />
      )}
    </div>
  );
};

OrgMemberSelector.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  disabled: PropTypes.bool,
};

export default OrgMemberSelector;

