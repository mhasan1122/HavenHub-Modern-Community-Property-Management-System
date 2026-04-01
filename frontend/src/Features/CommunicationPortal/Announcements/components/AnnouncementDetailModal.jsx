import React, { useEffect, useState, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';
import { HiDotsHorizontal } from 'react-icons/hi';
import AnnouncementPreview from './AnnouncementPreview';
import AnnouncementActionMenu from './AnnouncementActionMenu';

/**
 * AnnouncementDetailModal Component
 * Displays full announcement details in a modal overlay
 */
const AnnouncementDetailModal = ({
  isOpen,
  onClose,
  announcement,
  currentUser,
  onImageClick,
  onDocumentClick,
  onEdit,
  onHistory,
  onMoveToExpired,
  onReminder,
  onPinPost,
  onDirectCommunication,
  onDelete,
  onRestore,
  canEdit = false,
  canExpire = false,
  canPin = false
}) => {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Early return after all hooks
  if (!isOpen || !announcement) return null;

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle history click - close modal first, then open history
  const handleHistoryClick = (announcementId) => {
    onClose(); // Close the detail modal first
    // Use setTimeout to ensure modal closes before opening history
    setTimeout(() => {
      if (onHistory) {
        onHistory(announcementId);
      }
    }, 100);
  };

  // Prepare announcement data for preview component
  const previewData = {
    ...announcement,
    postAs: announcement.postAs || (announcement.post_as || 'creator'),
    authorName: announcement.author || announcement.authorName,
    creatorName: announcement.creatorName || announcement.author,
    selectedGroupName: announcement.groupName || announcement.group_name,
    selectedMemberName: announcement.memberName || announcement.member_name,
    startDate: announcement.startDate || announcement.start_date,
    startTime: announcement.startTime || announcement.start_time,
    endDate: announcement.endDate || announcement.end_date,
    endTime: announcement.endTime || announcement.end_time,
    priority: announcement.priority,
    label: announcement.label,
    title: announcement.title || announcement.internal_title,
    description: announcement.description || announcement.content,
    attachments: announcement.attachments || [],
    selectedUnits: announcement.target_units_data?.map(unit => unit.id) || [],
    target_units_data: announcement.target_units_data
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Announcement Details</h2>
          <div className="flex items-center gap-2">
            {/* Three-dot menu */}
            {announcement && (onEdit || onHistory || onPinPost || onMoveToExpired || onDelete) && (
              <div
                className="relative"
                ref={openDropdownId === announcement.id ? dropdownRef : null}
                data-action-menu="true"
              >
                <HiDotsHorizontal
                  className="w-5 h-5 text-primary cursor-pointer hover:text-[#2A7A78]"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setOpenDropdownId(openDropdownId === announcement.id ? null : announcement.id);
                  }}
                  data-action-menu="true"
                />
                {openDropdownId === announcement.id && (
                  <AnnouncementActionMenu
                    announcement={announcement}
                    onEdit={onEdit}
                    onHistory={handleHistoryClick}
                    onMoveToExpired={onMoveToExpired}
                    onReminder={onReminder}
                    onPinPost={onPinPost}
                    onDirectCommunication={onDirectCommunication}
                    onDelete={onDelete}
                    onRestore={onRestore}
                    onClose={() => setOpenDropdownId(null)}
                    canEdit={canEdit}
                    canExpire={canExpire}
                    canPin={canPin}
                  />
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
              aria-label="Close"
            >
              <FaTimes className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <AnnouncementPreview
            data={previewData}
            currentUser={currentUser}
            isInModal={true}
            onImageClick={onImageClick}
            onDocumentClick={onDocumentClick}
          />
        </div>
      </div>
    </div>
  );
};

export default AnnouncementDetailModal;

