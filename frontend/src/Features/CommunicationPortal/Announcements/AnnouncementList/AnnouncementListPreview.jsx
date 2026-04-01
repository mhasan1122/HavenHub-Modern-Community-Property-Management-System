import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaFlag } from "react-icons/fa";
import { FaUserGroup } from "react-icons/fa6";
import { HiDotsHorizontal } from "react-icons/hi";
import { HiUserCircle } from "react-icons/hi";
import AnnouncementActionMenu from "../components/AnnouncementActionMenu";
import { PinIcon } from "../components/PinPost";
import UserCountDisplay from "../components/UserCountDisplay";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import EmptyState from "../../../../Components/Ui/EmptyState";
import { HiMegaphone } from "react-icons/hi2";

// Priority color mapping - consistent with PriorityDropdown component
const PRIORITY_COLORS = {
  urgent: "text-red-500",
  high: "text-yellow-500",
  normal: "text-primary",
  low: "text-gray-400"
};

const getPriorityColor = (priority) => {
  return PRIORITY_COLORS[priority?.toLowerCase()] || "text-gray-500";
};

/**
 * Optimized Image Component with preloading and placeholder
 */
const OptimizedImage = ({ src, alt, className, onError, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Preload image
    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
    img.onerror = () => {
      setError(true);
      onError?.();
    };
  }, [src, onError]);

  if (error) return null;

  return (
    <>
      {!loaded && (
        <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
        style={{ display: error ? 'none' : 'block' }}
        onError={(e) => {
          setError(true);
          onError?.(e);
        }}
      />
    </>
  );
};

/**
 * AnnouncementListPreview Component
 * Renders the list of announcements with their preview cards in a row-wise masonry layout
 */
const AnnouncementListPreview = ({
  // Data props
  announcements,
  loading,

  // UI state props
  openDropdownId,
  dropdownRef,
  currentTab,

  // Handlers
  handleDropdownToggle,
  handleEditAnnouncement,
  handleAnnouncementHistory,
  handleMoveToExpired,
  handleReminder,
  handlePinPost,
  handlePinIconClick,
  handleDirectCommunication,
  handleDeleteAnnouncement,
  handleRestoreAnnouncement,
  handleImageClick,
  handleDocumentClick,

  // Helper functions
  isDocument,
  getFileIcon,
  canEdit = false,
  canExpire = false,
  canPin = false,
  highlightedAnnouncementId = null,
  onAnnouncementCardClick = null,
  isFiltered = false
}) => {
  const containerRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const layoutTimeoutRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debounced layout calculation to prevent excessive recalculations
  const calculateLayout = useCallback(() => {
    if (!containerRef.current || announcements.length === 0 || isCalculating) {
      return;
    }

    setIsCalculating(true);

    const containerWidth = containerRef.current.offsetWidth;
    // Use full width on mobile (< 768px), fixed 400px on larger screens
    const isMobile = containerWidth < 768;
    const cardWidth = isMobile ? containerWidth : 400;
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

    if (cardElements.length === announcements.length) {
      // All cards are rendered, measure their heights
      announcements.forEach((_, index) => {
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
  }, [announcements, isCalculating]);

  // Layout effect with improved stability
  useEffect(() => {
    if (!containerRef.current || announcements.length === 0) {
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
  }, [announcements, calculateLayout]);

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

  if (announcements.length === 0) {
    const tabNames = { 1: "ongoing", 2: "upcoming", 3: "expired" };
    const tabName = tabNames[currentTab] || "announcements";

    return (
      <div className="py-12">
        <EmptyState
          icon={HiMegaphone}
          title={isFiltered ? "No results found" : `No ${tabName} found`}
          message={
            isFiltered
              ? "We couldn't find any announcements matching your current filters. Try adjusting them."
              : `There are currently no ${tabName}. Any new ${tabName} will appear here.`
          }
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-visible ${announcements.length > 0 ? "min-h-[300px]" : ""}`}
      style={{
        height: isLayoutReady ? `${containerHeight}px` : "auto",
        overflowY: 'visible',
        overflowX: 'visible'
      }}
    >
      {announcements.map((announcement, index) => {
        const position = positions[index];
        const hasPosition = isLayoutReady && position;

        const visibilityClass = hasPosition ? "" : isLayoutReady ? "invisible" : "visible";
        const positionStyles = hasPosition
          ? {
              left: `${position.left}px`,
              top: `${position.top}px`
            }
          : {};

        const isHighlighted = highlightedAnnouncementId === announcement.id;
        const isClickable = !!onAnnouncementCardClick;

        return (
          <div
            key={announcement.id}
            data-card-id={announcement.id}
            className={`bg-white rounded-lg p-3 sm:p-4 shadow-sm transition-all duration-300 ease-out w-full md:w-[400px] overflow-visible ${hasPosition && !isMobile ? "absolute" : "relative mb-3 sm:mb-2"} ${isCalculating ? "opacity-70 scale-[0.98]" : "opacity-100 scale-100"} ${visibilityClass} ${isClickable ? "cursor-pointer hover:shadow-lg" : ""} ${isHighlighted ? "border-4 border-primary shadow-xl" : "border border-primary"} ${openDropdownId === announcement.id ? "z-50" : "z-0"}`}
            style={isMobile ? {} : positionStyles}
            onClick={(e) => {
              // Only trigger card click if clicking on the card itself, not on interactive elements
              // Check if the click target is not within any button, link, or clickable element
              const target = e.target;
              const isInteractiveElement =
                target.closest(
                  'button, a, [role="button"], [data-action-menu], [data-pin-icon], [data-user-count]'
                ) ||
                target.hasAttribute("data-action-menu") ||
                target.hasAttribute("data-pin-icon") ||
                target.hasAttribute("data-user-count") ||
                target.tagName === "BUTTON" ||
                target.tagName === "A" ||
                target.getAttribute("role") === "button";

              if (isClickable && !isInteractiveElement && target.closest(`[data-card-id="${announcement.id}"]`)) {
                e.preventDefault();
                e.stopPropagation();
                onAnnouncementCardClick(announcement.id);
              }
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-[24px] h-[24px] rounded-full flex items-center justify-center">
                  {announcement.postAs === "creator" ? (
                    <HiUserCircle className="w-8 h-8" color="gray" />
                  ) : announcement.postAs === "group" ? (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  ) : announcement.postAs === "member" ? (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  ) : (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  )}
                </div>
                <div>
                  <h3 className="text-black text-[14px] font-bold">
                    {announcement.author}
                  </h3>
                  <p className="text-black text-[11px] font-bold">
                    Creator {announcement.creatorName}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Pin Icon */}
                <PinIcon
                  announcement={announcement}
                  onPinIconClick={handlePinIconClick}
                  currentTab={currentTab}
                  canEdit={canPin}
                />
                {/* Priority Flag */}
                {announcement.priority && (
                  <FaFlag
                    className={`w-[16px] h-[16px] ${getPriorityColor(
                      announcement.priority
                    )}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                )}
                <UserCountDisplay announcement={announcement} />
                <div
                  className="relative z-40"
                  ref={openDropdownId === announcement.id ? dropdownRef : null}
                  data-action-menu="true"
                >
                  <HiDotsHorizontal
                    className="w-[16px] h-[16px] text-primary cursor-pointer hover:text-[#2A7A78]"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDropdownToggle(announcement.id);
                    }}
                    data-action-menu="true"
                  />
                  {openDropdownId === announcement.id && (
                    <AnnouncementActionMenu
                      announcement={announcement}
                      onEdit={handleEditAnnouncement}
                      onHistory={handleAnnouncementHistory}
                      onMoveToExpired={handleMoveToExpired}
                      onReminder={handleReminder}
                      onPinPost={handlePinPost}
                      onDirectCommunication={handleDirectCommunication}
                      onDelete={handleDeleteAnnouncement}
                      onRestore={handleRestoreAnnouncement}
                      onClose={() => handleDropdownToggle(null)}
                      canEdit={canEdit}
                      canExpire={canExpire}
                      canPin={canPin}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="text-[10px] sm:text-[11px] mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-primary font-bold whitespace-nowrap">
                Start:{" "}
                {(() => {
                  const date = new Date(announcement.startDate);
                  const day = date.getDate().toString().padStart(2, "0");
                  const month = (date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0");
                  const year = date.getFullYear();
                  const time = announcement.startTime || "";
                  const [hours, minutes] = time.split(":");
                  const hour24 = parseInt(hours);
                  const hour12 =
                    hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                  const period = hour24 >= 12 ? "pm" : "am";
                  return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
                })()}
              </span>
              <span className="text-error font-bold whitespace-nowrap">
                Expire:{" "}
                {(() => {
                  const date = new Date(announcement.endDate);
                  const day = date.getDate().toString().padStart(2, "0");
                  const month = (date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0");
                  const year = date.getFullYear();
                  const time = announcement.endTime || "";
                  const [hours, minutes] = time.split(":");
                  const hour24 = parseInt(hours);
                  const hour12 =
                    hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                  const period = hour24 >= 12 ? "pm" : "am";
                  return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
                })()}
              </span>
            </div>

            {/* Label - Next line */}
            {announcement.label && (
              <div className="text-[12px] mb-2">
                <div className="flex flex-wrap gap-1">
                  {announcement.label.split(",").map((label, index) => (
                    <span
                      key={index}
                      className="bg-[#F5F5F5] text-black text-[10px] px-2 py-1 rounded font-bold"
                    >
                      {label.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <h4 className="text-[#000] text-[14px] font-semibold mb-2 line-clamp-2">
              {announcement.title}
            </h4>

            {/* Description */}
            <p className="text-[#666] text-[12px] mb-3">
              {announcement.description}
            </p>

            {/* Attachments - Show only if they exist */}
            {announcement.attachments &&
              announcement.attachments.length > 0 && (
                <div className="mb-3">
                  <div className="space-y-2">
                    {(() => {
                      console.log(
                        `Announcement ${announcement.id} attachments:`,
                        announcement.attachments
                      );
                      console.log(
                        `Attachment structure for announcement ${announcement.id}:`,
                        announcement.attachments?.map((att) => ({
                          id: att.id,
                          file_url: att.file_url,
                          file_name: att.file_name,
                          url: att.url,
                          name: att.name
                        }))
                      );

                      const totalAttachments = announcement.attachments.length;

                      return (
                        <div className="space-y-2">
                          {/* Main/First Image/PDF - Display prominently */}
                          <div
                            key={announcement.attachments[0].id || 0}
                            className="relative bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-200 border border-gray-200 w-full md:w-[316px] h-[200px] sm:h-[243px] rounded-[12px] sm:rounded-[16px]"
                            onClick={(e) => {
                              // If it's a document, we might want to let it open directly or open modal?
                              // User request: "Opening the details modal first then clicking on image will open the image."
                              // So we should open the modal first for everything.
                              // We let the event bubble up to the card click handler
                              // or explicitly call it if we want to be sure.
                              // But wait, the card click handler has logic to prevent click if target is interactive.
                              // So we should MANUALLY call onAnnouncementCardClick here and STOP propagation to avoid double trigger or filtered trigger.
                              e.stopPropagation();
                              onAnnouncementCardClick(announcement.id);
                            }}
                          >
                            {isDocument(
                              announcement.attachments[0].file_name ||
                                announcement.attachments[0].name
                            ) ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4">
                                <div className="flex flex-col items-center">
                                  {getFileIcon(
                                    announcement.attachments[0].file_name ||
                                      announcement.attachments[0].name
                                  )}
                                  <div className="mt-2 text-center">
                                    <div className="text-sm font-semibold text-gray-900 mb-1">
                                      {(
                                        announcement.attachments[0].file_name ||
                                        announcement.attachments[0].name
                                      )
                                        ?.toLowerCase()
                                        .endsWith(".pdf")
                                        ? "PDF Document"
                                        : "Word Document"}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[250px]">
                                      {announcement.attachments[0].file_name ||
                                        announcement.attachments[0].name}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <OptimizedImage
                                src={
                                  announcement.attachments[0].file_url ||
                                  announcement.attachments[0].url ||
                                  announcement.attachments[0]
                                }
                                alt={
                                  announcement.attachments[0].file_name ||
                                  announcement.attachments[0].name ||
                                  `Attachment 1`
                                }
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error(
                                    "Image load error for:",
                                    announcement.attachments[0].file_url
                                  );
                                }}
                              />
                            )}
                          </div>

                          {/* Additional Images/Files - Show as thumbnails if more than 1 */}
                          {totalAttachments > 1 && (
                            <div className="flex gap-2 overflow-x-auto">
                              {announcement.attachments
                                .slice(1)
                                .map((attachment, index) => (
                                  <div
                                    key={attachment.id || index + 1}
                                    className="relative flex-shrink-0 bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-200 border border-gray-200 w-[60px] sm:w-[75px] h-[45px] sm:h-[57.1px] rounded-[12px] sm:rounded-[16px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAnnouncementCardClick(announcement.id);
                                    }}
                                  >
                                    {isDocument(
                                      attachment.file_name || attachment.name
                                    ) ? (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <div className="scale-75">
                                          {getFileIcon(
                                            attachment.file_name ||
                                              attachment.name
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <OptimizedImage
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

export default AnnouncementListPreview;
