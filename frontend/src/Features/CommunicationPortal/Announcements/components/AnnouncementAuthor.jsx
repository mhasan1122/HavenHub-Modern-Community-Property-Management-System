import React, { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import MemberSelector from './MemberSelector';

/**
 * AnnouncementAuthor Component
 * Handles creator name and post as selection (Creator/Group/Member)
 */
const AnnouncementAuthor = ({ control, errors, currentUser, setValue, watch }) => {

  const postAs = watch('postAs');
  const authorName = watch('authorName');

  // Load saved state from localStorage on component mount
  useEffect(() => {
    const savedPostAs = localStorage.getItem('announcementPostAs');
    const savedMemberId = localStorage.getItem('announcementMemberId');
    const savedMemberName = localStorage.getItem('announcementMemberName');

    if (savedPostAs) {
      // Set the post type first
      setValue('postAs', savedPostAs);

      // Then handle the member data if it exists
      if (savedPostAs === 'Member' && savedMemberId && savedMemberName) {
        setValue('selectedMemberId', savedMemberId);
        setValue('selectedMemberName', savedMemberName);
        setValue('authorId', savedMemberId);
        // Keep authorName as current user - don't set it to selected member
        if (currentUser) {
          setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
        }
      } else if (savedPostAs === 'Creator' && currentUser) {
        setValue('authorId', currentUser.id);
        setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
      } else if (savedPostAs === 'Group') {
        setValue('authorId', '');
        // Set creator name to current user when posting as group
        if (currentUser) {
          setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
        } else {
          setValue('authorName', 'Group Selection (Coming Soon)');
        }
      }
    }
  }, [setValue, currentUser]);

  // Update author name when current user changes (handled by custom hook in parent)
  useEffect(() => {
    if (currentUser && (postAs === 'Creator' || postAs === 'Group' || postAs === 'Member')) {
      setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
    }
  }, [currentUser, postAs, setValue]);

  // Handle post as selection change
  const handlePostAsChange = (value, onChange) => {
    // Save the selection to localStorage first
    localStorage.setItem('announcementPostAs', value);
    
    // Then update the form state
    onChange(value);

    if (value === 'Creator' && currentUser) {
      setValue('authorId', currentUser.id);
      setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
      // Clear member selection
      setValue('selectedMemberId', '');
      setValue('selectedMemberName', '');
      localStorage.removeItem('announcementMemberId');
      localStorage.removeItem('announcementMemberName');
    } else if (value === 'Group') {
      setValue('authorId', '');
      // Set creator name to current user when posting as group
      if (currentUser) {
        setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
      } else {
        setValue('authorName', 'Group Selection (Coming Soon)');
      }
      // Clear member selection
      setValue('selectedMemberId', '');
      setValue('selectedMemberName', '');
      localStorage.removeItem('announcementMemberId');
      localStorage.removeItem('announcementMemberName');
    } else if (value === 'Member') {
      setValue('authorId', '');
      // Set creator name to current user when posting as member
      if (currentUser) {
        setValue('authorName', currentUser.fullName || currentUser.full_name || 'Current User');
      }
      // Clear member selection when switching to member mode
      setValue('selectedMemberId', '');
      setValue('selectedMemberName', '');
      localStorage.removeItem('announcementMemberId');
      localStorage.removeItem('announcementMemberName');
    }
  };

  // Handle member selection
  const handleMemberSelect = (memberData) => {
    if (memberData) {
      setValue('selectedMemberId', memberData.id);
      setValue('selectedMemberName', memberData.name);
      setValue('authorId', memberData.id);
      // Keep creator name as current user - don't change it to selected member
      // The creator should always be the logged-in user
      localStorage.setItem('announcementMemberId', memberData.id);
      localStorage.setItem('announcementMemberName', memberData.name);
    } else {
      setValue('selectedMemberId', '');
      setValue('selectedMemberName', '');
      setValue('authorId', '');
      // Keep authorName as current user - don't clear it
      localStorage.removeItem('announcementMemberId');
      localStorage.removeItem('announcementMemberName');
    }
  };

  return (
    <div className="space-y-4">
      {/* Creator Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Creator Name
        </label>
        <Controller
          name="authorName"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Enter creator name"
              // Keep the field editable even when a member is selected
              readOnly={false}
            />
          )}
        />
        {errors.authorName && (
          <p className="mt-1 text-sm text-red-600">{errors.authorName.message}</p>
        )}
      </div>

      {/* Post As */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Post as <span className="text-primary">*</span>
        </label>
        <Controller
          name="postAs"
          control={control}
          defaultValue={localStorage.getItem('announcementPostAs') || 'Creator'}
          render={({ field: { onChange, value } }) => (
            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="Creator"
                  checked={value === 'Creator'}
                  onChange={(e) => handlePostAsChange(e.target.value, onChange)}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary accent-primary"
                />
                <span className="ml-2 text-sm text-gray-700">Creator</span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  value="Group"
                  checked={value === 'Group'}
                  onChange={(e) => handlePostAsChange(e.target.value, onChange)}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary accent-primary"
                />
                <span className="ml-2 text-sm text-gray-700">Group</span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  value="Member"
                  checked={value === 'Member'}
                  onChange={(e) => handlePostAsChange(e.target.value, onChange)}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary accent-primary"
                />
                <span className="ml-2 text-sm text-gray-700">Member</span>
              </label>
            </div>
          )}
        />
        {errors.postAs && (
          <p className="mt-1 text-sm text-red-600">{errors.postAs.message}</p>
        )}
      </div>

      {/* Member Selector - Show when Member is selected */}
      {postAs === 'Member' && (
        <div className="mt-4">
          <MemberSelector
            value={watch('selectedMemberId')}
            onChange={handleMemberSelect}
            error={errors.selectedMemberId?.message}
          />
        </div>
      )}

      {/* Author Display */}
      {authorName && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md border">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Author:</span> {authorName}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Posting as: {postAs}
          </p>
        </div>
      )}
    </div>
  );
};

export default AnnouncementAuthor;
