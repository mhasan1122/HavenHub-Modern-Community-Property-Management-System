import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaFlag } from "react-icons/fa";
import { FaUserGroup } from "react-icons/fa6";
import { HiDotsHorizontal } from "react-icons/hi";
import { HiUserCircle } from "react-icons/hi";
import NoticeActionMenu from "../components/NoticeActionMenu";
import { PinIcon } from "../components/PinPost";
import UserCountDisplay from "../components/UserCountDisplay";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";

// Priority color mapping - consistent with PriorityDropdown component and Tailwind config
const PRIORITY_COLORS = {
  urgent: "text-urgent", // Using urgent deep red color from config (#B91C1C)
  high: "text-warning", // Using warning color from config (#D97706)
  normal: "text-primary", // Using primary color from config (#3C9D9B)
  low: "text-textMedium" // Using textMedium from config (#666666)
};

const getPriorityColor = (priority) => {
  return PRIORITY_COLORS[priority?.toLowerCase()] || "text-gray-500";
};

/**
 * NoticeListPreview Component
 * Renders the list of notices with their preview cards in a row-wise masonry layout
 */
const NoticeListPreview = ({
  // Data props
  notices,
  loading,

  // UI state props
  openDropdownId,
  dropdownRef,
  currentTab,
  highlightedNoticeId,

  // Handlers
  handleDropdownToggle,
  onEdit,
  onDelete,
  onExpire,
  onRestore,
  onPinToggle,
  onImageClick,
  handleDocumentClick,
  activeTab,

  // Utility functions
  isDocument,
  getFileIcon,
  canExpire = false
}) => {
  const containerRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const layoutTimeoutRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Debug: Log when highlightedNoticeId changes
  useEffect(() => {
    if (highlightedNoticeId) {
      console.log('[NoticeListPreview] Highlighted Notice ID:', highlightedNoticeId);
    }
  }, [highlightedNoticeId]);

  // Debounced layout calculation to prevent excessive recalculations
  const calculateLayout = useCallback(() => {
    if (!containerRef.current || notices.length === 0 || isCalculating) {
      return;
    }

    setIsCalculating(true);

    const containerWidth = containerRef.current.offsetWidth;
    const isMobile = containerWidth < 768;
    const cardWidth = isMobile ? containerWidth : 420; // Full width on mobile, fixed on desktop
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

    if (cardElements.length === notices.length) {
      // All cards are rendered, measure their heights
      notices.forEach((_, index) => {
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
  }, [notices, isCalculating]);

  // Layout effect with improved stability
  useEffect(() => {
    if (!containerRef.current || notices.length === 0) {
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
  }, [notices, calculateLayout]);

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
      className={`relative w-full ${notices.length > 0 ? "min-h-[300px]" : ""}`}
      style={{
        height: isLayoutReady && !isMobile ? `${containerHeight}px` : "auto",
        opacity: isLayoutReady ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      {notices.map((notice, index) => {
        const position = positions[index];
        const isHighlighted = highlightedNoticeId === notice.id;
        const hasPosition = isLayoutReady && position && !isMobile;
        const positionStyles = hasPosition
          ? {
            left: `${position.left}px`,
            top: `${position.top}px`
          }
          : {};

        return (
          <div
            id={`notice-${notice.id}`}
            key={notice.id}
            data-card-id={notice.id}
            className={`bg-white rounded-lg p-3 sm:p-4 transition-all duration-300 ease-out ${hasPosition ? "absolute" : "relative mb-3 sm:mb-2"
              } ${isLayoutReady ? "opacity-100" : "opacity-0"} cursor-pointer hover:shadow-lg ${isHighlighted
                ? "border-4 border-primary shadow-xl"
                : "border border-primary"
              }`}
            style={{
              width: isMobile ? "100%" : "420px",
              ...positionStyles
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-[24px] h-[24px] rounded-full flex items-center justify-center">
                  {notice.postAs === "creator" ? (
                    <HiUserCircle className="w-8 h-8" color="gray" />
                  ) : notice.postAs === "group" ? (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  ) : notice.postAs === "member" ? (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  ) : (
                    <FaUserGroup className="w-8 h-8" color="gray" />
                  )}
                </div>
                <div>
                  <h3 className={`text-black text-[14px] ${highlightedNoticeId === notice.id ? "font-extrabold" : "font-bold"
                    }`}>
                    {notice.author}
                  </h3>
                  <p className={`text-black text-[11px] ${highlightedNoticeId === notice.id ? "font-extrabold" : "font-bold"
                    }`}>
                    Creator {notice.creatorName}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Pin Icon */}
                <PinIcon
                  notice={notice}
                  currentTab={currentTab}
                />
                {/* Priority Flag */}
                {notice.priority && (
                  <FaFlag
                    className={`w-[16px] h-[16px] ${getPriorityColor(
                      notice.priority
                    )}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                )}
                <UserCountDisplay notice={notice} />
                <div
                  className="relative"
                  ref={openDropdownId === notice.id ? dropdownRef : null}
                  data-action-menu="true"
                >
                  <HiDotsHorizontal
                    className="w-[16px] h-[16px] text-primary cursor-pointer hover:text-primaryDark"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDropdownToggle(notice.id);
                    }}
                    data-action-menu="true"
                  />
                  {openDropdownId === notice.id && (
                    <NoticeActionMenu
                      notice={notice}
                      onEdit={onEdit}
                      onMoveToExpired={onExpire}
                      onPinPost={onPinToggle}
                      onDelete={onDelete}
                      onRestore={onRestore}
                      onClose={() => handleDropdownToggle(null)}
                      activeTab={activeTab}
                      canExpire={canExpire}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Date - Stack on mobile, inline on larger screens to prevent truncation */}
            <div className="text-[11px] mb-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-x-4">
              <span className="text-primary font-bold">
                Start:{" "}
                {(() => {
                  const date = new Date(notice.startDate);
                  const day = date.getDate().toString().padStart(2, "0");
                  const month = (date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0");
                  const year = date.getFullYear();
                  const time = notice.startTime || "";
                  const [hours, minutes] = time.split(":");
                  const hour24 = parseInt(hours);
                  const hour12 =
                    hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                  const period = hour24 >= 12 ? "pm" : "am";
                  return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
                })()}
              </span>
              <span className="text-error font-bold">
                Expire:{" "}
                {(() => {
                  const date = new Date(notice.endDate);
                  const day = date.getDate().toString().padStart(2, "0");
                  const month = (date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0");
                  const year = date.getFullYear();
                  const time = notice.endTime || "";
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
            {notice.label && (
              <div className="text-[12px] mb-2">
                <div className="flex flex-wrap gap-1">
                  {notice.label.split(",").map((label, index) => (
                    <span
                      key={index}
                      className="bg-label text-black text-[10px] px-2 py-1 rounded font-bold"
                    >
                      {label.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}



            {/* Attachments - Show only if they exist */}
            {notice.attachments &&
              notice.attachments.length > 0 && (
                <div className="mb-3">
                  <div className="space-y-2">
                    {(() => {
                      const totalAttachments = notice.attachments.length;

                      return (
                        <div className="space-y-2">
                          {/* Main/First Image/PDF - Display prominently */}
                          <div
                            key={notice.attachments[0].id || 0}
                            className="relative bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-200 border border-gray-200 w-full h-[200px] sm:w-[386px] sm:h-[296px] rounded-[16px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              isDocument(
                                notice.attachments[0].file_name ||
                                notice.attachments[0].name
                              )
                                ? handleDocumentClick(
                                  notice.attachments[0]
                                )
                                : onImageClick(
                                  notice.attachments[0],
                                  notice
                                )
                            }}
                          >
                            {isDocument(
                              notice.attachments[0].file_name ||
                              notice.attachments[0].name
                            ) ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="flex items-center">
                                  {getFileIcon(
                                    notice.attachments[0].file_name ||
                                    notice.attachments[0].name
                                  )}
                                  <div className="ml-2 text-left">
                                    <div className="text-sm font-medium text-gray-900">
                                      {(
                                        notice.attachments[0].file_name ||
                                        notice.attachments[0].name
                                      )
                                        ?.toLowerCase()
                                        .endsWith(".pdf")
                                        ? "PDF Document"
                                        : "Word Document"}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {notice.attachments[0].file_name ||
                                        notice.attachments[0].name}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={
                                  notice.attachments[0].file_url ||
                                  notice.attachments[0].url ||
                                  notice.attachments[0]
                                }
                                alt={
                                  notice.attachments[0].file_name ||
                                  notice.attachments[0].name ||
                                  `Attachment 1`
                                }
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error(
                                    "Image load error for:",
                                    notice.attachments[0].file_url
                                  );
                                  e.target.style.display = "none";
                                }}
                              />
                            )}
                          </div>

                          {/* Additional Images/Files - Show as thumbnails if more than 1 */}
                          {totalAttachments > 1 && (
                            <div className="flex gap-2 overflow-x-auto">
                              {notice.attachments
                                .slice(1)
                                .map((attachment, index) => (
                                  <div
                                    key={attachment.id || index + 1}
                                    className="relative flex-shrink-0 bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-200 border border-gray-200 w-[60px] h-[45px] sm:w-[75px] sm:h-[57.1px] rounded-[16px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      isDocument(
                                        attachment.file_name || attachment.name
                                      )
                                        ? handleDocumentClick(attachment)
                                        : onImageClick(
                                          attachment,
                                          notice
                                        )
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

export default NoticeListPreview;
