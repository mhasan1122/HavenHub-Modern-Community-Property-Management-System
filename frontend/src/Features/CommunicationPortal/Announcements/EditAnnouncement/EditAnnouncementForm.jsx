import React from "react";
import { Controller } from "react-hook-form";
import { Upload, X } from "lucide-react";
import PriorityDropdown from "../components/PriorityDropdown";
import LabelSelector from "../components/LabelSelector";
import Calendar from "../components/Calendar";
import TimePicker from "../components/TimePicker";
import TowerSelector from "../components/TowerSelector";
import UnitSelector from "../components/UnitSelector";
import MemberSelector from "../components/MemberSelector";
import GroupSelector from "../components/GroupSelector";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

/**
 * EditAnnouncementForm Component
 * Form component for editing announcements
 */
const EditAnnouncementForm = ({
  // Form props
  control,
  handleSubmit,
  watch,
  setValue,
  errors,
  isSubmitting,
  onSubmit,

  // State props
  currentUser,
  attachments,
  announcement,
  hasFormBeenModified,
  onUnitsLoaded,

  // Error states
  titleWordLimitError,
  fileUploadError,
  dateOrderError,

  // Handlers
  handleTitleChange,
  getTitleWordCount,
  handleFileUpload,
  removeAttachment,
  handleMemberSelect,
  handleGroupSelect,
  isFormValid,

  // Watched values
  watchedValues,
  selectedTowers
}) => {
  return (
    <div className="relative">
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
          <ModernLoadingAnimation />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
      {/* Announcement Author Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">Announcement Author</h3>

        {/* Creator Name and Post as on different rows */}
        <div className="space-y-3 sm:space-y-4">
          {/* Creator Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Creator Name
            </label>
            <Controller
              name="creatorName"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                  value={currentUser?.full_name || currentUser?.fullName || 'Current User'}
                />
              )}
            />
          </div>

          {/* Post as */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center mb-3 gap-2 sm:gap-0">
              <label className="block text-sm font-semibold text-gray-700">
                Post as <span className="text-primary">*</span>
              </label>
              <div className="sm:ml-8">
                <Controller
                  name="postAs"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col sm:flex-row sm:space-x-6 space-y-3 sm:space-y-0">
                      <label className={`flex items-center ${announcement?.post_as === 'creator' ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}>
                        <div className="relative">
                          <input
                            type="radio"
                            {...field}
                            value="Creator"
                            checked={field.value === 'Creator'}
                            onChange={(e) => {
                              if (announcement?.post_as === 'creator') {
                                field.onChange(e.target.value);
                                // Clear member and group selections when switching to Creator
                                setValue('selectedMemberId', '');
                                setValue('selectedMemberName', '');
                                setValue('selectedGroupId', '');
                                setValue('selectedGroupName', '');
                                // Set creator name to current user
                                const user = currentUser || (() => {
                                  try {
                                    const member = localStorage.getItem('member');
                                    return member ? JSON.parse(member) : null;
                                  } catch (error) {
                                    return null;
                                  }
                                })();
                                if (user) {
                                  setValue('creatorName', user.full_name || user.fullName || 'Current User');
                                }
                              }
                            }}
                            disabled={announcement?.post_as !== 'creator'}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:border-primary peer-checked:border-4"></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-700">Creator</span>
                      </label>
                      <label className={`flex items-center ${announcement?.post_as === 'group' ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}>
                        <div className="relative">
                          <input
                            type="radio"
                            {...field}
                            value="Group"
                            checked={field.value === 'Group'}
                            onChange={(e) => {
                              if (announcement?.post_as === 'group') {
                                field.onChange(e.target.value);
                                // Clear member selection when switching to Group
                                setValue('selectedMemberId', '');
                                setValue('selectedMemberName', '');
                                // Clear group selection to allow fresh selection
                                setValue('selectedGroupId', '');
                                setValue('selectedGroupName', '');
                                // Set creator name to current user when switching to Group
                                const user = currentUser || (() => {
                                  try {
                                    const member = localStorage.getItem('member');
                                    return member ? JSON.parse(member) : null;
                                  } catch (error) {
                                    return null;
                                  }
                                })();
                                if (user) {
                                  setValue('creatorName', user.full_name || user.fullName || 'Current User');
                                }
                              }
                            }}
                            disabled={announcement?.post_as !== 'group'}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:border-primary peer-checked:border-4"></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-700">Group</span>
                      </label>
                      <label className={`flex items-center ${announcement?.post_as === 'member' ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}>
                        <div className="relative">
                          <input
                            type="radio"
                            {...field}
                            value="Member"
                            checked={field.value === 'Member'}
                            onChange={(e) => {
                              if (announcement?.post_as === 'member') {
                                field.onChange(e.target.value);
                                // Clear member and group selections when switching to Member
                                setValue('selectedMemberId', '');
                                setValue('selectedMemberName', '');
                                setValue('selectedGroupId', '');
                                setValue('selectedGroupName', '');
                                // Set creator name to current user when switching to Member (like Group)
                                const user = currentUser || (() => {
                                  try {
                                    const member = localStorage.getItem('member');
                                    return member ? JSON.parse(member) : null;
                                  } catch (error) {
                                    return null;
                                  }
                                })();
                                if (user) {
                                  setValue('creatorName', user.full_name || user.fullName || 'Current User');
                                }
                              }
                            }}
                            disabled={announcement?.post_as !== 'member'}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:border-primary peer-checked:border-4"></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-700">Member</span>
                      </label>
                    </div>
                  )}
                />
              </div>
            </div>
            {errors.postAs && (
              <p className="mt-1 text-sm text-red-600">{errors.postAs.message}</p>
            )}
          </div>

          {/* Group Selector - Show when Group is selected */}
          {watchedValues.postAs === 'Group' && (
            <div>
              <GroupSelector
                value={watch('selectedGroupId')}
                onChange={handleGroupSelect}
                error={errors.selectedGroupId?.message}
                disabled={true} // Disable during editing
              />
            </div>
          )}

          {/* Member Selector - Show when Member is selected */}
          {watchedValues.postAs === 'Member' && (
            <div>
              <MemberSelector
                value={watch('selectedMemberId')}
                onChange={handleMemberSelect}
                error={errors.selectedMemberId?.message}
                disabled={true} // Disable during editing
              />
            </div>
          )}

          {/* Auto Name Field - Only show when Creator is selected */}
          {watchedValues.postAs === 'Creator' && (
            <div>
              <Controller
                name="autoName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                    placeholder="Auto-filled from Creator Name"
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Announcement Information Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">Announcement Information</h3>

        {/* Title */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Title <span className="text-primary">*</span>
          </label>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <div>
                <input
                  {...field}
                  type="text"
                  onChange={(e) => handleTitleChange(e.target.value, field.onChange)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Announcement Title (max 10 words)"
                  value={field.value}
                />
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {errors.title && (
                      <ErrorMessage message={errors.title.message} />
                    )}
                    {titleWordLimitError && (
                      <ErrorMessage message={titleWordLimitError} />
                    )}
                  </div>
                  <p className={`text-xs ${getTitleWordCount(field.value) > 10 ? 'text-red-500' : 'text-gray-500'}`}>

                  </p>
                </div>
              </div>
            )}
          />
        </div>

        {/* Description */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Description
          </label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                rows={4}
                onChange={(e) => {
                  const inputValue = e.target.value;

                  // Only limit if we exceed 100 words
                  if (inputValue.trim() === "") {
                    field.onChange(inputValue);
                    return;
                  }

                  const words = inputValue.trim().split(/\s+/);
                  if (words.length <= 100) {
                    // Allow normal typing if within limit
                    field.onChange(inputValue);
                  } else {
                    // Only limit when exceeding 100 words
                    const limited = words.slice(0, 100).join(" ");
                    field.onChange(limited);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Write your description here... (max 100 words)"
                value={field.value}
              />
            )}
          />
          {errors.description && (
            <ErrorMessage message={errors.description.message} />
          )}
        </div>

        {/* Attachments */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Attachments
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4">
            <input
              type="file"
              multiple
              accept="image/*,.webp,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              id="edit-file-upload"
            />
            <label
              htmlFor="edit-file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">Click to upload files</span>
            </label>
          </div>

          {/* Error Message */}
          <ErrorMessage message={fileUploadError} />

          {/* Display uploaded files */}
          {attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attachments.map((attachment) => {
                const isImage = attachment.type?.startsWith('image/') ||
                               attachment.file_type?.startsWith('image/') ||
                               (attachment.name && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(attachment.name));

                return (
                  <div key={attachment.id} className="relative">
                    {isImage ? (
                      <img
                        src={attachment.url || attachment.file_url}
                        alt={attachment.name || attachment.file_name}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
                        {(attachment.type === 'application/pdf' || attachment.file_type === 'application/pdf' ||
                          (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))) ? (
                          <div className="flex flex-col items-center">
                            <svg className="w-8 h-8 text-black font-bold" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-black font-bold mt-1">PDF</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-gray-600 mt-1">DOC</span>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Label and Priority Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Label */}
          <div>
            <Controller
              name="label"
              control={control}
              render={({ field }) => (
                <LabelSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.label?.message}
                />
              )}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Priority <span className="text-primary">*</span>
            </label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <PriorityDropdown
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.priority?.message}
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* Announcement Visibility Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">Announcement Visibility</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Start Date <span className="text-primary">*</span>
            </label>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <Calendar
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Start Date"
                />
              )}
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
            )}
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Start Time <span className="text-primary">*</span>
            </label>
            <Controller
              name="startTime"
              control={control}
              render={({ field }) => (
                <TimePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Start Time"
                />
              )}
            />
            {errors.startTime && (
              <p className="mt-1 text-sm text-red-600">{errors.startTime.message}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              End Date <span className="text-primary">*</span>
            </label>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <Calendar
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="End Date"
                />
              )}
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
            )}
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              End Time <span className="text-primary">*</span>
            </label>
            <Controller
              name="endTime"
              control={control}
              render={({ field }) => (
                <TimePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="End Time"
                />
              )}
            />
            {errors.endTime && (
              <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
            )}
          </div>
        </div>

        {/* Date/Time Validation Error */}
        {dateOrderError && (
          <ErrorMessage message={dateOrderError} />
        )}
      </div>

      {/* Tower and Unit Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Tower Selector */}
          <div>
            <Controller
              name="selectedTowers"
              control={control}
              render={({ field }) => (
                <TowerSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.selectedTowers?.message}
                />
              )}
            />
          </div>

          {/* Unit Selector */}
          <div>
            <Controller
              name="selectedUnits"
              control={control}
              render={({ field }) => (
                <UnitSelector
                  value={field.value}
                  onChange={field.onChange}
                  selectedTowers={selectedTowers}
                  error={errors.selectedUnits?.message}
                  isEditing={true}
                  onUnitsLoaded={onUnitsLoaded}
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center px-0">
        <button
          type="submit"
          disabled={isSubmitting || !isFormValid() || !hasFormBeenModified}
          className={`w-full sm:w-auto sm:min-w-[200px] px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition duration-200 font-medium text-sm sm:text-base ${
            hasFormBeenModified && isFormValid() && !isSubmitting
              ? 'bg-primary text-white hover:bg-primaryHover cursor-pointer'
              : 'bg-white text-primary border-2 border-primary opacity-50 cursor-not-allowed'
          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? 'Updating...' : 'Send'}
        </button>
      </div>
    </form>
    </div>
  );
};

export default EditAnnouncementForm;
