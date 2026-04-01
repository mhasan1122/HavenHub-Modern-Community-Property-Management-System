import React from "react";
import { Controller } from "react-hook-form";
import { Upload, X } from "lucide-react";
import { FaCloudUploadAlt } from "react-icons/fa";
import PriorityDropdown from "../components/PriorityDropdown";
import LabelSelector from "../components/LabelSelector";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import TimePicker from "../components/TimePicker";
import TowerSelector from "../components/TowerSelector";
import UnitSelector from "../components/UnitSelector";
import MemberSelector from "../components/MemberSelector";
import GroupSelector from "../components/GroupSelector";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

/**
 * AddAnnouncementForm Component
 * Form component for creating announcements
 */
const AddAnnouncementForm = ({
  // Form props
  control,
  handleSubmit,
  watch,
  setValue,
  errors,
  isSubmitting,
  onSubmit,
  onError,

  // State props
  currentUser,
  attachments,
  onUnitsLoaded,

  // Error states
  titleError,
  descriptionError,
  priorityError,
  labelError,
  startDateError,
  startTimeError,
  endDateError,
  endTimeError,
  postAsError,
  fileUploadError,
  towerError,
  unitError,
  formError,
  apiError,
  titleWordLimitError,
  dateOrderError,

  // Handlers
  handleTitleChange,
  getTitleWordCount,
  handleFileUpload,
  removeAttachment,
  handleMemberSelect,
  handleGroupSelect,
  savePostAsPreference,
  isFormValid,

  // Watched values
  postAs,
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

      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4 sm:space-y-6">
        {/* Announcement Author Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">
            Announcement Author
          </h3>

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
                    className="login-field-input bg-gray-50 text-gray-700 cursor-not-allowed"
                    value={
                      currentUser?.full_name ||
                      currentUser?.fullName ||
                      "Current User"
                    }
                  />
                )}
              />
            </div>

            {/* Post as */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2 sm:gap-0">
                <label className="block text-sm font-semibold text-gray-700">
                  Post as <span className="text-primary">*</span>
                </label>
                <div>
                  <Controller
                    name="postAs"
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-2 sm:space-x-6 sm:space-y-0">
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="radio"
                              {...field}
                              value="Creator"
                              checked={field.value === "Creator"}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                savePostAsPreference(e.target.value);
                                // Clear member and group selections when switching to Creator
                                setValue("selectedMemberId", "");
                                setValue("selectedMemberName", "");
                                setValue("selectedGroupId", "");
                                setValue("selectedGroupName", "");
                                // Set creator name to current user
                                const user =
                                  currentUser ||
                                  (() => {
                                    try {
                                      const member =
                                        localStorage.getItem("member");
                                      return member ? JSON.parse(member) : null;
                                    } catch (error) {
                                      return null;
                                    }
                                  })();
                                if (user) {
                                  setValue(
                                    "creatorName",
                                    user.full_name ||
                                    user.fullName ||
                                    "Current User"
                                  );
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:border-primary peer-checked:border-4"></div>
                          </div>
                          <span className="ml-2 text-sm text-gray-700">
                            Creator
                          </span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="radio"
                              {...field}
                              value="Group"
                              checked={field.value === "Group"}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                savePostAsPreference(e.target.value);
                                // Clear member selection when switching to Group
                                setValue("selectedMemberId", "");
                                setValue("selectedMemberName", "");
                                // Clear group selection to allow fresh selection
                                setValue("selectedGroupId", "");
                                setValue("selectedGroupName", "");
                                // Set creator name to current user when switching to Group
                                const user =
                                  currentUser ||
                                  (() => {
                                    try {
                                      const member =
                                        localStorage.getItem("member");
                                      return member ? JSON.parse(member) : null;
                                    } catch (error) {
                                      return null;
                                    }
                                  })();
                                if (user) {
                                  setValue(
                                    "creatorName",
                                    user.full_name ||
                                    user.fullName ||
                                    "Current User"
                                  );
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:border-primary peer-checked:border-4"></div>
                          </div>
                          <span className="ml-2 text-sm text-gray-700">
                            Group
                          </span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="radio"
                              {...field}
                              value="Member"
                              checked={field.value === "Member"}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                savePostAsPreference(e.target.value);
                                // Clear member and group selections when switching to Member
                                setValue("selectedMemberId", "");
                                setValue("selectedMemberName", "");
                                setValue("selectedGroupId", "");
                                setValue("selectedGroupName", "");
                                // Set creator name to current user when switching to Member (like Group)
                                const user =
                                  currentUser ||
                                  (() => {
                                    try {
                                      const member =
                                        localStorage.getItem("member");
                                      return member ? JSON.parse(member) : null;
                                    } catch (error) {
                                      return null;
                                    }
                                  })();
                                if (user) {
                                  setValue(
                                    "creatorName",
                                    user.full_name ||
                                    user.fullName ||
                                    "Current User"
                                  );
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:border-primary peer-checked:border-4"></div>
                          </div>
                          <span className="ml-2 text-sm text-gray-700">
                            Member
                          </span>
                        </label>
                      </div>
                    )}
                  />
                </div>
              </div>
              {errors.postAs && <ErrorMessage message={postAsError} />}

              {/* Show preview text box for Creator */}
              {postAs === "Creator" && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={watch("creatorName")}
                    readOnly
                    className="login-field-input bg-gray-50 text-gray-700 cursor-not-allowed"
                    placeholder="Preview of creator name"
                  />
                </div>
              )}
            </div>

            {/* Group Selector - Show when Group is selected */}
            {postAs === "Group" && (
              <div>
                <GroupSelector
                  value={watch("selectedGroupId")}
                  onChange={handleGroupSelect}
                  error={errors.selectedGroupId?.message}
                />
              </div>
            )}

            {/* Member Selector - Show when Member is selected */}
            {postAs === "Member" && (
              <div>
                <MemberSelector
                  value={watch("selectedMemberId")}
                  onChange={handleMemberSelect}
                  error={errors.selectedMemberId?.message}
                />
              </div>
            )}
          </div>
        </div>

        {/* Announcement Information Section */}
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">
            Announcement Information
          </h3>

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
                    onChange={(e) =>
                      handleTitleChange(e.target.value, field.onChange)
                    }
                    className="login-field-input"
                    placeholder="Announcement Title (max 10 words)"
                    value={field.value}
                  />
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-1 gap-1">
                    <div>
                      <ErrorMessage message={titleError} />
                      {titleWordLimitError && (
                        <p className="text-sm text-error">
                          {titleWordLimitError}
                        </p>
                      )}
                    </div>
                    <p
                      className={`text-xs ${getTitleWordCount(field.value) > 10
                        ? "text-error"
                        : "text-textMedium"
                        }`}
                    ></p>
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
                  className="login-field-input resize-y"
                  placeholder="Write your description here... (max 100 words)"
                  value={field.value}
                />
              )}
            />
            {errors.description && <ErrorMessage message={descriptionError} />}
          </div>

          {/* Attachments */}
          <div className="mb-3 sm:mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Attachments
            </label>
            <div className="border-dashed border rounded-lg p-4 sm:p-6 text-center transition-all duration-200 flex flex-col items-center justify-center border-gray-300">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-3">
                  <FaCloudUploadAlt className="text-white text-2xl" />
                </div>
                <p className="text-sm text-gray-900 font-medium">
                  Upload Document
                </p>
              </label>
            </div>

            {/* Error Message */}
            <ErrorMessage message={fileUploadError} />

            {/* Display uploaded files */}
            {attachments.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="relative">
                    {attachment.loading ? (
                      // Loading skeleton
                      <div className="w-full h-20 bg-gray-200 rounded border flex items-center justify-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-1"></div>
                          <span className="text-xs text-gray-500">Loading...</span>
                        </div>
                      </div>
                    ) : attachment.type.startsWith("image/") ? (
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
                        {attachment.type === "application/pdf" ? (
                          <div className="flex flex-col items-center">
                            <svg
                              className="w-8 h-8 text-black font-bold"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-xs text-black font-bold mt-1">
                              PDF
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <svg
                              className="w-8 h-8 text-info"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-xs text-gray-600 mt-1">
                              DOC
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {!attachment.loading && (
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
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
                  <LabelSelector value={field.value} onChange={field.onChange} />
                )}
              />
              <ErrorMessage message={labelError} />
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
                  />
                )}
              />
              <ErrorMessage message={priorityError} />
            </div>
          </div>
        </div>

        {/* Announcement Visibility Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">
            Announcement Visibility
          </h3>

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
                  <ModernDatePicker
                    label=""
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Select Start Date"
                    name="startDate"
                    error={errors.startDate?.message || ""}
                    required
                    inputClassName="h-[38px]"
                    maxYearOffset={10}
                    minDate={new Date().toISOString().split('T')[0]}
                  />
                )}
              />
              {errors.startDate && <ErrorMessage message={startDateError} />}
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
                    placeholder=" Select Start Time"
                  />
                )}
              />
              {errors.startTime && <ErrorMessage message={startTimeError} />}
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
                  <ModernDatePicker
                    label=""
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Select End Date"
                    name="endDate"
                    error={errors.endDate?.message || ""}
                    required
                    inputClassName="h-[38px]"
                    maxYearOffset={10}
                    minDate={watch('startDate') || new Date().toISOString().split('T')[0]}
                  />
                )}
              />
              {errors.endDate && <ErrorMessage message={endDateError} />}
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
                    placeholder="Select End Time"
                  />
                )}
              />
              {errors.endTime && <ErrorMessage message={endTimeError} />}
            </div>
          </div>
          {dateOrderError && <ErrorMessage message={dateOrderError} />}
        </div>

        {/* Tower and Unit Section */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Tower */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tower
              </label>
              <Controller
                name="selectedTowers"
                control={control}
                render={({ field }) => (
                  <TowerSelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Towers"
                  />
                )}
              />
              {errors.selectedTowers && <ErrorMessage message={towerError} />}
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Unit
              </label>
              <Controller
                name="selectedUnits"
                control={control}
                render={({ field }) => (
                  <UnitSelector
                    value={field.value}
                    onChange={field.onChange}
                    selectedTowers={selectedTowers}
                    placeholder="Select Units"
                    onUnitsLoaded={onUnitsLoaded}
                  />
                )}
              />
              {errors.selectedUnits && <ErrorMessage message={unitError} />}
            </div>
          </div>
        </div>

        {/* Form Error Message */}
        <ErrorMessage message={formError} />

        {/* API Error Message */}
        <ErrorMessage message={apiError} />

        {/* Submit Button */}
        <div className="flex justify-center px-0">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full sm:w-auto sm:min-w-[200px] px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition duration-200 font-medium text-sm sm:text-base ${isFormValid() && !isSubmitting
              ? "bg-primary text-white hover:bg-primaryHover"
              : "bg-white text-primary border-2 border-primary hover:bg-gray-50"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
          >
            {isSubmitting ? "Creating..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddAnnouncementForm;
