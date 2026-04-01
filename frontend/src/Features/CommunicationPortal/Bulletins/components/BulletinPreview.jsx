import React, { useState, useMemo } from "react";
import { Flag, Image as ImageIcon } from "lucide-react";
import { VscFilePdf } from "react-icons/vsc";
import { FaFileWord } from "react-icons/fa";
import { HiUserCircle } from "react-icons/hi";
import { FaUserGroup } from "react-icons/fa6";
import { IoIosNotificationsOutline } from "react-icons/io";
import { useUserCount } from "../../Announcements/hooks/useUserCount";

/**
 * BulletinPreview Component
 * Real-time preview of the bulletin as it will appear when posted
 */
const BulletinPreview = ({
  data,
  currentUser,
  isInModal = false,
  onImageClick,
  onDocumentClick,
  handleImageClick, // Keep for backward compatibility if used elsewhere, but typically we use onImageClick/onDocumentClick from modal
  handleDocumentClick, // Keep for backward compatibility
  isDocument: isDocumentProp // Optional prop, will use internal function if not provided
}) => {
  const [expandedTitle, setExpandedTitle] = useState(false);

  // Internal isDocument function if not provided as prop
  const isDocument = isDocumentProp || ((fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["pdf", "doc", "docx"].includes(extension);
  });

  // Memoize the target units to prevent unnecessary recalculations
  // Handle both selectedUnits (from create/edit form) and target_units_data (from history/existing bulletins)
  const targetUnits = useMemo(() => {
    // If selectedUnits is provided (from form), use it directly as it's already an array of IDs
    if (data.selectedUnits && Array.isArray(data.selectedUnits)) {
      return data.selectedUnits;
    }
    // Otherwise, extract IDs from target_units_data
    return data.target_units_data?.map((unit) => unit.id) || [];
  }, [data.selectedUnits, data.target_units_data]);

  const { userCount, loading: loadingUserCount } = useUserCount(targetUnits);

  // Get display name based on post as selection
  const getDisplayName = () => {
    if (data.postAs === "Group" && data.selectedGroupName) {
      return data.selectedGroupName;
    } else if (data.postAs === "Member" && data.selectedMemberName) {
      return data.selectedMemberName;
    }
    return data.authorName || currentUser?.full_name || "Unknown User";
  };

  // Get author avatar based on post as selection
  const getAuthorAvatar = () => {
    if (data.postAs === "Creator" || data.postAs === "creator") {
      return <HiUserCircle className="w-8 h-8" color="gray" />;
    } else if (data.postAs === "Group" || data.postAs === "group") {
      return <FaUserGroup className="w-8 h-8" color="gray" />;
    } else if (data.postAs === "Member" || data.postAs === "member") {
      return <HiUserCircle className="w-8 h-8" color="gray" />;
    }
    return <HiUserCircle className="w-8 h-8" color="gray" />;
  };

  // Format labels for display
  const formatLabels = (labelString) => {
    if (!labelString) return [];
    return labelString
      .split(",")
      .map((label) => label.trim())
      .filter((label) => label.length > 0);
  };

  // Get formatted labels
  const labels = formatLabels(data.label);

  // Get date and time for bulletin creation (use provided date or current date)
  const getDateTime = () => {
    // Use provided creation date if available, otherwise use current date
    const dateToUse = data.createdAt ? new Date(data.createdAt) : new Date();
    const day = String(dateToUse.getDate()).padStart(2, '0');
    const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
    const year = dateToUse.getFullYear();

    let hours = dateToUse.getHours();
    const minutes = String(dateToUse.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    return `${day}-${month}-${year} at ${hours}:${minutes}${ampm}`;
  };

  // Handle attachment click
  // Handle attachment click
  const handleAttachmentClick = (attachment) => {
    // 1. If in modal, prioritized prop handlers
    if (isInModal) {
      if (isDocument(attachment.file_name || attachment.name)) {
        if (onDocumentClick) onDocumentClick(attachment);
      } else {
        if (onImageClick) onImageClick(attachment, data);
      }
      return;
    }

    // 2. Existing logic (mostly for list view or other contexts)
    // If handlers are provided (from history modal or props), use them
    if (handleImageClick && handleDocumentClick && isDocument) {
      if (isDocument(attachment.file_name || attachment.name)) {
        handleDocumentClick(attachment);
      } else {
        // Create a mock bulletin object for the image handler
        const mockBulletin = { attachments: data.attachments || [] };
        handleImageClick(attachment, mockBulletin);
      }
    } else {
      // Fallback to console logging if no handlers provided
      if (attachment.type?.startsWith("image/")) {
        console.log("Image clicked:", attachment);
      } else {
        console.log("Document clicked:", attachment);
      }
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
    return (
      fileName?.toLowerCase().endsWith(".doc") ||
      fileName?.toLowerCase().endsWith(".docx")
    );
  };

  // Render attachment icon based on type
  const renderAttachmentIcon = (attachment) => {
    if (attachment.type?.startsWith("image/")) {
      return <ImageIcon className="w-4 h-4 text-blue-600" />;
    } else if (attachment.type === "application/pdf") {
      return <VscFilePdf className="w-4 h-4 text-red-600" />;
    } else if (
      attachment.type?.includes("word") ||
      attachment.type?.includes("document")
    ) {
      return <FaFileWord className="w-4 h-4 text-blue-600" />;
    }
    return <ImageIcon className="w-4 h-4 text-gray-600" />;
  };

  // Early return if no data
  if (!data) {
    return (
      <div className="text-center py-8">
        <IoIosNotificationsOutline className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Start filling out the form to see a preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Bulletin Card Preview */}
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
                  {getDisplayName()}
                </h3>
                <div className={`${isInModal ? "text-sm" : "text-xs"} text-primary mt-1`}>
                  {getDateTime()}
                </div>
              </div>
            </div>

            {/* Right side - User count with notification icon */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <IoIosNotificationsOutline className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">
                  {loadingUserCount ? "..." : userCount}
                </span>
              </div>
            </div>
          </div>

          {/* Label Info */}
          {labels.length > 0 && (
            <div className={`mt-1 ${isInModal ? "text-sm" : "text-xs"}`}>
              <div className="flex flex-wrap gap-1">
                {labels.map((label, index) => (
                  <span
                    key={index}
                    className={`bg-[#F5F5F5] text-[#090909] ${isInModal ? "text-xs" : "text-[10px]"} px-2 py-1 rounded font-bold`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title */}
          <div className="mb-3">
            <h2
              className={`${isInModal ? "text-lg" : "text-sm"} font-bold text-gray-900 leading-relaxed break-words ${expandedTitle ? "" : "line-clamp-2"
                }`}
            >
              {data.title || "Bulletin title will appear here..."}
            </h2>
            {data.title && data.title.length > 100 && (
              <button
                onClick={() => setExpandedTitle(!expandedTitle)}
                className="text-primary text-sm mt-1 hover:underline"
              >
                {expandedTitle ? "Show less" : "Show more"}
              </button>
            )}
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
                  className={`relative bg-gray-100 overflow-hidden transition-all duration-200 w-full ${isInModal ? "max-w-full h-[365px]" : "max-w-[316px] h-[243px]"} rounded-[8px] cursor-pointer hover:opacity-90 ${isInModal
                      ? "shadow-md"
                      : "border-2 border-gray-200"
                    }`}
                  onClick={() => handleAttachmentClick(data.attachments[0])}
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
                        className={`relative bg-gray-100 overflow-hidden transition-all duration-200 w-full h-[65px] rounded-[8px] cursor-pointer hover:opacity-90 ${isInModal
                            ? "shadow-sm"
                            : "border border-gray-200"
                          }`}
                        onClick={() => handleAttachmentClick(file)}
                      >
                        {isPDF(file.name, file.type) ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <VscFilePdf className="w-6 h-6 text-red-600 font-bold" />
                          </div>
                        ) : isDoc(file.name, file.type) ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <FaFileWord className="w-6 h-6 text-blue-500" />
                          </div>
                        ) : file.preview || file.url || file.base64 ? (
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

export default React.memo(BulletinPreview);
