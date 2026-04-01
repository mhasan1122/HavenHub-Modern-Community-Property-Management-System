import { useState, useEffect } from 'react';
import { FaUser, FaUsers, FaUserTie, FaChevronDown } from 'react-icons/fa';
import axiosInstance from '../../../../utils/axiosInstance';

/**
 * PostAsSelector Component for Notice Board
 * Allows selection of posting identity (Creator, Group, Member)
 */
const PostAsSelector = ({
  value,
  selectedGroup,
  selectedMember,
  onChange,
  currentUser,
  error
}) => {
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const savedPreference = localStorage.getItem("noticePostAsPreference");
    if (savedPreference && ['creator', 'group', 'member'].includes(savedPreference)) {
      onChange(savedPreference, null, null);
    }
  }, [onChange]);

  // Handle post as change
  const handlePostAsChange = (newValue) => {
    onChange(newValue, null, null);
    
    // Save preference
    localStorage.setItem("noticePostAsPreference", newValue);
    
    // Close dropdowns
    setShowMemberDropdown(false);
    setShowGroupDropdown(false);
  };

  // Load members
  const loadMembers = async () => {
    if (loadingMembers || members.length > 0) return;
    
    setLoadingMembers(true);
    try {
      const response = await axiosInstance.get('/api/members/');
      const membersData = response.data.results || response.data;
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error) {
      console.error('Error loading members:', error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Load groups
  const loadGroups = async () => {
    if (loadingGroups || groups.length > 0) return;
    
    setLoadingGroups(true);
    try {
      const response = await axiosInstance.get('/api/groups/');
      const groupsData = response.data.results || response.data;
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Handle member selection
  const handleMemberSelection = (member) => {
    onChange('member', null, member.id);
    setShowMemberDropdown(false);
  };

  // Handle group selection
  const handleGroupSelection = (group) => {
    onChange('group', group.id, null);
    setShowGroupDropdown(false);
  };

  const getSelectedMemberName = () => {
    if (!selectedMember) return '';
    const member = members.find(m => m.id === selectedMember);
    return member ? member.full_name : '';
  };

  const getSelectedGroupName = () => {
    if (!selectedGroup) return '';
    const group = groups.find(g => g.id === selectedGroup);
    return group ? group.group_name : '';
  };

  return (
    <div className="space-y-4">
      {/* Post As Radio Buttons */}
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            value="creator"
            checked={value === 'creator'}
            onChange={(e) => handlePostAsChange(e.target.value)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
            <FaUser className="w-3 h-3" />
            Creator
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="radio"
            value="group"
            checked={value === 'group'}
            onChange={(e) => handlePostAsChange(e.target.value)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
            <FaUsers className="w-3 h-3" />
            Group
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="radio"
            value="member"
            checked={value === 'member'}
            onChange={(e) => handlePostAsChange(e.target.value)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
            <FaUserTie className="w-3 h-3" />
            Member
          </span>
        </label>
      </div>

      {/* Group Selection */}
      {value === 'group' && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Group <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => {
              if (groups.length === 0) loadGroups();
              setShowGroupDropdown(!showGroupDropdown);
            }}
            className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          >
            <span className={getSelectedGroupName() ? "text-gray-900" : "text-gray-500"}>
              {getSelectedGroupName() || "Choose a group..."}
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showGroupDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingGroups ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading groups...</div>
              ) : groups.length > 0 ? (
                groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleGroupSelection(group)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    {group.group_name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No groups available</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Member Selection */}
      {value === 'member' && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Member <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => {
              if (members.length === 0) loadMembers();
              setShowMemberDropdown(!showMemberDropdown);
            }}
            className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          >
            <span className={getSelectedMemberName() ? "text-gray-900" : "text-gray-500"}>
              {getSelectedMemberName() || "Choose a member..."}
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showMemberDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingMembers ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading members...</div>
              ) : members.length > 0 ? (
                members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleMemberSelection(member)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    {member.full_name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No members available</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Creator Info */}
      {value === 'creator' && currentUser && (
        <div className="text-sm text-gray-600">
          Posting as: <span className="font-medium">{currentUser.full_name || currentUser.fullName || 'Current User'}</span>
        </div>
      )}
    </div>
  );
};

export default PostAsSelector;
