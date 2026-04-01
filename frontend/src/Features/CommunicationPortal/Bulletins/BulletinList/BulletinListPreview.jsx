import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaUserGroup } from "react-icons/fa6";
import { HiDotsHorizontal } from "react-icons/hi";
import { HiUserCircle } from "react-icons/hi";
import { FaFilePdf, FaFileWord, FaImage } from "react-icons/fa";
import BulletinActionMenu from "../components/BulletinActionMenu";
import { PinIcon } from "../components/PinPost";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import UserCountDisplay from "../../Announcements/components/UserCountDisplay";
import useCurrentUser from "../hooks/useCurrentUser";

/**
 * BulletinListPreview Component
 * Renders the list of bulletins with their preview cards in a row-wise masonry layout
 */
const BulletinListPreview = ({
  // Data props
  bulletins,
  loading,

  // UI state props
  openDropdownId,
  dropdownRef,
  currentTab,
  highlightedBulletinId,

  // Handlers
  handleDropdownToggle,
  handleEditBulletin,
  handleBulletinHistory,
  handleMoveToArchive,
  handleReminder,
  handlePinPost,
  handleDirectCommunication,
  handleDeleteBulletin,
  handleRestoreBulletin,
  handleImageClick,
  handleDocumentClick,

  // Helper functions
  isDocument,
  getFileIcon,
  canArchive = false,
  onBulletinCardClick
}) => {
  // Get current user
  const { currentUser } = useCurrentUser();
  
  // Fallback getFileIcon if not provided
  const getFileIconSafe = getFileIcon || ((fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
        return <FaFilePdf className="w-6 h-6 text-black font-bold" />;
      case "doc":
      case "docx":
        return <FaFileWord className="w-6 h-6 text-blue-500" />;
      default:
        return <FaImage className="w-6 h-6 text-gray-400" />;
    }
  });
  const containerRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const layoutTimeoutRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const period = hours >= 12 ? "pm" : "am";
    return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
  };

  // Debounced layout calculation to prevent excessive recalculations
  const calculateLayout = useCallback(() => {
    if (!containerRef.current || bulletins.length === 0 || isCalculating) {
      return;
    }

    setIsCalculating(true);

    const containerWidth = containerRef.current.offsetWidth;
    const isMobile = containerWidth < 768;
    const cardWidth = isMobile ? containerWidth : 350; // Full width on mobile, fixed on desktop
    const gap = 8; // 8px gap between cards

    // Calculate number of columns that fit
    const columns = isMobile ? 1 : Math.max(
      1,
      Math.floor((containerWidth + gap) / (cardWidth + gap))
    );
    const columnHeights = new Array(columns).fill(0);
    const newPositions = [];

    // Get all card elements to measure their actual heights
    const cardElements = containerRef.current.querySelectorAll("[data-card-id]");

    if (cardElements.length === bulletins.length) {
      // All cards are rendered, measure their heights
      bulletins.forEach((_, index) => {
        const cardElement = cardElements[index];
        // Use fixed height estimate to prevent reflow during image loading
        const cardHeight = cardElement ? cardElement.offsetHeight : 450; // Increased default height

        // Find the shortest column for optimal space usage
        const shortestColumn = columnHeights.indexOf(
          Math.min(...columnHeights)
        );

        // Position the card
        newPositions.push({
          left: shortestColumn * (cardWidth + gap),
          top: columnHeights[shortestColumn]
        });

        // Update column height with actual card height + gap
        columnHeights[shortestColumn] += cardHeight + gap;
      });

      setPositions(newPositions);
      setContainerHeight(Math.max(...columnHeights) - gap);
      setIsLayoutReady(true);
      setIsCalculating(false);
    } else {
      // Cards not fully rendered yet, wait for next frame
      setIsCalculating(false);
      requestAnimationFrame(() => {
        if (!isCalculating) {
          calculateLayout();
        }
      });
    }
  }, [bulletins, isCalculating]);

  // Layout effect with improved stability
  useEffect(() => {
    if (!containerRef.current || bulletins.length === 0) {
      setPositions([]);
      setContainerHeight(0);
      setIsLayoutReady(false);
      return;
    }

    // Clear any existing timeout
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }

    // Debounce layout calculation to prevent rapid recalculations
    layoutTimeoutRef.current = setTimeout(() => {
      calculateLayout();
    }, 100);

    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, [bulletins, calculateLayout]);

  // Resize observer with debouncing
  useEffect(() => {
    if (!containerRef.current) return;

    // Disconnect existing observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    let resizeTimeout;
    resizeObserverRef.current = new ResizeObserver(() => {
      // Debounce resize events to prevent excessive recalculations
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!isCalculating) {
          calculateLayout();
        }
      }, 150);
    });

    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      clearTimeout(resizeTimeout);
    };
  }, [calculateLayout, isCalculating]);

  if (loading) {
    return (
      <div className="col-span-full flex justify-center items-center py-12">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  const containerWidth = containerRef.current?.offsetWidth || 0;
  const isMobile = containerWidth < 768;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${bulletins.length > 0 ? "min-h-[300px]" : ""}`}
      style={{
        height: isLayoutReady && !isMobile ? `${containerHeight}px` : "auto",
        opacity: isLayoutReady ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      {bulletins.map((bulletin, index) => {
        const position = positions[index];
        const isHighlighted = highlightedBulletinId === bulletin.id;
        const hasPosition = isLayoutReady && position && !isMobile;
        const positionStyles = hasPosition
          ? {
              left: `${position.left}px`,
              top: `${position.top}px`
            }
          : {};

        return (
          <div
            id={`bulletin-${bulletin.id}`}
            key={bulletin.id}
            data-card-id={bulletin.id}
            className={`bg-white rounded-lg p-3 sm:p-4 transition-all duration-300 ${
              hasPosition ? "absolute" : "relative mb-3 sm:mb-2"
            } ${isLayoutReady ? "opacity-100" : "opacity-0"} cursor-pointer ${
              isHighlighted 
                ? "border-2 border-primary shadow-lg ring-4 ring-primary ring-opacity-30" 
                : "border border-primary shadow-sm hover:shadow-md"
            }`}
            onClick={(e) => {
              // Only trigger card click if clicking on the card itself, not on interactive elements
              const target = e.target;
              const isInteractiveElement = 
                target.closest('button, a, [role="button"], [data-action-menu], [data-pin-icon], [data-user-count]') ||
                target.hasAttribute('data-action-menu') ||
                target.hasAttribute('data-pin-icon') ||
                target.hasAttribute('data-user-count') ||
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.getAttribute('role') === 'button';
              
              if (onBulletinCardClick && !isInteractiveElement && target.closest(`[data-card-id="${bulletin.id}"]`)) {
                e.preventDefault();
                e.stopPropagation();
                onBulletinCardClick(bulletin.id);
              }
            }}
            style={{
              width: isMobile ? "100%" : "350px",
              minWidth: 0,
              ...positionStyles
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden">
                <div className="w-[24px] h-[24px] flex-shrink-0 rounded-full flex items-center justify-center">
                  {bulletin.postAs === "creator" ? (
                    <HiUserCircle className="w-8 h-8" color="gray" />
                  ) : bulletin.postAs === "group" ? (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  ) : bulletin.postAs === "member" ? (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  ) : (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-black text-[14px] font-bold truncate">
                    {bulletin.author}
                  </h3>
                  <p className="text-black text-[11px] font-bold truncate">
                    Creator{" "}
                    {bulletin.creatorName ||
                      bulletin.creator_name ||
                      bulletin.author}
                  </p>
                  <p className="text-primary text-[11px] font-bold truncate">
                    {formatDateTime(bulletin.created_at || bulletin.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Pin Icon */}
                <PinIcon
                  announcement={bulletin}
                  currentTab={currentTab}
                />
                {/* User Count Display - notification icon and user count */}
                <UserCountDisplay announcement={bulletin} />
                <div
                  className="relative"
                  ref={openDropdownId === bulletin.id ? dropdownRef : null}
                  data-action-menu="true"
                >
                  <HiDotsHorizontal
                    className="w-[16px] h-[16px] text-primary cursor-pointer hover:text-primaryDark"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDropdownToggle(bulletin.id);
                    }}
                    data-action-menu="true"
                  />
                  {openDropdownId === bulletin.id && (
                    <BulletinActionMenu
                      bulletin={bulletin}
                      onEdit={handleEditBulletin}
                      onHistory={handleBulletinHistory}
                      onMoveToArchive={handleMoveToArchive}
                      onReminder={handleReminder}
                      onPinPost={handlePinPost}
                      onDirectCommunication={handleDirectCommunication}
                      onDelete={handleDeleteBulletin}
                      onRestore={handleRestoreBulletin}
                      onClose={() => handleDropdownToggle(null)}
                      canArchive={canArchive}
                      currentUserId={currentUser?.id}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Label - Next line */}
            {bulletin.label && (
              <div className="text-[12px] mb-2">
                <div className="flex flex-wrap gap-1">
                  {bulletin.label.split(",").map((label, index) => (
                    <span
                      key={index}
                      className="bg-labelBg text-black text-[10px] px-2 py-1 rounded font-bold"
                    >
                      {label.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <h4 className="text-black text-[14px] font-semibold mb-2 line-clamp-2">
              {bulletin.title}
            </h4>

            {/* Description */}
            <p className="text-textMedium text-[12px] mb-3 line-clamp-4">
              {bulletin.description}
            </p>

            {/* Attachments - Show only if they exist */}
            {bulletin.attachments && bulletin.attachments.length > 0 && (
              <div className="mb-3">
                <div className="space-y-2">
                  {(() => {
                    console.log(
                      `[BulletinListPreview] Bulletin ${bulletin.id} attachments:`,
                      bulletin.attachments
                    );
                    console.log(
                      `[BulletinListPreview] Attachment structure for bulletin ${bulletin.id}:`,
                      bulletin.attachments?.map((att) => ({
                        id: att.id,
                        file_url: att.file_url,
                        file_name: att.file_name,
                        url: att.url,
                        name: att.name,
                        type: att.type,
                        file_type: att.file_type
                      }))
                    );

                    const totalAttachments = bulletin.attachments.length;

                    return (
                      <div className="space-y-2">
                        {/* Main/First Image/PDF - Display prominently */}
                        <div
                          key={bulletin.attachments[0].id || 0}
                          className="relative bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-200 border border-gray-200 w-full h-[200px] sm:h-[243px] rounded-[16px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onBulletinCardClick) {
                              onBulletinCardClick(bulletin.id);
                              return;
                            }
                            isDocument(
                              bulletin.attachments[0].file_name ||
                              bulletin.attachments[0].name
                            )
                              ? handleDocumentClick(bulletin.attachments[0])
                              : handleImageClick(
                                bulletin.attachments[0],
                                bulletin
                              )
                          }}
                        >
                          {isDocument(
                            bulletin.attachments[0].file_name ||
                            bulletin.attachments[0].name
                          ) ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="flex items-center">
                                {getFileIconSafe(
                                  bulletin.attachments[0].file_name ||
                                  bulletin.attachments[0].name
                                )}
                                <div className="ml-2 text-left">
                                  <div className="text-sm font-medium text-gray-900">
                                    {(
                                      bulletin.attachments[0].file_name ||
                                      bulletin.attachments[0].name
                                    )
                                      ?.toLowerCase()
                                      .endsWith(".pdf")
                                      ? "PDF Document"
                                      : "Word Document"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {bulletin.attachments[0].file_name ||
                                      bulletin.attachments[0].name}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={
                                bulletin.attachments[0].file_url ||
                                bulletin.attachments[0].url ||
                                bulletin.attachments[0]
                              }
                              alt={
                                bulletin.attachments[0].file_name ||
                                bulletin.attachments[0].name ||
                                `Attachment 1`
                              }
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error(
                                  "Image load error for:",
                                  bulletin.attachments[0].file_url
                                );
                                e.target.style.display = "none";
                              }}
                            />
                          )}
                        </div>

                        {/* Additional Images/Files - Show as thumbnails if more than 1 */}
                        {totalAttachments > 1 && (
                          <div className="flex gap-2 overflow-x-auto">
                            {bulletin.attachments
                              .slice(1)
                              .map((attachment, index) => (
                                <div
                                  key={attachment.id || index + 1}
                                  className="relative flex-shrink-0 bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-200 border border-gray-200"
                                  style={{
                                    width: "75px",
                                    height: "57.1px",
                                    borderRadius: "16px"
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onBulletinCardClick) {
                                      onBulletinCardClick(bulletin.id);
                                      return;
                                    }
                                    isDocument(
                                      attachment.file_name || attachment.name
                                    )
                                      ? handleDocumentClick(attachment)
                                      : handleImageClick(attachment, bulletin)
                                  }}
                                >
                                  {isDocument(
                                    attachment.file_name || attachment.name
                                  ) ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="scale-75">
                                        {getFileIconSafe(
                                          attachment.file_name ||
                                          attachment.name
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <img
                                      src={
                                        attachment.file_url ||
                                        attachment.url ||
                                        attachment
                                      }
                                      alt={
                                        attachment.file_name ||
                                        attachment.name ||
                                        `Attachment ${index + 2}`
                                      }
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        console.error(
                                          "Image load error for:",
                                          attachment.file_url
                                        );
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BulletinListPreview;
