import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGroupList } from '../../../../redux/slices/groups/groupSlice';
import { IoSearch } from "react-icons/io5";
import { FaCaretDown } from 'react-icons/fa6';

/**
 * GroupSelector Component
 * Provides a searchable dropdown for selecting groups with their descriptions
 */
const GroupSelector = ({ value, onChange, error, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const dropdownRef = useRef(null);
  
  const dispatch = useDispatch();
  const { groupList, loading } = useSelector((state) => state.group);

  // Fetch groups on component mount - only active groups
  useEffect(() => {
    dispatch(fetchGroupList({ status: ['1'], search: '' })); // '1' = active groups only
  }, [dispatch]);

  // Set selected group based on value prop
  useEffect(() => {
    if (value && groupList.length > 0) {
      const group = groupList.find(g => g.id === value);
      setSelectedGroup(group || null);
    } else {
      setSelectedGroup(null);
    }
  }, [value, groupList]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter groups based on search term
  const filteredGroups = groupList.filter(group =>
    group.group_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.group_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get group roles
  const getGroupRoles = (group) => {
    if (group.roles && Array.isArray(group.roles)) {
      return group.roles.map(role => role.role_name).filter(Boolean);
    }
    return [];
  };

  // Handle group selection
  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setIsOpen(false);
    setSearchTerm('');

    // Call onChange with group data
    if (onChange) {
      onChange({
        id: group.id,
        name: group.group_name,
        // description: group.group_description,
        roles: getGroupRoles(group)
      });
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedGroup(null);
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
          {selectedGroup ? (
            <div className="flex items-center justify-between">
              <span className={`text-sm ${disabled ? "text-gray-500" : "text-gray-900"}`}>{selectedGroup.group_name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500">Select a group...</span>
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
                placeholder="Search groups..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
           <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary" />

            </div>
          </div>

          {/* Header row */}
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-primary font-medium">Name</span>
              <span className="text-primary font-medium">Role</span>
            </div>
          </div>

          {/* Group list */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-2 text-sm text-gray-500">Loading groups...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No groups found</div>
            ) : (
              filteredGroups.map((group) => {
                const roles = getGroupRoles(group);
                return (
                  <div
                    key={group.id}
                    className="px-3 py-2 hover:bg-primary hover:text-white cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleGroupSelect(group)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {group.group_name}
                        </div>
                        {/* {group.group_description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {group.group_description}
                          </div>
                        )} */}
                      </div>
                      <div className="text-sm text-gray-600 text-right">
                        {roles.length > 0 ? roles.join(', ') : 'No Role'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default GroupSelector;
