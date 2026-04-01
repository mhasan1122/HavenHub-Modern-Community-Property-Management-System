import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import useBulletins from "../../../../hooks/useBulletins";
import BulletinPreview from "./BulletinPreview";
import useCurrentUser from "../hooks/useCurrentUser";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ImageSlider from "../../../../Components/Modal/ImageSlider";
import DocumentViewer from "../../../../Components/FileViewer/DocumentViewer";

// Helper function to determine file type from filename
const getFileTypeFromName = (filename) => {
  if (!filename) return "application/octet-stream";

  const extension = filename.toLowerCase().split(".").pop();
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  const documentExtensions = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };

  if (imageExtensions.includes(extension)) {
    return `image/${extension === "jpg" ? "jpeg" : extension}`;
  }

  return documentExtensions[extension] || "application/octet-stream";
};

/**
 * BulletinHistoryModal Component
 * Enhanced history modal with comment section and Approve/Reject buttons
 * Matches the design shown in the provided images
 */
const BulletinHistoryModal = React.memo(({ bulletin, onClose, onRefresh, canApproveReject = false }) => {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [commentError, setCommentError] = useState(""); // Error for comment validation

  // States for confirmation and success messages
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
  const [showApproveConfirmation, setShowApproveConfirmation] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // States for attachment handling
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);

  const {
    approveBulletinPost,
    rejectBulletinPost,
    addCommentToBulletinPost,
    loadBulletins
  } = useBulletins();

  const { currentUser } = useCurrentUser();

  // Validate comment word count
  const validateComment = (commentText) => {
    if (!commentText.trim()) return "";

    const words = commentText.trim().split(/\s+/);
    if (words.length > 50) {
      return "Comment must be 50 words or less";
    }
    return "";
  };

  // Handle comment input change with validation
  const handleCommentChange = (e) => {
    const value = e.target.value;
    setComment(value);

    // Clear error when user starts typing
    if (commentError) {
      setCommentError("");
    }

    // Validate on change
    const error = validateComment(value);
    if (error) {
      setCommentError(error);
    }
  };

  // Handle send comment (just add comment without approve/reject)
  const handleSendComment = async () => {
    if (!comment.trim()) return;

    // Validate comment before sending
    const validationError = validateComment(comment);
    if (validationError) {
      setCommentError(validationError);
      return;
    }

    setIsSubmitting(true);
    const commentText = comment.trim(); // Store comment text before clearing

    try {
      // Clear the comment and error immediately for better UX
      setComment("");
      setCommentError("");

      // Make API call to save comment to backend
      await addCommentToBulletinPost(bulletin.id, commentText);

      // Refresh bulletin data to get updated history
      if (onRefresh) {
        await onRefresh(bulletin.id);
      }

      console.log("Comment saved successfully:", commentText);
    } catch (error) {
      console.error("Error sending comment:", error);

      // Restore the comment text on error so user doesn't lose it
      setComment(commentText);

      // Handle specific validation errors from backend
      if (error.response?.data?.error) {
        setCommentError(error.response.data.error);
      } else {
        alert("Failed to send comment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe close handler to prevent shaking
  const handleSafeClose = () => {
    if (isSubmitting) {
      return; // Don't close while submitting
    }
    onClose();
  };

  // Handle approve action - show confirmation first
  const handleApprove = () => {
    // Prevent multiple clicks
    if (isSubmitting) return;

    // Show confirmation dialog
    setShowApproveConfirmation(true);
  };

  // Confirm approve action
  const confirmApprove = async () => {
    // Close confirmation modal immediately
    setShowApproveConfirmation(false);

    setIsSubmitting(true);
    setActionType("approve");

    try {
      // Perform the API call
      await approveBulletinPost(bulletin.id, comment.trim() || "");

      // Dispatch custom event to refresh notifications (bulletin is now posted to all users)
      window.dispatchEvent(new Event('bulletinCreated'));

      // Show success message
      setSuccessMessage("Bulletin approved successfully");
      setShowSuccessMessage(true);

      // Redux state is already updated by the action, no need to reload all bulletins
    } catch (error) {
      console.error("Error approving bulletin:", error);
      const errorMessage =
        error.response?.data?.error ||
        "Failed to approve bulletin. Please try again.";
      setSuccessMessage(errorMessage);
      setShowSuccessMessage(true);
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  // Cancel approve action
  const cancelApprove = () => {
    setShowApproveConfirmation(false);
  };

  // Handle reject action - show confirmation first
  const handleReject = () => {
    // Prevent multiple clicks
    if (isSubmitting) return;

    // Show confirmation dialog
    setShowRejectConfirmation(true);
  };

  // Confirm reject action
  const confirmReject = async () => {
    // Close confirmation modal immediately
    setShowRejectConfirmation(false);

    setIsSubmitting(true);
    setActionType("reject");

    try {
      // Perform the API call
      await rejectBulletinPost(bulletin.id, comment.trim() || "");

      // Show success message
      setSuccessMessage("Bulletin rejected successfully");
      setShowSuccessMessage(true);

      // Redux state is already updated by the action, no need to reload all bulletins
    } catch (error) {
      console.error("Error rejecting bulletin:", error);
      const errorMessage =
        error.response?.data?.error ||
        "Failed to reject bulletin. Please try again.";
      setSuccessMessage(errorMessage);
      setShowSuccessMessage(true);
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  // Cancel reject action
  const cancelReject = () => {
    setShowRejectConfirmation(false);
  };

  // Handle success message OK
  const handleSuccessOk = () => {
    setShowSuccessMessage(false);
    setSuccessMessage("");

    // Close the modal normally
    onClose();
  };

  // Helper functions for attachment handling
  const isImage = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension);
  };

  const isDocument = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["pdf", "doc", "docx", "xls", "xlsx", "txt"].includes(extension);
  };

  // Handle image click - open image slider
  const handleImageClick = (attachment, bulletin) => {
    const allAttachments = bulletin.attachments || [];
    const imageAttachments = allAttachments.filter(
      (att) =>
        isImage(att.file_name || att.name) ||
        (!att.file_name && !att.name && !isDocument(att.file_name || att.name))
    );

    const clickedIndex = imageAttachments.findIndex(
      (img) =>
        (img.file_url || img.url) === (attachment.file_url || attachment.url)
    );

    const formattedImages = imageAttachments.map((img, index) => ({
      src: img.file_url || img.url || img.preview || img,
      alt: img.file_name || img.name || `Image ${index + 1}`,
      name: img.file_name || img.name || `image-${index + 1}`
    }));
    setSelectedImages(formattedImages);
    setSelectedImageIndex(clickedIndex >= 0 ? clickedIndex : 0);
    setIsImageSliderOpen(true);
  };

  const handleImageSliderClose = () => {
    setIsImageSliderOpen(false);
    setSelectedImages([]);
    setSelectedImageIndex(0);
  };

  // Handle document click - open document viewer
  const handleDocumentClick = (attachment) => {
    setSelectedDocument(attachment);
    setIsDocumentViewerOpen(true);
  };

  const handleDocumentClose = () => {
    setIsDocumentViewerOpen(false);
    setSelectedDocument(null);
  };

  // Calculate dynamic height for timeline dots based on content
  const calculateDotHeight = (entry, index, historyArray) => {
    if (index >= historyArray.length - 1) return 0; // No line for last entry

    // Base height calculation:
    // - space-y-8 = 32px between entries
    // - Entry content height varies based on content
    // - Need to account for dot positioning (top-4 = 16px from top)
    let baseHeight = 16; // Start with the space-y-8 spacing

    // Calculate content height for current entry
    let contentHeight = 88; // Base content height (header + user info + padding + dot)

    // Add extra height for comment entries - improved calculation
    if (entry.type === "Comment" && entry.comment) {
      const commentText = entry.comment.trim();
      const wordCount = commentText.split(/\s+/).length;

      // More accurate height calculation based on word count and line wrapping
      // Assume ~10-12 words per line in the comment area (more conservative), with ~20px per line
      const estimatedLines = Math.ceil(wordCount / 10);
      const commentHeight = Math.max(estimatedLines * 20, 20); // Minimum 1 line

      contentHeight += commentHeight + 12; // Add comment height + margin

      // Add extra padding for longer comments
      if (wordCount > 30) {
        contentHeight += 36; // Extra spacing for very long comments
      }
    }

    // Add extra height for entries with long user names
    if (entry.user && entry.user.length > 20) {
      contentHeight += 16;
    }

    // Add extra height for entries with action text and comments for non-comment entries
    if (entry.action && entry.action.length > 10) {
      contentHeight += 16;
    }

    // Add comment height for non-comment entries that have comments
    if (entry.type !== "Comment" && entry.comment) {
      const commentText = entry.comment.trim();
      const wordCount = commentText.split(/\s+/).length;
      const estimatedLines = Math.ceil(wordCount / 10);
      const commentHeight = Math.max(estimatedLines * 20, 20);
      contentHeight += commentHeight + 12; // Add comment height + margin
    }

    // Total height is the content height plus the base spacing
    return contentHeight + baseHeight;
  };

  // Get bulletin history with filtering for specific actions only
  const getBulletinHistory = (bulletin) => {
    const history = [];

    console.log("DEBUG: Getting bulletin history for bulletin:", bulletin.id);

    // Also check for backend history format (fallback)
    if (bulletin.history && Array.isArray(bulletin.history)) {
      console.log("DEBUG: Backend history entries:", bulletin.history.length);
      bulletin.history.forEach((entry, index) => {
        console.log(`DEBUG: Processing history entry ${index}:`, entry);
        const entryDate = new Date(entry.edited_at);

        // Filter to show only specific actions: rejected, updated (edit), approved, created
        const allowedActions = ["rejected", "updated", "approved", "created"];

        if (allowedActions.includes(entry.action)) {
          // Check if this is a comment-only action (has comment but no actual changes)
          // Also filter out system-generated messages like "Bulletin updated by [username]"
          const isSystemMessage =
            entry.comment &&
            entry.comment.trim().startsWith("Bulletin updated by");
          const isCommentOnly =
            entry.comment &&
            entry.comment.trim() &&
            !isSystemMessage &&
            (!entry.changes ||
              entry.changes === null ||
              entry.changes === "" ||
              (typeof entry.changes === "object" &&
                Object.keys(entry.changes).length === 0));

          // If it's comment-only, just add the comment entry, not the action entry
          // But filter out system-generated pin/unpin comments
          if (
            isCommentOnly &&
            entry.comment &&
            entry.comment.trim() &&
            !entry.comment.trim().startsWith("Bulletin pinned by") &&
            !entry.comment.trim().startsWith("Bulletin unpinned by")
          ) {
            history.push({
              id: `comment-${entry.id || index}`,
              type: "Comment",
              action: "", // Empty action for comments
              user: entry.edited_by_name || "Unknown User",
              timestamp: entry.edited_at,
              date: (() => {
                const day = entryDate.getDate().toString().padStart(2, "0");
                const month = (entryDate.getMonth() + 1)
                  .toString()
                  .padStart(2, "0");
                const year = entryDate.getFullYear();
                const hours = entryDate.getHours();
                const minutes = entryDate
                  .getMinutes()
                  .toString()
                  .padStart(2, "0");
                const hour12 =
                  hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                const period = hours >= 12 ? "pm" : "am";
                return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
              })(),
              comment: entry.comment,
              changes: null,
              isRejected: false
            });
          } else {
            // This is an actual action (edit, approve, reject, etc.)
            // Map action types to display format
            let actionType, actionLabel;

            switch (entry.action) {
              case "rejected":
                actionType = "Rejected";
                actionLabel = "Rejected by";
                break;
              case "updated":
                // Check source tab to determine if this was a repost or edit
                const sourceTab = entry.changes?.source_tab;
                console.log(`[BulletinHistoryModal] Processing updated action - sourceTab: ${sourceTab}, type: ${typeof sourceTab}`);
                if (sourceTab === '2' || sourceTab === 2) {
                  // Edit came from pending bulletin (tab 2) - show as Repost
                  actionType = "Repost";
                  actionLabel = "Repost by";
                  console.log(`[BulletinHistoryModal] Using Repost terminology for pending bulletin edit`);
                } else {
                  // Edit came from current bulletin (tab 1) or unknown - show as Edit
                  actionType = "Edit";
                  actionLabel = "Edit by";
                  console.log(`[BulletinHistoryModal] Using Edit terminology for current bulletin edit`);
                }
                break;
              case "approved":
                actionType = "Approved";
                actionLabel = "Approved by";
                break;
              case "created":
                actionType = "Creation";
                actionLabel = "Created by";
                break;
              default:
                return; // Skip if not in allowed actions
            }

            console.log(
              `DEBUG: Adding ${actionType} entry to history with ID: history-${
                entry.id || index
              }`
            );
            history.push({
              id: `history-${entry.id || index}`,
              type: actionType,
              action: actionLabel,
              user: entry.edited_by_name || "Unknown User",
              timestamp: entry.edited_at,
              date: (() => {
                const day = entryDate.getDate().toString().padStart(2, "0");
                const month = (entryDate.getMonth() + 1)
                  .toString()
                  .padStart(2, "0");
                const year = entryDate.getFullYear();
                const hours = entryDate.getHours();
                const minutes = entryDate
                  .getMinutes()
                  .toString()
                  .padStart(2, "0");
                const hour12 =
                  hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                const period = hours >= 12 ? "pm" : "am";
                return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
              })(),
              comment: null,
              changes: entry.changes,
              isRejected: entry.action === "rejected"
            });

            // Add separate comment entry if comment exists for actual actions
            // But filter out system-generated messages like "Bulletin updated by [username]", "Bulletin pinned by", and "Bulletin unpinned by"
            if (
              entry.comment &&
              entry.comment.trim() &&
              !entry.comment.trim().startsWith("Bulletin updated by") &&
              !entry.comment.trim().startsWith("Bulletin pinned by") &&
              !entry.comment.trim().startsWith("Bulletin unpinned by")
            ) {
              history.push({
                id: `comment-${entry.id || index}`,
                type: "Comment",
                action: "", // Empty action for comments
                user: entry.edited_by_name || "Unknown User",
                timestamp: entry.edited_at,
                date: (() => {
                  const day = entryDate.getDate().toString().padStart(2, "0");
                  const month = (entryDate.getMonth() + 1)
                    .toString()
                    .padStart(2, "0");
                  const year = entryDate.getFullYear();
                  const hours = entryDate.getHours();
                  const minutes = entryDate
                    .getMinutes()
                    .toString()
                    .padStart(2, "0");
                  const hour12 =
                    hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                  const period = hours >= 12 ? "pm" : "am";
                  return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
                })(),
                comment: entry.comment,
                changes: null,
                isRejected: false
              });
            }
          }
        }
      });
    }

    // Creation entry - add at the end (bottom of timeline) - always show creation
    if (bulletin.createdAt || bulletin.created_at) {
      const createdDate = new Date(bulletin.createdAt || bulletin.created_at);

      // Get the correct author name based on post_as field
      const getCreationAuthorName = () => {
        const postAsValue = bulletin.post_as || bulletin.postAs;

        switch (postAsValue) {
          case "group":
            return bulletin.group_name || bulletin.author || "Unknown Group";
          case "member":
            return bulletin.member_name || bulletin.author || "Unknown Member";
          default: // 'creator' or any other value
            return (
              bulletin.creator_name ||
              bulletin.creatorName ||
              bulletin.author ||
              "Unknown User"
            );
        }
      };

      history.push({
        id: `creation-${bulletin.id}`,
        type: "Creation",
        action: "Created by",
        user: getCreationAuthorName(),
        timestamp: bulletin.createdAt || bulletin.created_at,
        date: (() => {
          const day = createdDate.getDate().toString().padStart(2, "0");
          const month = (createdDate.getMonth() + 1)
            .toString()
            .padStart(2, "0");
          const year = createdDate.getFullYear();
          const hours = createdDate.getHours();
          const minutes = createdDate.getMinutes().toString().padStart(2, "0");
          const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
          const period = hours >= 12 ? "pm" : "am";
          return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
        })(),
        color: "#3D9D9B",
        isRejected: false
      });
    }

    const sortedHistory = history.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    ); // Show latest first (descending)

    console.log("DEBUG: Final history entries:", sortedHistory.length);
    console.log(
      "DEBUG: History entries:",
      sortedHistory.map((h) => ({ id: h.id, type: h.type, action: h.action }))
    );

    return sortedHistory;
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleSafeClose();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        handleSafeClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  // Use useMemo to recalculate history only when bulletin changes
  const history = React.useMemo(() => {
    return getBulletinHistory(bulletin);
  }, [bulletin]);

  // Memoize the target units to prevent unnecessary recalculations
  // Use JSON.stringify for deep comparison to avoid recalculation when units haven't changed
  const memoizedTargetUnits = React.useMemo(() => {
    return bulletin.target_units_data?.map((unit) => unit.id) || [];
  }, [
    JSON.stringify(bulletin.target_units_data?.map((unit) => unit.id) || [])
  ]);



  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white relative flex flex-col lg:flex-row overflow-hidden w-full lg:w-[796px] h-full lg:h-[660px] max-w-full lg:max-w-[90vw] max-h-full lg:max-h-[90vh] rounded-lg lg:rounded-[27px] opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleSafeClose}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 bg-primary hover:bg-[#2A7A78] rounded-full flex items-center justify-center text-white z-10 transition-colors"
        >
          <FaTimes className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>

        {/* Left Side - Preview */}
        <div className="w-full lg:w-1/2 p-4 sm:p-6 border-b-2 lg:border-b-0 lg:border-r-[3px] border-[#F9F9FB] overflow-y-auto max-h-[40vh] lg:max-h-none">
          <div className="h-full">
            <BulletinPreview
              data={{
                title: bulletin.title,
                description: bulletin.description,
                authorName: bulletin.author,
                postAs: bulletin.post_as || bulletin.postAs || "Creator",
                label: bulletin.label,
                // Pass the creation date for proper display
                createdAt: bulletin.created_at || bulletin.createdAt,
                // Pass the correct field names for group and member display
                selectedGroupName: bulletin.group_name,
                selectedMemberName: bulletin.member_name,
                attachments: bulletin.attachments
                  ? bulletin.attachments.map((att) => ({
                      preview: att.file_url || att.url || att.preview || att,
                      name: att.file_name || att.name || "Attachment",
                      url: att.file_url || att.url || att.preview || att,
                      file_url: att.file_url || att.url || att.preview || att,
                      file_name: att.file_name || att.name || "Attachment",
                      type:
                        att.file_type ||
                        att.type ||
                        (att.file_name
                          ? getFileTypeFromName(att.file_name)
                          : "application/octet-stream")
                    }))
                  : [],
                // Use memoized target units for stable user count calculation
                selectedUnits: memoizedTargetUnits,
                // Also pass the full bulletin object for compatibility
                target_units_data: bulletin.target_units_data || []
              }}
              isInModal={true}
              onImageClick={handleImageClick}
              onDocumentClick={handleDocumentClick}
              handleImageClick={handleImageClick}
              handleDocumentClick={handleDocumentClick}
              isDocument={isDocument}
            />
          </div>
        </div>

        {/* Right Side - History */}
        <div className="w-full lg:w-1/2 p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">
              History
            </h2>
          </div>

          {/* History Timeline */}
          <div className="relative">
            {/* Main timeline line is removed as we're using individual line segments for each entry */}

            <div className="space-y-4 sm:space-y-8">
              {history.length > 0 ? (
                history.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-start space-x-3 sm:space-x-5 relative"
                  >
                    {/* Timeline Dot with conditional styling for rejected entries */}
                    <div className="relative z-10">
                      <div
                        className={`w-3 h-3 rounded-full mt-1 ${
                          entry.isRejected ? "bg-secondary" : "bg-primary"
                        }`}
                      ></div>
                      {/* Dot line with conditional styling for rejected entries */}
                      {index < history.length - 1 && (
                        <div
                          className={`absolute left-[5px] top-4 w-0.5 ${
                            entry.isRejected ? "bg-secondary" : "bg-primary"
                          }`}
                          style={{
                            height: `${calculateDotHeight(
                              entry,
                              index,
                              history
                            )}px` // Dynamic height based on content
                          }}
                        ></div>
                      )}
                    </div>

                    {/* History Entry */}
                    <div className="flex-1 pb-2 min-w-0">
                      {/* Header with Type and Date */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3 gap-1 sm:gap-0">
                        <div
                          className={`text-sm sm:text-base font-medium ${
                            entry.isRejected ? "text-secondary" : "text-primary"
                          }`}
                        >
                          {entry.type}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {entry.date}
                        </div>
                      </div>

                      {/* Content based on entry type */}
                      {entry.type === "Comment" ? (
                        <>
                          {/* Comment text first */}
                          {entry.comment && (
                            <div className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3 break-words">
                              {entry.comment}
                            </div>
                          )}
                          {/* User info below comment */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs sm:text-sm font-medium text-primary bg-gray-100 px-2 py-1 rounded radius-8 inline-block w-fit">
                              {entry.user}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* User info for non-comment entries */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2">
                            <span className="text-xs sm:text-sm text-gray-700">
                              {entry.action}
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-primary bg-gray-100 px-2 py-1 rounded radius-8 inline-block w-fit">
                              {entry.user}
                            </span>
                          </div>
                          {/* Comment display for non-comment entries (if any) */}
                          {entry.comment && (
                            <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-700 break-words">
                              {entry.comment}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">
                  No history available
                </div>
              )}
            </div>
          </div>

          {/* Comment Section for Pending Bulletins */}
          {bulletin.status === "pending" && canApproveReject && (
            <div className="border-t border-gray-200 pt-4 sm:pt-6 mt-4 sm:mt-6">
              <div className="space-y-3 sm:space-y-4">
                {/* Comment Input with User Avatar */}
                <div className="flex items-start space-x-3">
                  {/* User Avatar */}
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  {/* Comment Input */}
                  <div className="flex-1 flex items-end space-x-3">
                    <textarea
                      value={comment}
                      onChange={handleCommentChange}
                      placeholder={`Comment as ${
                        currentUser?.full_name || "User"
                      } (max 50 words)`}
                      rows={2}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm ${
                        commentError ? "border-red-500" : "border-gray-300"
                      }`}
                      disabled={isSubmitting}
                      maxLength={500}
                    />
                    {/* Send Button - Positioned outside textarea */}
                    <button
                      onClick={handleSendComment}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors flex-shrink-0 ${
                        comment.trim() && !isSubmitting && !commentError
                          ? "bg-primary hover:bg-primary/90"
                          : "bg-gray-300 cursor-not-allowed"
                      }`}
                      disabled={
                        !comment.trim() || isSubmitting || !!commentError
                      }
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Word Counter */}
                {comment.trim() && (
                  <div className="mt-2 text-right">
                    <span
                      className={`text-xs ${
                        comment.trim().split(/\s+/).length > 50
                          ? "text-red-500"
                          : "text-gray-500"
                      }`}
                    >
                      {comment.trim().split(/\s+/).length}/50 words
                    </span>
                  </div>
                )}

                {/* Error Message */}
                {commentError && (
                  <div className="mt-2">
                    <ErrorMessage message={commentError} />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
                  <button
                    onClick={handleReject}
                    disabled={isSubmitting}
                    className={`flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                      isSubmitting
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-secondary text-white hover:bg-secondary/90"
                    }`}
                  >
                    {isSubmitting && actionType === "reject" ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Rejecting...
                      </div>
                    ) : (
                      "Reject"
                    )}
                  </button>

                  <button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className={`flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                      isSubmitting
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    {isSubmitting && actionType === "approve" ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Approving...
                      </div>
                    ) : (
                      "Approve"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulletin.status !== "pending" && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                {bulletin.status === "current"
                  ? "This bulletin is already approved and active"
                  : "This bulletin is archived"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Message for Reject */}
      {showRejectConfirmation && (
        <ConfirmationMessageBox
          message="Are you sure you want to reject this bulletin? This action will move it to archive."
          onConfirm={confirmReject}
          onCancel={cancelReject}
        />
      )}

      {/* Confirmation Message for Approve */}
      {showApproveConfirmation && (
        <ConfirmationMessageBox
          message="Are you sure you want to approve this bulletin? This action will make it active."
          onConfirm={confirmApprove}
          onCancel={cancelApprove}
        />
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <MessageBox
          message={successMessage}
          clearMessage={() => setShowSuccessMessage(false)}
          onOk={handleSuccessOk}
        />
      )}

      {/* Image Slider */}
      <ImageSlider
        isOpen={isImageSliderOpen}
        onClose={handleImageSliderClose}
        images={selectedImages}
        initialIndex={selectedImageIndex}
      />

      {/* Document Viewer */}
      {isDocumentViewerOpen && selectedDocument && (
        <DocumentViewer
          fileUrl={
            selectedDocument.file_url ||
            selectedDocument.url ||
            selectedDocument.base64
          }
          fileName={selectedDocument.file_name || selectedDocument.name}
          onClose={handleDocumentClose}
        />
      )}
    </div>
  );
});

BulletinHistoryModal.displayName = "BulletinHistoryModal";

export default BulletinHistoryModal;
