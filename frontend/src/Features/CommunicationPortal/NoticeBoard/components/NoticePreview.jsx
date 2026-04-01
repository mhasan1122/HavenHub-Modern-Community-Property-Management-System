import React, { useState } from "react";
import { Flag, Image as ImageIcon } from "lucide-react";
import { VscFilePdf } from "react-icons/vsc";
import { FaFileWord } from "react-icons/fa";
import { HiUserCircle } from "react-icons/hi";
import { FaUserGroup } from "react-icons/fa6";
import { IoIosNotificationsOutline } from "react-icons/io";
import { useNoticeUserCount } from "../hooks/useUserCount";

/**
 * NoticePreview Component
 * Real-time preview of the announcement as it will appear when posted
 */
const NoticePreview = ({ data, currentUser, isInModal = false, onImageClick, onDocumentClick }) => {

  // Use the custom hook for user count calculation
  // Handle both selectedUnits (from create/edit form) and target_units_data (from history/existing announcements)
  const { userCount, loading: loadingUserCount } = useNoticeUserCount(data);

  // Get priority configuration using Tailwind CSS classes for consistency
  const getPriorityConfig = (priority) => {
    const configs = {
      urgent: { colorClass: "text-urgent", bgColor: "#FEF2F2", label: "Urgent" }, // Using urgent deep red color class
      high: { colorClass: "text-warning", bgColor: "#FFFBEB", label: "High" }, // Using warning color class
      normal: { colorClass: "text-primary", bgColor: "#EBF5F5", label: "Normal" }, // Using primary color class
      low: { colorClass: "text-textMedium", bgColor: "#F5F5F5", label: "Low" } // Using textMedium color class
    };
    return configs[priority?.toLowerCase()] || null;
  };

  // Get announcement status using Tailwind config colors
  const getStatus = () => {
    if (!data.startDate || !data.startTime || !data.endDate || !data.endTime) {
      return { status: "Draft", color: "#666666", bgColor: "#F5F5F5" }; // Using textMedium and label
    }

    try {
      const now = new Date();

      // Handle different date formats and ensure proper parsing
      let startDateStr = data.startDate;
      let endDateStr = data.endDate;

      // If dates are in YYYY-MM-DD format, use them directly
      if (typeof data.startDate === "string" && data.startDate.includes("-")) {
        startDateStr = data.startDate;
      } else {
        // Convert to YYYY-MM-DD format if needed
        const startDateObj = new Date(data.startDate);
        startDateStr = startDateObj.toISOString().split("T")[0];
      }

      if (typeof data.endDate === "string" && data.endDate.includes("-")) {
        endDateStr = data.endDate;
      } else {
        // Convert to YYYY-MM-DD format if needed
        const endDateObj = new Date(data.endDate);
        endDateStr = endDateObj.toISOString().split("T")[0];
      }

      // Create datetime objects for comparison
      const startDateTime = new Date(`${startDateStr}T${data.startTime}`);
      const endDateTime = new Date(`${endDateStr}T${data.endTime}`);

      if (now < startDateTime) {
        return { status: "Upcoming", color: "#FF8682", bgColor: "#FFFBEB" }; // Using secondary color
      } else if (now >= startDateTime && now <= endDateTime) {
        return { status: "On Going", color: "#28A745", bgColor: "#EBF5F5" }; // Using success and primaryLight
      } else {
        return { status: "Expired", color: "#FF8682", bgColor: "#FEF2F2" }; // Using secondary (error) color
      }
    } catch (error) {
      console.warn("Error calculating status in preview:", error);
      return { status: "Draft", color: "#666666", bgColor: "#F5F5F5" }; // Using textMedium and label
    }
  };

  // Format date and time
  const formatDateTime = (date, time) => {
    if (!date || !time) return "";

    let formattedDate = "";

    // Handle different date formats
    if (typeof date === "string") {
      // If date is in YYYY-MM-DD format (from Calendar component)
      if (date.includes("-") && date.length === 10) {
        const [year, month, day] = date.split("-");
        formattedDate = `${day}-${month}-${year}`;
      } else {
        // If date is already formatted or other string format
        const dateObj = new Date(date);
        const day = dateObj.getDate().toString().padStart(2, "0");
        const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const year = dateObj.getFullYear();
        formattedDate = `${day}-${month}-${year}`;
      }
    } else if (date instanceof Date) {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      formattedDate = `${day}-${month}-${year}`;
    } else {
      // Fallback for other formats
      const dateObj = new Date(date);
      const day = dateObj.getDate().toString().padStart(2, "0");
      const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const year = dateObj.getFullYear();
      formattedDate = `${day}-${month}-${year}`;
    }

    // Format time (convert 24-hour to 12-hour if needed)
    let formattedTime = time;
    if (time.includes(":") && !time.includes("AM") && !time.includes("PM")) {
      // Convert 24-hour format to 12-hour format
      const [hours, minutes] = time.split(":");
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const period = hour24 >= 12 ? "pm" : "am";
      formattedTime = `${hour12}:${minutes}${period}`;
    }

    return `${formattedDate} at ${formattedTime}`;
  };



  // Helper function to check if file is a PDF
  const isPDF = (fileName, fileType) => {
    if (fileType) {
      return fileType === "application/pdf";
    }
    return fileName?.toLowerCase().endsWith(".pdf");
  };

  // Helper function to check if file is a DOC
  const isDoc = (fileName, fileType) => {
    if (fileType) {
      return (
        fileType === "application/msword" ||
        fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    }
    return fileName?.toLowerCase().match(/\.(doc|docx)$/);
  };

  const priorityConfig = getPriorityConfig(data.priority);
  const statusConfig = getStatus();

  return (
    <div className="space-y-4 ">
      {/* Preview Header */}

      {/* Announcement Card Preview */}
      <div className="border-[1px] border-primary rounded-lg overflow-hidden bg-white shadow-sm ">
        {/* Header with Author Info and Status */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            {/* Left side - Author Info */}
            <div className="flex items-center space-x-3">
              {/* Author Avatar and Info */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center">
                {data.postAs === "Creator" || data.postAs === "creator" ? (
                  <HiUserCircle className="w-8 h-8" color="gray" />
                ) : data.postAs === "Group" || data.postAs === "group" ? (
                  <FaUserGroup className="w-8 h-8" color="gray" />
                ) : data.postAs === "Member" || data.postAs === "member" ? (
                  <FaUserGroup className="w-8 h-8" color="gray" />
                ) : (
                  <HiUserCircle className="w-8 h-8" color="gray" />
                )}
              </div>
              <div>
                <h3 className={`${isInModal ? "text-base" : "text-sm"} font-bold text-gray-900`}>
                  {data.postAs === "Group"
                    ? data.selectedGroupName || "Group Name"
                    : data.postAs === "Member"
                      ? data.selectedMemberName || "Member Name"
                      : data.authorName || "Author Name"}
                </h3>
                <p className={`${isInModal ? "text-sm" : "text-xs"} font-bold text-gray-900`}>
                  Creator {data.creatorName ||
                    data.authorName ||
                    currentUser?.fullName ||
                    currentUser?.full_name ||
                    "Not specified"}
                </p>
              </div>
            </div>

            {/* Right side - Priority Flag, Status and Notification */}
            <div className="flex items-center space-x-2">
              {/* Priority Flag */}
              {data.priority && priorityConfig && (
                <Flag
                  className={`w-4 h-4 ${priorityConfig.colorClass}`}
                  fill="currentColor"
                />
              )}
              <IoIosNotificationsOutline
                className="w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700 flex items-center">
                {loadingUserCount && userCount === 0 ? (
                  <div className="flex items-center">
                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
                    0
                  </div>
                ) : (
                  userCount
                )}
              </span>
            </div>
          </div>

          {/* Date Info - Stack on mobile, inline on larger screens to prevent truncation */}
          <div className={`mt-2 ${isInModal ? "text-xs" : "text-[10px]"} flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-3`}>
            <span className="text-primary font-bold" title={formatDateTime(data.startDate, data.startTime) || ""}>
              Start: {formatDateTime(data.startDate, data.startTime) || ""}
            </span>
            <span className="text-secondary font-bold" title={formatDateTime(data.endDate, data.endTime) || ""}>
              Expire: {formatDateTime(data.endDate, data.endTime) || ""}
            </span>
          </div>

          {/* Label Info - Next line */}
          {data.label && (
            <div className={`mt-1 ${isInModal ? "text-sm" : "text-xs"}`}>
              <div className="flex flex-wrap gap-1">
                {data.label.split(",").map((label, index) => (
                  <span
                    key={index}
                    className={`bg-label text-textDark ${isInModal ? "text-xs" : "text-[10px]"} px-2 py-1 rounded font-bold`}
                  >
                    {label.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">


          {/* Attachments */}
          <div className="mb-4 px-2">
            {data.attachments && data.attachments.length > 0 ? (
              <div className="space-y-3">
                {/* Main/First Image/PDF - Display prominently */}
                <div
                  className={`relative bg-gray-100 overflow-hidden transition-all duration-200 w-full ${isInModal ? "max-w-full h-[365px]" : "max-w-[316px] h-[243px]"} rounded-[8px] ${isInModal
                      ? "cursor-pointer hover:opacity-95 shadow-md"
                      : "border-2 border-gray-200"
                    }`}
                  onClick={() => {
                    if (!isInModal) return;
                    if (isDoc(data.attachments[0].name, data.attachments[0].type) || isPDF(data.attachments[0].name, data.attachments[0].type)) {
                      if (onDocumentClick) onDocumentClick(data.attachments[0]);
                    } else {
                      if (onImageClick) onImageClick(data.attachments[0], data);
                    }
                  }}
                >
                  {isPDF(data.attachments[0].name, data.attachments[0].type) ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <VscFilePdf className="w-16 h-16 text-red-600 font-bold" />
                      <div className="ml-3 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          PDF Document
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.attachments[0].name}
                        </div>
                      </div>
                    </div>
                  ) : isDoc(
                    data.attachments[0].name,
                    data.attachments[0].type
                  ) ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <FaFileWord className="w-16 h-16 text-blue-500" />
                      <div className="ml-3 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          Word Document
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.attachments[0].name}
                        </div>
                      </div>
                    </div>
                  ) : data.attachments[0].preview ||
                    data.attachments[0].url ||
                    data.attachments[0].file_url ||
                    data.attachments[0].base64 ? (
                    <div className={`w-full h-full ${isInModal ? "p-1" : ""}`}>
                      <img
                        src={
                          data.attachments[0].preview ||
                          data.attachments[0].url ||
                          data.attachments[0].file_url ||
                          data.attachments[0].base64
                        }
                        alt={data.attachments[0].name}
                        className={`w-full h-full object-cover ${isInModal ? "rounded-sm border border-gray-200" : ""
                          }`}
                        onError={(e) => {
                          console.error(
                            "Preview image failed to load:",
                            e.target.src
                          );
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Additional Images/Files - Show as thumbnails if more than 1 */}
                {data.attachments.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {data.attachments.slice(1, 5).map((file, index) => (
                      <div
                        key={index + 1}
                        className={`relative bg-gray-100 overflow-hidden transition-all duration-200 w-full h-[65px] rounded-[8px] ${isInModal
                            ? "cursor-pointer hover:opacity-95 shadow-sm"
                            : "border border-gray-200"
                          }`}
                        onClick={() => {
                          if (!isInModal) return;
                          if (isDoc(file.name, file.type) || isPDF(file.name, file.type)) {
                            if (onDocumentClick) onDocumentClick(file);
                          } else {
                            if (onImageClick) onImageClick(file, data);
                          }
                        }}
                      >
                        {isPDF(file.name, file.type) ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <VscFilePdf className="w-6 h-6 text-red-600 font-bold" />
                          </div>
                        ) : isDoc(file.name, file.type) ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <FaFileWord className="w-6 h-6 text-blue-500" />
                          </div>
                        ) : file.preview || file.url || file.file_url || file.base64 ? (
                          <div className="w-full h-full">
                            <img
                              src={file.preview || file.url || file.file_url || file.base64}
                              alt={file.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error(
                                  "Thumbnail image failed to load:",
                                  e.target.src
                                );
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Default preview image placeholder */
              <div className="w-full text-white p-4 rounded text-center">
                <div className="text-lg font-bold mb-2">No Attachments</div>
                <div className="text-xs leading-relaxed">
                  Click to add attachments
                </div>
                <div className="mt-2 text-xs"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoticePreview;
