import React, { useState, useEffect } from 'react';
import { FaUser, FaUsers, FaChevronDown } from 'react-icons/fa';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

/**
 * PostAsSelector Component
 * Allows selection of posting identity (Creator, Group, Member)
 */
const PostAsSelector = ({
  register,
  errors,
  watch,
  setValue,
  trigger,
  currentUser,
  onMemberSelect,
  onGroupSelect,
  savePostAsPreference,
  postAs,
  isEditing = false,
  bulletin = null
}) => {
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    if (!isEditing) {
      const savedPreference = localStorage.getItem("bulletinPostAsPreference");
      if (savedPreference && ['Creator', 'Group', 'Member'].includes(savedPreference)) {
        setValue("postAs", savedPreference);
        trigger("postAs");
      }
    }
  }, [setValue, trigger, isEditing]);

  // Handle post as change
  const handlePostAsChange = (value) => {
    setValue("postAs", value);
    
    // Clear previous selections
    setValue("selectedMemberId", "");
    setValue("selectedMemberName", "");
    setValue("selectedGroupId", "");
    setValue("selectedGroupName", "");
    
    // Save preference
    savePostAsPreference(value);
    
    trigger(["postAs", "selectedMemberId", "selectedMemberName", "selectedGroupId", "selectedGroupName"]);
  };

  // Load members (mock data - replace with actual API call)
  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      // Replace with actual API call
      const mockMembers = [
        { id: 1, full_name: "John Doe", email: "john@example.com" },
        { id: 2, full_name: "Jane Smith", email: "jane@example.com" },
        { id: 3, full_name: "Bob Johnson", email: "bob@example.com" }
      ];
      setMembers(mockMembers);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Load groups (mock data - replace with actual API call)
  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      // Replace with actual API call
      const mockGroups = [
        { id: 1, name: "Management Team", description: "Building management" },
        { id: 2, name: "Security Team", description: "Security personnel" },
        { id: 3, name: "Maintenance Team", description: "Maintenance staff" }
      ];
      setGroups(mockGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Handle member selection
  const handleMemberSelection = (member) => {
    onMemberSelect(member);
    setShowMemberDropdown(false);
  };

  // Handle group selection
  const handleGroupSelection = (group) => {
    // Transform group data to match expected structure
    const transformedGroup = {
      id: group.id,
      name: group.group_name,
      description: group.group_description
    };
    onGroupSelect(transformedGroup);
    setShowGroupDropdown(false);
  };

  return (
    <div className="space-y-4">
      {/* Post As Radio Buttons */}
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            {...register("postAs")}
            value="Creator"
            onChange={(e) => handlePostAsChange(e.target.value)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
            <FaUser className="w-3 h-3" />
            Creator
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="radio"
            {...register("postAs")}
            value="Group"
            onChange={(e) => handlePostAsChange(e.target.value)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
            <FaUsers className="w-3 h-3" />
            Group
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="radio"
            {...register("postAs")}
            value="Member"
            onChange={(e) => handlePostAsChange(e.target.value)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center gap-1">
            <FaUser className="w-3 h-3" />
            Member
          </span>
        </label>
      </div>

      {/* Creator Name Display */}
      {postAs === "Creator" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Creator Name
          </label>
          <input
            type="text"
            {...register("creatorName")}
            value={currentUser?.full_name || ""}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>
      )}

      {/* Group Selection */}
      {postAs === "Group" && (
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
              errors.selectedGroupId ? "border-red-500" : "border-gray-300"
            }`}
          >
            <span className={watch("selectedGroupName") ? "text-gray-900" : "text-gray-500"}>
              {watch("selectedGroupName") || "Choose a group..."}
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showGroupDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingGroups ? (
                <div className="p-3 text-center text-gray-500">Loading groups...</div>
              ) : groups.length === 0 ? (
                <div className="p-3 text-center text-gray-500">No groups available</div>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleGroupSelection(group)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{group.group_name}</div>
                    {group.group_description && (
                      <div className="text-sm text-gray-500">{group.group_description}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
          
          {errors.selectedGroupId && (
            <ErrorMessage message={errors.selectedGroupId.message} />
          )}
        </div>
      )}

      {/* Member Selection */}
      {postAs === "Member" && (
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
              errors.selectedMemberId ? "border-red-500" : "border-gray-300"
            }`}
          >
            <span className={watch("selectedMemberName") ? "text-gray-900" : "text-gray-500"}>
              {watch("selectedMemberName") || "Choose a member..."}
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showMemberDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingMembers ? (
                <div className="p-3 text-center text-gray-500">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="p-3 text-center text-gray-500">No members available</div>
              ) : (
                members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleMemberSelection(member)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{member.full_name}</div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </button>
                ))
              )}
            </div>
          )}
          
          {errors.selectedMemberId && (
            <ErrorMessage message={errors.selectedMemberId.message} />
          )}
        </div>
      )}

      {/* Hidden inputs for form validation */}
      <input type="hidden" {...register("selectedMemberId")} />
      <input type="hidden" {...register("selectedMemberName")} />
      <input type="hidden" {...register("selectedGroupId")} />
      <input type="hidden" {...register("selectedGroupName")} />
    </div>
  );
};

export default PostAsSelector;
