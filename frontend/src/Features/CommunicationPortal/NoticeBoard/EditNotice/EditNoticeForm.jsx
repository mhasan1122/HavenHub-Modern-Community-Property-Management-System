import React, { useState } from "react";
import { Controller } from "react-hook-form";
import { Upload, X } from "lucide-react";
import { FaFilePdf } from "react-icons/fa";
import PriorityDropdown from "../components/PriorityDropdown";
import LabelSelector from "../components/LabelSelector";
import Calendar from "../components/Calendar";
import TimePicker from "../components/TimePicker";
import TowerSelector from "../../Announcements/components/TowerSelector";
import UnitSelector from "../../Announcements/components/UnitSelector";
import GroupSelector from "../../Announcements/components/GroupSelector";
import MemberSelector from "../../Announcements/components/MemberSelector";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

// Helper function to check if file is a PDF
const isPDF = (fileName, fileType) => {
  if (fileType) {
    return fileType === 'application/pdf';
  }
  return fileName?.toLowerCase().endsWith('.pdf');
};

/**
 * EditNoticeForm Component
 * Comprehensive form for editing notices with sectioned design and advanced functionality
 */
const EditNoticeForm = ({
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
  notice,
  formChanged,

  // Error states
  fileUploadError,
  dateOrderError,

  // Handlers
  handleFileUpload,
  removeAttachment,
  handleMemberSelect,
  handleGroupSelect,
  isFormValid,

  // Watched values
  watchedValues,
  selectedTowers
}) => {
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Handle image preview
  const handleImagePreview = (attachment) => {
    setPreviewImage(attachment);
    setShowImagePreview(true);
  };

  // Close preview modal
  const closeImagePreview = () => {
    setShowImagePreview(false);
    setPreviewImage(null);
  };

  return (
    <div className="relative">
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
          <ModernLoadingAnimation />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4 sm:space-y-6">
        {/* Notice Author Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">Notice Author</h3>

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
                    value={currentUser?.full_name || currentUser?.fullName || 'Current User'}
                  />
                )}
              />
            </div>

            {/* Post as */}
            <div>
              <div className="flex items-center mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Post as <span className="text-primary">*</span>
                </label>
                <div className="ml-8">
                  <Controller
                    name="postAs"
                    control={control}
                    render={({ field }) => (
                      <div className="flex space-x-6">
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
                <p className="mt-1 text-sm text-red-600">{errors.postAs.message}</p>
              )}

              {/* Show preview text box for Creator */}
              {watchedValues.postAs === "Creator" && (
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

              {/* Group Selector - Show when Group is selected */}
              {watchedValues.postAs === "Group" && (
                <div className="mt-2">
                  <GroupSelector
                    value={watch("selectedGroupId")}
                    onChange={handleGroupSelect}
                    error={errors.selectedGroupId?.message}
                    disabled={true}
                  />
                </div>
              )}

              {/* Member Selector - Show when Member is selected */}
              {watchedValues.postAs === "Member" && (
                <div className="mt-2">
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
        </div>

        {/* Attachments Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
              Attachments <span className="text-primary">*</span>
            </label> 
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center transition-all duration-200 flex flex-col items-center justify-center">
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="edit-notice-file-upload"
              />
              <label
                htmlFor="edit-notice-file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center mb-2 sm:mb-3">
                  <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <span className="text-sm sm:text-base text-gray-900 font-medium">Upload Document</span>
              </label>
            </div>

            {/* Error Message */}
            <ErrorMessage message={fileUploadError} />

            {/* Display uploaded attachments */}
            {attachments.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  {/* <span className="text-sm font-medium text-gray-700">
                    Uploaded Attachments ({attachments.length}/10)
                  </span> */}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative group">
                      {isPDF(attachment.name || attachment.file_name, attachment.type || attachment.file_type) ? (
                        <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
                          <div className="flex flex-col items-center">
                            <FaFilePdf className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 mb-1" />
                            <span className="text-xs sm:text-sm text-gray-600 font-bold">PDF</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={attachment.url || attachment.base64 || attachment.preview}
                          alt={attachment.name || attachment.file_name}
                          className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => handleImagePreview(attachment)}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="flex flex-col items-center justify-center w-full h-20 bg-gray-100 rounded border"><span class="text-xs text-gray-500">Image</span></div>';
                          }}
                        />
                      )}

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

        {/* Notice Visibility Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">Notice Visibility</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                    placeholder="Select start date"
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
                    placeholder="Select start time"
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
                    placeholder="Select end date"
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
                    placeholder="Select end time"
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
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center px-4 sm:px-0">
          <button
            type="submit"
            disabled={isSubmitting || !formChanged || !isFormValid()}
            className={`w-full sm:w-auto sm:min-w-[200px] px-8 py-2.5 sm:py-3 rounded-md transition duration-200 font-medium text-sm sm:text-base ${
              formChanged && !isSubmitting && isFormValid()
                ? 'bg-primary text-white hover:bg-primaryHover cursor-pointer'
                : 'bg-white text-primary border-2 border-primary hover:bg-gray-50 cursor-not-allowed'
            } ${
              isSubmitting ? 'opacity-50' : ''
            }`}
          >
            {isSubmitting ? 'Updating...' : 'Send'}
          </button>
        </div>
        
     
      </form>

      {/* Image Preview Modal */}
      {showImagePreview && previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={closeImagePreview}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage.url || previewImage.base64 || previewImage.preview}
              alt={previewImage.name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded">
              {previewImage.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditNoticeForm;
