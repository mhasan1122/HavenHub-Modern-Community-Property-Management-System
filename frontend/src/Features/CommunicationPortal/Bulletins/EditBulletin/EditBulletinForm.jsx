import React from "react";
import { Controller } from "react-hook-form";
import { Upload, X } from "lucide-react";
import BulletinLabelSelector from "../components/BulletinLabelSelector";
import TowerSelector from "../../Announcements/components/TowerSelector";
import UnitSelector from "../../Announcements/components/UnitSelector";
import MemberSelector from "../../Announcements/components/MemberSelector";
import GroupSelector from "../../Announcements/components/GroupSelector";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

/**
 * EditBulletinForm Component
 * Form component for editing bulletins (without date/time and priority fields)
 */
const EditBulletinForm = ({
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
  attachmentsToDelete = [],

  // Error states
  fileUploadError,
  towerError,
  unitError,
  formError,
  apiError,
  titleWordLimitError,

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
  selectedTowers,

  // Edit-specific props
  updating,
  isAttachmentUpdating,
  hasFormBeenModified
}) => {
  return (
    <div className="relative">
      {/* Loading Overlay removed as per request */}

      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4 sm:space-y-6">
      {/* Bulletin Author Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">
          Bulletin Author
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
                  className="w-full px-3 py-2 border border-primary rounded-md bg-gray-50 text-gray-700 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  value={
                    currentUser?.full_name ||
                    currentUser?.fullName ||
                    "Current User"
                  }
                />
              )}
            />
            {errors.creatorName && (
              <ErrorMessage message={errors.creatorName.message} />
            )}
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
                      <label className={`flex items-center group ${field.value === "Creator" ? "cursor-default" : "cursor-not-allowed opacity-50"}`}>
                        <div className="relative">
                          <input
                            type="radio"
                            {...field}
                            value="Creator"
                            checked={field.value === "Creator"}
                            disabled={true}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:!border-primary peer-checked:border-4"></div>
                        </div>
                        <span className={`ml-2 text-sm ${field.value === "Creator" ? "text-gray-700" : "text-gray-500"}`}>
                          Creator
                        </span>
                      </label>
                      <label className={`flex items-center group ${field.value === "Group" ? "cursor-default" : "cursor-not-allowed opacity-50"}`}>
                        <div className="relative">
                          <input
                            type="radio"
                            {...field}
                            value="Group"
                            checked={field.value === "Group"}
                            disabled={true}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:!border-primary peer-checked:border-4"></div>
                        </div>
                        <span className={`ml-2 text-sm ${field.value === "Group" ? "text-gray-700" : "text-gray-500"}`}>
                          Group
                        </span>
                      </label>
                      <label className={`flex items-center group ${field.value === "Member" ? "cursor-default" : "cursor-not-allowed opacity-50"}`}>
                        <div className="relative">
                          <input
                            type="radio"
                            {...field}
                            value="Member"
                            checked={field.value === "Member"}
                            disabled={true}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full peer-checked:!border-primary peer-checked:border-4"></div>
                        </div>
                        <span className={`ml-2 text-sm ${field.value === "Member" ? "text-gray-700" : "text-gray-500"}`}>
                          Member
                        </span>
                      </label>
                    </div>
                  )}
                />
              </div>
            </div>
            {errors.postAs && (
              <ErrorMessage message={errors.postAs.message} />
            )}

            {/* Show preview text box for Creator */}
            {postAs === "Creator" && (
              <div className="mt-2">
                <input
                  type="text"
                  value={watch("creatorName")}
                  readOnly
                  className="w-full px-3 py-2 border border-primary rounded-md bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
                disabled={true}
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
                disabled={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bulletin Information Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">
          Bulletin Information
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Bulletin Title (max 10 words)"
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
                  <p
                    className={`text-xs ${
                      getTitleWordCount(field.value) > 10
                        ? "text-red-500"
                        : "text-gray-500"
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
          {(() => {
            // Filter out attachments that are marked for deletion for real-time UI update
            const activeAttachments = attachments ? attachments.filter(att => !attachmentsToDelete.includes(att.id)) : [];

            console.log("=== FORM ATTACHMENT DISPLAY ===");
            console.log("All attachments:", attachments);
            console.log("Attachments to delete:", attachmentsToDelete);
            console.log("Active attachments (filtered):", activeAttachments);

            return activeAttachments.length > 0 && (
              <div className="mt-3 relative">
                {isAttachmentUpdating && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded">
                    <ModernLoadingAnimation />
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeAttachments.map((attachment) => {
                    const isImage = attachment.type?.startsWith("image/") || attachment.file_type?.startsWith("image/");

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
                                  <path
                                    fillRule="evenodd"
                                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="text-xs text-black font-bold mt-1">PDF</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="text-xs text-gray-600 mt-1">DOC</span>
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          disabled={isAttachmentUpdating}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Label Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1">
          {/* Label */}
          <div>
            <Controller
              name="label"
              control={control}
              render={({ field }) => (
                <BulletinLabelSelector value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.label && (
              <ErrorMessage message={errors.label.message} />
            )}
          </div>
        </div>
      </div>

      {/* Tower and Unit Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
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
                  key={`towers-${field.value?.length || 0}`}
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
                  key={`units-${field.value?.length || 0}-${selectedTowers?.length || 0}`}
                  value={field.value}
                  onChange={field.onChange}
                  selectedTowers={selectedTowers}
                  placeholder="Select Units"
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
          disabled={!isFormValid() || isSubmitting || updating}
          className={`w-full sm:w-auto sm:min-w-[200px] px-6 sm:px-8 py-2.5 sm:py-3 rounded-md transition duration-200 font-medium text-sm sm:text-base ${
            hasFormBeenModified && !isSubmitting && !updating
              ? "bg-primary text-white hover:bg-primaryHover cursor-pointer"
              : "bg-white text-primary border-2 border-primary cursor-not-allowed"
          } ${
            (!isFormValid() || isSubmitting || updating) ? "opacity-50" : ""
          }`}
        >
          {isSubmitting || updating ? "Updating..." : "Send"}
        </button>
      </div>


    </form>
    </div>
  );
};

export default EditBulletinForm;

