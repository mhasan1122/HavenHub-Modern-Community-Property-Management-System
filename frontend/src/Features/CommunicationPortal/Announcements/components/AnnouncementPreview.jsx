import React, { useState } from "react";
import { Flag, Image as ImageIcon } from "lucide-react";
import { VscFilePdf } from "react-icons/vsc";
import { FaFileWord } from "react-icons/fa";
import { HiUserCircle } from "react-icons/hi";
import { FaUserGroup } from "react-icons/fa6";
import { IoIosNotificationsOutline } from "react-icons/io";
import { useUserCount } from "../hooks/useUserCount";

/**
 * AnnouncementPreview Component
 * Real-time preview of the announcement as it will appear when posted
 */
const AnnouncementPreview = ({ data, currentUser, isInModal = false, onImageClick, onDocumentClick }) => {
  const [expandedTitle, setExpandedTitle] = useState(false);

  // Use the custom hook for user count calculation
  // Handle both selectedUnits (from create/edit form) and target_units_data (from history/existing announcements)
  // When "All" is selected, targetUnitIds contains expanded unit IDs from the form
  const targetUnits =
    data.targetUnitIds?.length > 0
      ? data.targetUnitIds
      : data.selectedUnits || data.target_units_data?.map((unit) => unit.id) || [];
  const { userCount, loading: loadingUserCount } = useUserCount(targetUnits);

  // Get priority configuration
  const getPriorityConfig = (priority) => {
    const configs = {
      urgent: {
        iconClass: "text-red-500",
        textClass: "text-red-600",
        bgClass: "bg-red-50",
        label: "Urgent"
      },
      high: {
        iconClass: "text-amber-500",
        textClass: "text-amber-600",
        bgClass: "bg-amber-50",
        label: "High"
      },
      normal: {
        iconClass: "text-teal-600",
        textClass: "text-teal-700",
        bgClass: "bg-teal-50",
        label: "Normal"
      },
      low: {
        iconClass: "text-slate-500",
        textClass: "text-slate-600",
        bgClass: "bg-slate-50",
        label: "Low"
      }
    };

    return configs[priority?.toLowerCase()] || null;
  };

  // Get announcement status
  const getStatus = () => {
    if (!data.startDate || !data.startTime || !data.endDate || !data.endTime) {
      return {
        status: "Draft",
        iconClass: "text-slate-500",
        textClass: "text-slate-500",
        bgClass: "bg-slate-50"
      };
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
        return {
          status: "Upcoming",
          iconClass: "text-amber-500",
          textClass: "text-amber-600",
          bgClass: "bg-amber-50"
        };
      } else if (now >= startDateTime && now <= endDateTime) {
        return {
          status: "On Going",
          iconClass: "text-emerald-500",
          textClass: "text-emerald-600",
          bgClass: "bg-emerald-50"
        };
      } else {
        return {
          status: "Expired",
          iconClass: "text-red-500",
          textClass: "text-red-600",
          bgClass: "bg-red-50"
        };
      }
    } catch (error) {
      console.warn("Error calculating status in preview:", error);
      return {
        status: "Draft",
        iconClass: "text-slate-500",
        textClass: "text-slate-500",
        bgClass: "bg-slate-50"
      };
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

  // Handle title expansion
  const handleTitleHover = () => {
    if (data.title && data.title.length > 25) {
      setExpandedTitle(true);
    }
  };

  const handleTitleLeave = () => {
    setExpandedTitle(false);
  };

  // Handle title click for mobile/touch devices
  const handleTitleClick = () => {
    if (data.title && data.title.length > 25) {
      setExpandedTitle(!expandedTitle);
    }
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
      <div className="border-[1px] border-primary rounded-lg overflow-hidden bg-white shadow-sm w-full">
        {/* Header with Author Info and Status */}
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-2">
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
                  className={`w-4 h-4 ${priorityConfig.iconClass}`}
                  fill="currentColor"
                />
              )}
              <IoIosNotificationsOutline
                className={`w-4 h-4 ${statusConfig.iconClass}`}
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

          {/* Date Info */}
          <div className={`mt-2 ${isInModal ? "text-xs" : "text-[10px]"} flex flex-wrap items-center gap-2 md:gap-3`}>
            <span className="text-primary font-bold whitespace-nowrap">
              Start: {formatDateTime(data.startDate, data.startTime) || ""}
            </span>
            <span className="text-[#FF8682] font-bold whitespace-nowrap">
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
                    className={`bg-[#F5F5F5] text-[#090909] ${isInModal ? "text-xs" : "text-[10px]"} px-2 py-1 rounded font-bold`}
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
          {/* Title */}
          <div
            className="mb-3 cursor-pointer"
            onMouseEnter={handleTitleHover}
            onMouseLeave={handleTitleLeave}
            onClick={handleTitleClick}
          >
            <h4
              className={`${isInModal ? "text-lg" : "text-sm"} font-bold text-gray-900 leading-relaxed break-words transition-all duration-200 ${expandedTitle ? "line-clamp-none" : "line-clamp-2"}`}
            >
              {data.title || "Title goes here."}
            </h4>
          </div>

          {/* Description */}
          {data.description && (
            <div className="mb-4">
              <p className={`text-gray-500 ${isInModal ? "text-sm" : "text-xs"} leading-relaxed whitespace-pre-wrap break-words font-bold`}>
                {data.description}
              </p>
            </div>
          )}

          {/* Attachments */}
          <div className="mb-4 px-2">
            {data.attachments && data.attachments.length > 0 ? (
              <div className="space-y-3">
                {/* Main/First Image/PDF - Display prominently */}
                <div
                  className={`relative bg-gray-100 overflow-hidden transition-all duration-200 w-full ${isInModal ? "h-[365px]" : "h-[243px]"} rounded-[8px] flex items-center justify-center ${isInModal
                      ? "cursor-pointer hover:opacity-95 shadow-md"
                      : "border-2 border-gray-200"
                    }`}
                  onClick={() => {
                    if (!isInModal) return;
                    const attachment = data.attachments[0];
                    const fileName = attachment.file_name || attachment.name;
                    const fileType = attachment.file_type || attachment.type;
                    // Ensure we pass the correct attachment structure with file_url and file_name
                    const attachmentData = {
                      ...attachment,
                      file_url: attachment.file_url || attachment.url || attachment.preview,
                      file_name: fileName
                    };
                    if (isDoc(fileName, fileType) || isPDF(fileName, fileType)) {
                      onDocumentClick?.(attachmentData, data);
                    } else if (onImageClick) {
                      onImageClick(attachmentData, data);
                    }
                  }}
                >
                  {isPDF(data.attachments[0].file_name || data.attachments[0].name, data.attachments[0].file_type || data.attachments[0].type) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4">
                      <VscFilePdf className={`${isInModal ? "w-32 h-32" : "w-20 h-20"} text-red-600 mb-3`} />
                      <div className="text-center w-full px-2">
                        <div className={`${isInModal ? "text-base" : "text-sm"} font-semibold text-gray-900 mb-1`}>
                          PDF Document
                        </div>
                        <div className={`${isInModal ? "text-sm" : "text-xs"} text-gray-500 truncate w-full`}>
                          {data.attachments[0].name || data.attachments[0].file_name || 'PDF File'}
                        </div>
                      </div>
                    </div>
                  ) : isDoc(
                    data.attachments[0].file_name || data.attachments[0].name,
                    data.attachments[0].file_type || data.attachments[0].type
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
                    <div className={`w-full h-full flex items-center justify-center ${isInModal ? "p-2" : ""}`}>
                      <img
                        src={
                          data.attachments[0].preview ||
                          data.attachments[0].url ||
                          data.attachments[0].file_url ||
                          data.attachments[0].base64
                        }
                        alt={data.attachments[0].name}
                        className={`${isInModal ? "max-w-full max-h-full w-auto h-auto" : "w-full h-full"} object-contain ${isInModal ? "rounded-sm" : ""
                          }`}
                        style={isInModal ? { 
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto'
                        } : {}}
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
                          const fileName = file.file_name || file.name;
                          const fileType = file.file_type || file.type;
                          // Ensure we pass the correct attachment structure with file_url and file_name
                          const attachmentData = {
                            ...file,
                            file_url: file.file_url || file.url || file.preview,
                            file_name: fileName
                          };
                          if (isDoc(fileName, fileType) || isPDF(fileName, fileType)) {
                            onDocumentClick?.(attachmentData, data);
                          } else if (onImageClick) {
                            onImageClick(attachmentData, data);
                          }
                        }}
                      >
                        {isPDF(file.file_name || file.name, file.file_type || file.type) ? (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <VscFilePdf className="w-8 h-8 text-red-600" />
                          </div>
                        ) : isDoc(file.file_name || file.name, file.file_type || file.type) ? (
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

export default AnnouncementPreview;
